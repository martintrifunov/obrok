import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Writable } from "stream";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { ReportController } from "./report.controller.js";

const makeRes = ({ stall = false } = {}) => {
  const res = new Writable({
    // A stalled response never drains, like a client that stopped reading.
    write(_chunk, _enc, cb) {
      if (!stall) cb();
    },
  });
  res.setHeader = () => {};
  res.headersSent = false;
  return res;
};

const exists = (p) =>
  fs.access(p).then(
    () => true,
    () => false,
  );

// Linux-only: whether this process still holds a file descriptor for `target`.
const hasOpenFd = async (target) => {
  const fds = await fs.readdir("/proc/self/fd");
  const links = await Promise.all(
    fds.map((fd) => fs.readlink(`/proc/self/fd/${fd}`).catch(() => null)),
  );
  return links.includes(target);
};

describe("ReportController.download", () => {
  let dir;
  let filePath;
  let controller;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "report-dl-"));
    filePath = path.join(dir, "report-1.csv");
    await fs.writeFile(filePath, "x".repeat(256 * 1024));
    controller = new ReportController({
      downloadReport: async () => ({ filePath, fileName: "report-1.csv" }),
    });
  });

  afterEach(() => fs.rm(dir, { recursive: true, force: true }));

  it("deletes the file after a complete download", async () => {
    const res = makeRes();
    const finished = new Promise((r) => res.on("finish", r));

    await controller.download({ user: "admin", params: { jobId: "1" } }, res);
    await finished;

    await expect.poll(() => exists(filePath)).toBe(false);
  });

  it.runIf(process.platform === "linux")(
    "keeps the file and releases its handle when the client aborts mid-download",
    async () => {
      const res = makeRes({ stall: true });
      await controller.download({ user: "admin", params: { jobId: "1" } }, res);

      await new Promise((r) => setTimeout(r, 20));
      const closed = new Promise((r) => res.on("close", r));
      res.destroy();
      await closed;
      await new Promise((r) => setTimeout(r, 20));

      expect(await exists(filePath)).toBe(true);
      expect(await hasOpenFd(filePath)).toBe(false);
    },
  );
});
