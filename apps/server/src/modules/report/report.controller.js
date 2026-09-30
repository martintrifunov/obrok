import { createReadStream } from "fs";
import { unlink } from "fs/promises";

export class ReportController {
  constructor(reportService) {
    this.reportService = reportService;
  }

  create = async (req, res) => {
    const userId = req.user;
    const filters = req.body;
    const result = await this.reportService.createJob(userId, filters);
    res.status(202).json(result);
  };

  getStatus = async (req, res) => {
    const userId = req.user;
    const { jobId } = req.params;
    const result = await this.reportService.getJobStatus(jobId, userId);
    res.status(200).json(result);
  };

  cancel = async (req, res) => {
    const userId = req.user;
    const { jobId } = req.params;
    const result = await this.reportService.cancelJob(jobId, userId);
    res.status(200).json(result);
  };

  download = async (req, res) => {
    const userId = req.user;
    const { jobId } = req.params;
    const { filePath, fileName } = await this.reportService.downloadReport(jobId, userId);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    const stream = createReadStream(filePath);
    stream.on("error", (err) => {
      console.error("Report stream error:", err);
      if (!res.headersSent) res.sendStatus(500);
      else res.destroy();
    });
    // Only a fully sent file is deleted; an aborted download keeps it so the
    // client can retry. Leftovers are removed by ReportService.cleanupStaleReports.
    res.on("finish", () => {
      unlink(filePath).catch(() => {});
    });
    res.on("close", () => {
      if (!res.writableFinished) stream.destroy();
    });
    stream.pipe(res);
  };
}
