import { ReportJobModel, ReportJobStatus } from "./report-job.model.js";

const ACTIVE = [ReportJobStatus.PENDING, ReportJobStatus.PROCESSING];

export class ReportJobRepository {
  async findByIdAndUser(id, userId) {
    return ReportJobModel.findOne({ _id: id, requestedBy: userId }).exec();
  }

  async findActiveByUser(userId) {
    return ReportJobModel.findOne({
      requestedBy: userId,
      status: { $in: ACTIVE },
    }).exec();
  }

  async abortInterrupted(reason) {
    return ReportJobModel.updateMany(
      { status: { $in: ACTIVE } },
      { $set: { status: ReportJobStatus.ABORTED, error: reason, finishedAt: new Date() } },
    ).exec();
  }

  /**
   * Atomically moves a job from one of `fromStatuses` to a new state. Returns
   * the updated job, or null if the job had already left those statuses (e.g.
   * a cancel landed first), so concurrent transitions can't overwrite each other.
   * @param {unknown} id
   * @param {string[]} fromStatuses
   * @param {Record<string, unknown>} update
   * @param {{ requestedBy?: string }} [options]
   */
  async transition(id, fromStatuses, update, { requestedBy } = {}) {
    return ReportJobModel.findOneAndUpdate(
      {
        _id: id,
        status: { $in: fromStatuses },
        ...(requestedBy !== undefined && { requestedBy }),
      },
      { $set: update },
      { returnDocument: "after" },
    ).exec();
  }

  async create(data) {
    return ReportJobModel.create(data);
  }
}
