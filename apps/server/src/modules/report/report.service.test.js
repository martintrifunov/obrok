import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { ReportService } from "./report.service.js";
import { NotFoundError } from "../../shared/errors/NotFoundError.js";
import { AppError } from "../../shared/errors/AppError.js";

// In-memory stand-in with the same conditional-transition semantics as Mongo's findOneAndUpdate.
const makeJobRepository = () => {
  const jobs = new Map();
  let seq = 0;
  return {
    jobs,
    create: vi.fn(async (data) => {
      const job = { _id: `job${++seq}`, ...data };
      jobs.set(job._id, job);
      return { ...job };
    }),
    findById: vi.fn(async (id) => (jobs.has(id) ? { ...jobs.get(id) } : null)),
    findByIdAndUser: vi.fn(async (id, userId) => {
      const job = jobs.get(id);
      return job && job.requestedBy === userId ? { ...job } : null;
    }),
    findActiveByUser: vi.fn(
      async (userId) =>
        [...jobs.values()].find(
          (j) =>
            j.requestedBy === userId &&
            ["PENDING", "PROCESSING"].includes(j.status),
        ) ?? null,
    ),
    transition: vi.fn(
      async (id, fromStatuses, update, { requestedBy } = {}) => {
        const job = jobs.get(id);
        if (!job || !fromStatuses.includes(job.status)) return null;
        if (requestedBy !== undefined && job.requestedBy !== requestedBy)
          return null;
        Object.assign(job, update);
        return { ...job };
      },
    ),
  };
};

const market = {
  name: "Vero 1",
  location: [42, 21.4],
  chain: { name: "Vero" },
  marketProducts: [],
};

// Resolves once the job leaves the active statuses.
const waitForSettled = async (repo, id) => {
  await vi.waitFor(() => {
    expect(["PENDING", "PROCESSING"]).not.toContain(repo.jobs.get(id).status);
  });
  return repo.jobs.get(id);
};

describe("ReportService", () => {
  let reportsDir;
  let repo;
  let marketRepository;
  let sut;

  beforeEach(async () => {
    reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), "reports-"));
    repo = makeJobRepository();
    marketRepository = {
      findAllForReport: vi.fn().mockResolvedValue([market]),
    };
    sut = new ReportService(repo, marketRepository, { reportsDir });
  });

  afterEach(async () => {
    await fs.rm(reportsDir, { recursive: true, force: true });
  });

  it("generates a report and marks it completed", async () => {
    const { jobId } = await sut.createJob("admin", {});
    const job = await waitForSettled(repo, jobId);

    expect(job.status).toBe("COMPLETED");
    const csv = await fs.readFile(path.join(reportsDir, job.artifact), "utf-8");
    expect(csv).toContain("Vero 1");
  });

  it("keeps a cancel that lands before processing starts", async () => {
    // The cancel lands just before the job's PENDING -> PROCESSING transition runs.
    const realTransition = repo.transition.getMockImplementation();
    repo.transition.mockImplementationOnce(async (...args) => {
      await sut.cancelJob(args[0], "admin");
      return realTransition(...args);
    });
    const { jobId } = await sut.createJob("admin", {});
    const job = await waitForSettled(repo, jobId);

    expect(job.status).toBe("CANCELLED");
    expect(marketRepository.findAllForReport).not.toHaveBeenCalled();
    expect(await fs.readdir(reportsDir)).toEqual([]);
  });

  it("keeps a cancel that lands while the report is being built", async () => {
    // The fake repository numbers jobs, so the first one is "job1".
    marketRepository.findAllForReport.mockImplementation(async () => {
      await sut.cancelJob("job1", "admin");
      return [market];
    });

    const { jobId } = await sut.createJob("admin", {});
    const job = await waitForSettled(repo, jobId);

    expect(job.status).toBe("CANCELLED");
    expect(await fs.readdir(reportsDir)).toEqual([]);
    // The user isn't blocked from starting another report.
    await expect(sut.createJob("admin", {})).resolves.toBeDefined();
  });

  it("aborts a job that runs past the timeout", async () => {
    sut = new ReportService(repo, marketRepository, {
      reportsDir,
      timeoutMs: 10,
    });
    marketRepository.findAllForReport.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([market]), 50)),
    );

    const { jobId } = await sut.createJob("admin", {});
    await vi.waitFor(() => expect(repo.jobs.get(jobId).status).toBe("ABORTED"));
    await new Promise((r) => setTimeout(r, 80));

    expect(repo.jobs.get(jobId).status).toBe("ABORTED");
    expect(await fs.readdir(reportsDir)).toEqual([]);
  });

  it("marks the job failed when generation throws", async () => {
    marketRepository.findAllForReport.mockRejectedValue(new Error("db down"));

    const { jobId } = await sut.createJob("admin", {});
    const job = await waitForSettled(repo, jobId);

    expect(job).toMatchObject({ status: "FAILED", error: "db down" });
  });

  describe("cancelJob", () => {
    it("returns 404 for another user's job", async () => {
      repo.jobs.set("j1", {
        _id: "j1",
        requestedBy: "someone",
        status: "PENDING",
      });
      await expect(sut.cancelJob("j1", "admin")).rejects.toThrow(NotFoundError);
    });

    it("returns 409 for a finished job", async () => {
      repo.jobs.set("j1", {
        _id: "j1",
        requestedBy: "admin",
        status: "COMPLETED",
      });
      await expect(sut.cancelJob("j1", "admin")).rejects.toThrow(AppError);
      expect(repo.jobs.get("j1").status).toBe("COMPLETED");
    });
  });

  describe("cleanupStaleReports", () => {
    it("deletes only old report files", async () => {
      const old = path.join(reportsDir, "report-old.csv");
      const fresh = path.join(reportsDir, "report-fresh.csv");
      const other = path.join(reportsDir, "notes.txt");
      await Promise.all([old, fresh, other].map((f) => fs.writeFile(f, "x")));
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      await fs.utimes(old, twoDaysAgo, twoDaysAgo);
      await fs.utimes(other, twoDaysAgo, twoDaysAgo);

      const removed = await sut.cleanupStaleReports();

      expect(removed).toBe(1);
      expect((await fs.readdir(reportsDir)).sort()).toEqual([
        "notes.txt",
        "report-fresh.csv",
      ]);
    });

    it("returns 0 when the reports directory doesn't exist", async () => {
      sut = new ReportService(repo, marketRepository, {
        reportsDir: path.join(reportsDir, "missing"),
      });
      await expect(sut.cleanupStaleReports()).resolves.toBe(0);
    });
  });
});
