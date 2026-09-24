import { Parser } from "@json2csv/plainjs";
import fs from "fs/promises";
import path from "path";
import { ReportJobStatus } from "./report-job.model.js";
import { NotFoundError } from "../../shared/errors/NotFoundError.js";
import { AppError } from "../../shared/errors/AppError.js";

const TIMEOUT_MS = 5 * 60 * 1000;
const REPORTS_DIR = path.resolve("src/data/reports");

export class ReportService {
  constructor(reportJobRepository, marketRepository) {
    this.reportJobRepository = reportJobRepository;
    this.marketRepository = marketRepository;
    this.activeJobs = new Map();
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
      status: ReportJobStatus.PENDING,
    });

    this.#processJob(job._id, filters);

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
    const job = await this.reportJobRepository.findByIdAndUser(jobId, userId);
    if (!job) throw new NotFoundError("Report job not found.");

    const terminalStatuses = [ReportJobStatus.COMPLETED, ReportJobStatus.FAILED, ReportJobStatus.CANCELLED, ReportJobStatus.ABORTED];
    if (terminalStatuses.includes(job.status)) {
      throw new AppError(`Cannot cancel a job with status ${job.status}.`, 409);
    }

    this.activeJobs.set(jobId.toString(), { cancelled: true });

    job.status = ReportJobStatus.CANCELLED;
    job.finishedAt = new Date();
    await this.reportJobRepository.save(job);

    return { jobId: job._id, status: job.status };
  }

  async downloadReport(jobId, userId) {
    const job = await this.reportJobRepository.findByIdAndUser(jobId, userId);
    if (!job) throw new NotFoundError("Report job not found.");

    if (job.status !== ReportJobStatus.COMPLETED) {
      throw new AppError(`Report is not ready. Current status: ${job.status}.`, 409);
    }

    const filePath = path.join(REPORTS_DIR, job.artifact);
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

    const timeoutId = setTimeout(async () => {
      try {
        const job = await this.reportJobRepository.findById(jobId);
        if (job && (job.status === ReportJobStatus.PENDING || job.status === ReportJobStatus.PROCESSING)) {
          job.status = ReportJobStatus.ABORTED;
          job.error = "Report generation timed out.";
          job.finishedAt = new Date();
          await this.reportJobRepository.save(job);
        }
      } catch { /* timeout cleanup failure */ }
      this.activeJobs.delete(jobIdStr);
    }, TIMEOUT_MS);

    try {
      const job = await this.reportJobRepository.findById(jobId);
      if (!job || job.status === ReportJobStatus.CANCELLED) {
        return;
      }

      job.status = ReportJobStatus.PROCESSING;
      job.startedAt = new Date();
      await this.reportJobRepository.save(job);

      if (this.#isCancelled(jobIdStr)) {
        return;
      }

      const marketsData = await this.marketRepository.findAllForReport(filters);

      if (this.#isCancelled(jobIdStr)) {
        return;
      }

      const csv = this.#buildCsv(marketsData);

      if (this.#isCancelled(jobIdStr)) {
        return;
      }

      await fs.mkdir(REPORTS_DIR, { recursive: true });
      const fileName = `report-${jobIdStr}.csv`;
      const filePath = path.join(REPORTS_DIR, fileName);
      await fs.writeFile(filePath, csv, "utf-8");

      const freshJob = await this.reportJobRepository.findById(jobId);
      if (!freshJob || freshJob.status === ReportJobStatus.CANCELLED || freshJob.status === ReportJobStatus.ABORTED) {
        await fs.unlink(filePath).catch(() => {});
        return;
      }

      freshJob.status = ReportJobStatus.COMPLETED;
      freshJob.artifact = fileName;
      freshJob.finishedAt = new Date();
      await this.reportJobRepository.save(freshJob);
    } catch (err) {
      const orphanPath = path.join(REPORTS_DIR, `report-${jobIdStr}.csv`);
      await fs.unlink(orphanPath).catch(() => {});
      try {
        const job = await this.reportJobRepository.findById(jobId);
        if (job && job.status !== ReportJobStatus.CANCELLED && job.status !== ReportJobStatus.ABORTED) {
          job.status = ReportJobStatus.FAILED;
          job.error = err.message || "Unknown error during report generation.";
          job.finishedAt = new Date();
          await this.reportJobRepository.save(job);
        }
      } catch { /* failure during error handling */ }
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
