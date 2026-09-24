import { Parser } from "@json2csv/plainjs";
import fs from "fs/promises";
import path from "path";
import { ReportJobStatus } from "./report-job.model.js";
import { NotFoundError } from "../../shared/errors/NotFoundError.js";
import { AppError } from "../../shared/errors/AppError.js";

const TIMEOUT_MS = 5 * 60 * 1000;
const REPORTS_DIR = path.resolve("src/data/reports");
// Reports are deleted after a complete download; this catches ones never downloaded.
const STALE_REPORT_MS = 24 * 60 * 60 * 1000;

const { PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED, ABORTED } = ReportJobStatus;
const ACTIVE_STATUSES = [PENDING, PROCESSING];

export class ReportService {
  constructor(
    reportJobRepository,
    marketRepository,
    { reportsDir = REPORTS_DIR, timeoutMs = TIMEOUT_MS } = {},
  ) {
    this.reportJobRepository = reportJobRepository;
    this.marketRepository = marketRepository;
    this.reportsDir = reportsDir;
    this.timeoutMs = timeoutMs;
    this.activeJobs = new Map();
  }

  /**
   * Deletes report files older than `maxAgeMs` (never downloaded, or left behind
   * by an aborted download). Runs opportunistically on createJob; also safe to
   * call at startup.
   */
  async cleanupStaleReports(maxAgeMs = STALE_REPORT_MS) {
    let entries;
    try {
      entries = await fs.readdir(this.reportsDir);
    } catch {
      return 0;
    }

    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;
    for (const name of entries) {
      if (!/^report-.*\.csv$/.test(name)) continue;
      const filePath = path.join(this.reportsDir, name);
      try {
        const { mtimeMs } = await fs.stat(filePath);
        if (mtimeMs < cutoff) {
          await fs.unlink(filePath);
          removed++;
        }
      } catch {
        // Already gone or unreadable; skip.
      }
    }
    return removed;
  }

  /**
   * Jobs run in-process, so any job still PENDING/PROCESSING at startup was
   * killed by a restart. Left alone, it blocks that user from new reports (409).
   */
  async abortInterruptedJobs() {
    const result = await this.reportJobRepository.abortInterrupted(
      "Interrupted by a server restart.",
    );
    return result.modifiedCount ?? 0;
  }

  async createJob(userId, filters) {
    const existing = await this.reportJobRepository.findActiveByUser(userId);
    if (existing) {
      throw new AppError("A report is already being generated. Cancel it first or wait for it to finish.", 409);
    }

    const job = await this.reportJobRepository.create({
      requestedBy: userId,
      filters,
      status: PENDING,
    });

    this.#processJob(job._id, filters);
    this.cleanupStaleReports().catch(() => {});

    return { jobId: job._id, status: job.status, filters };
  }

  async getJobStatus(jobId, userId) {
    const job = await this.reportJobRepository.findByIdAndUser(jobId, userId);
    if (!job) throw new NotFoundError("Report job not found.");
    return {
      jobId: job._id,
      status: job.status,
      filters: job.filters,
      error: job.error,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
    };
  }

  async cancelJob(jobId, userId) {
    const cancelled = await this.reportJobRepository.transition(
      jobId,
      ACTIVE_STATUSES,
      { status: CANCELLED, finishedAt: new Date() },
      { requestedBy: userId },
    );

    if (!cancelled) {
      const job = await this.reportJobRepository.findByIdAndUser(jobId, userId);
      if (!job) throw new NotFoundError("Report job not found.");
      throw new AppError(`Cannot cancel a job with status ${job.status}.`, 409);
    }

    const state = this.activeJobs.get(jobId.toString());
    if (state) state.cancelled = true;

    return { jobId: cancelled._id, status: cancelled.status };
  }

  async downloadReport(jobId, userId) {
    const job = await this.reportJobRepository.findByIdAndUser(jobId, userId);
    if (!job) throw new NotFoundError("Report job not found.");

    if (job.status !== COMPLETED) {
      throw new AppError(`Report is not ready. Current status: ${job.status}.`, 409);
    }

    const filePath = path.join(this.reportsDir, job.artifact);
    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundError("Report file no longer exists.");
    }

    return { filePath, fileName: job.artifact };
  }

  async #processJob(jobId, filters) {
    const jobIdStr = jobId.toString();
    this.activeJobs.set(jobIdStr, { cancelled: false });
    const filePath = path.join(this.reportsDir, `report-${jobIdStr}.csv`);

    // Every status change is conditional on the job still being active, so a
    // cancel or timeout that lands mid-run is never overwritten.
    const timeoutId = setTimeout(async () => {
      const state = this.activeJobs.get(jobIdStr);
      if (state) state.cancelled = true;
      await this.reportJobRepository
        .transition(jobId, ACTIVE_STATUSES, {
          status: ABORTED,
          error: "Report generation timed out.",
          finishedAt: new Date(),
        })
        .catch(() => {});
    }, this.timeoutMs);

    try {
      const started = await this.reportJobRepository.transition(jobId, [PENDING], {
        status: PROCESSING,
        startedAt: new Date(),
      });
      if (!started) return;

      const marketsData = await this.marketRepository.findAllForReport(filters);
      if (this.#isCancelled(jobIdStr)) return;

      const csv = this.#buildCsv(marketsData);
      if (this.#isCancelled(jobIdStr)) return;

      await fs.mkdir(this.reportsDir, { recursive: true });
      await fs.writeFile(filePath, csv, "utf-8");

      const completed = await this.reportJobRepository.transition(jobId, [PROCESSING], {
        status: COMPLETED,
        artifact: path.basename(filePath),
        finishedAt: new Date(),
      });
      if (!completed) {
        // Cancelled or timed out while writing.
        await fs.unlink(filePath).catch(() => {});
      }
    } catch (err) {
      await fs.unlink(filePath).catch(() => {});
      await this.reportJobRepository
        .transition(jobId, ACTIVE_STATUSES, {
          status: FAILED,
          error: err.message || "Unknown error during report generation.",
          finishedAt: new Date(),
        })
        .catch(() => {});
    } finally {
      clearTimeout(timeoutId);
      this.activeJobs.delete(jobIdStr);
    }
  }

  #isCancelled(jobIdStr) {
    const state = this.activeJobs.get(jobIdStr);
    return state?.cancelled === true;
  }

  #buildCsv(marketsData) {
    const rows = marketsData.map(({ name, location, chain, marketProducts }) => {
      const productsData = marketProducts?.length
        ? marketProducts
            .map((mp) => `${mp.product.title}, ${mp.price} ден`)
            .join("\n")
        : "";
      return {
        market: name,
        chain: chain?.name || "",
        location: location.join(", "),
        products: productsData,
      };
    });

    const parser = new Parser({
      fields: ["market", "chain", "location", "products"],
    });

    return parser.parse(rows);
  }
}
