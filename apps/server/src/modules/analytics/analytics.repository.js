import {
  AnalyticsEventModel,
  AnalyticsEventType,
  VisitorSessionModel,
  AnalyticsMonthlyAggregateModel,
} from "./analytics.model.js";

export class AnalyticsRepository {
  #monthKey(date) {
    return date.toISOString().slice(0, 7);
  }

  #monthRange(date) {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return { monthStart, monthEnd };
  }

  async upsertVisitorSession({ visitorId, userId, path, seenAt }) {
    return VisitorSessionModel.findOneAndUpdate(
      { visitorId },
      {
        $set: {
          userId: userId || null,
          lastSeenAt: seenAt,
          lastPath: path || null,
        },
        $setOnInsert: { firstSeenAt: seenAt },
      },
      { upsert: true, returnDocument: "after" },
    ).exec();
  }

  async createEvent(event) {
    return AnalyticsEventModel.create(event);
  }

  async getFeatureUsageTrend({ from, to }) {
    return AnalyticsEventModel.aggregate([
      {
        $match: {
          occurredAt: { $gte: from, $lte: to },
          eventType: AnalyticsEventType.FEATURE_USAGE,
          feature: { $in: ["smart-search", "hybrid-search"] },
        },
      },
      {
        $group: {
          _id: {
            day: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$occurredAt",
              },
            },
            feature: "$feature",
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.day",
          smartSearch: {
            $sum: {
              $cond: [{ $eq: ["$_id.feature", "smart-search"] }, "$count", 0],
            },
          },
          hybridSearch: {
            $sum: {
              $cond: [{ $eq: ["$_id.feature", "hybrid-search"] }, "$count", 0],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          day: "$_id",
          smartSearch: 1,
          hybridSearch: 1,
        },
      },
      { $sort: { day: 1 } },
    ]);
  }

  async getSummary({ from, to, activeWindowMinutes }) {
    const visitDateFilter = {
      occurredAt: { $gte: from, $lte: to },
      eventType: AnalyticsEventType.PAGE_VIEW,
    };

    const currentMonthStart = new Date(to.getFullYear(), to.getMonth(), 1);
    const currentMonthVisitsFilter = {
      occurredAt: { $gte: currentMonthStart, $lte: to },
      eventType: AnalyticsEventType.PAGE_VIEW,
    };

    const [
      totalVisits,
      uniqueVisitorsRows,
      currentMonthUniqueRows,
      monthlyRowsArchived,
      monthlyRowsRaw,
      dailyRows,
      featureTotals,
      featureUsageDaily,
      activeNow,
    ] =
      await Promise.all([
        AnalyticsEventModel.countDocuments(visitDateFilter),
        AnalyticsEventModel.aggregate([
          { $match: visitDateFilter },
          { $group: { _id: "$identityKey" } },
          { $count: "count" },
        ]),
        AnalyticsEventModel.aggregate([
          { $match: currentMonthVisitsFilter },
          { $group: { _id: "$identityKey" } },
          { $count: "count" },
        ]),
        // Months archived by the cleanup cron before their raw events were deleted.
        AnalyticsMonthlyAggregateModel.aggregate([
          {
            $match: {
              // Any month overlapping the range, not just months starting inside it.
              monthStart: { $lte: to },
              monthEnd: { $gte: from },
            },
          },
          {
            $project: {
              _id: 0,
              month: 1,
              uniqueVisitors: 1,
            },
          },
          { $sort: { month: 1 } },
        ]),
        AnalyticsEventModel.aggregate([
          { $match: visitDateFilter },
          {
            $group: {
              _id: {
                month: {
                  $dateToString: {
                    format: "%Y-%m",
                    date: "$occurredAt",
                  },
                },
              },
              visitors: { $addToSet: "$identityKey" },
            },
          },
          {
            $project: {
              _id: 0,
              month: "$_id.month",
              uniqueVisitors: { $size: "$visitors" },
            },
          },
          { $sort: { month: 1 } },
        ]),
        AnalyticsEventModel.aggregate([
          { $match: visitDateFilter },
          {
            $group: {
              _id: {
                day: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$occurredAt",
                  },
                },
              },
              visits: {
                $sum: {
                  $cond: [{ $eq: ["$eventType", AnalyticsEventType.PAGE_VIEW] }, 1, 0],
                },
              },
              visitors: { $addToSet: "$identityKey" },
            },
          },
          {
            $project: {
              _id: 0,
              day: "$_id.day",
              visits: 1,
              uniqueVisitors: { $size: "$visitors" },
            },
          },
          { $sort: { day: 1 } },
        ]),
        AnalyticsEventModel.aggregate([
          {
            $match: {
              occurredAt: { $gte: from, $lte: to },
              eventType: AnalyticsEventType.FEATURE_USAGE,
              feature: { $in: ["smart-search", "hybrid-search"] },
            },
          },
          { $group: { _id: "$feature", count: { $sum: 1 } } },
        ]),
        this.getFeatureUsageTrend({ from, to }),
        VisitorSessionModel.countDocuments({
          lastSeenAt: {
            $gte: new Date(Date.now() - activeWindowMinutes * 60 * 1000),
          },
        }),
      ]);

    const usage = {
      "smart-search": 0,
      "hybrid-search": 0,
    };

    featureTotals.forEach((row) => {
      usage[row._id] = row.count;
    });

    const monthlyMap = new Map();
    monthlyRowsArchived.forEach((row) => {
      monthlyMap.set(row.month, row.uniqueVisitors);
    });
    monthlyRowsRaw.forEach((row) => {
      monthlyMap.set(row.month, row.uniqueVisitors);
    });

    const monthlyUniqueVisitors = Array.from(monthlyMap.entries())
      .map(([month, uniqueVisitors]) => ({ month, uniqueVisitors }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      totalVisits,
      uniqueVisitors: uniqueVisitorsRows[0]?.count || 0,
      currentMonthUniqueVisitors: currentMonthUniqueRows[0]?.count || 0,
      activeUsersNow: activeNow,
      featureUsage: usage,
      featureUsageDaily,
      monthlyUniqueVisitors,
      daily: dailyRows,
    };
  }

  async archiveMonthFromRaw(monthDate) {
    const { monthStart, monthEnd } = this.#monthRange(monthDate);
    const month = this.#monthKey(monthStart);

    const [visits, uniqueRows, featureRows] = await Promise.all([
      AnalyticsEventModel.countDocuments({
        occurredAt: { $gte: monthStart, $lt: monthEnd },
        eventType: AnalyticsEventType.PAGE_VIEW,
      }),
      AnalyticsEventModel.aggregate([
        {
          $match: {
            occurredAt: { $gte: monthStart, $lt: monthEnd },
            eventType: AnalyticsEventType.PAGE_VIEW,
          },
        },
        { $group: { _id: "$identityKey" } },
        { $count: "count" },
      ]),
      AnalyticsEventModel.aggregate([
        {
          $match: {
            occurredAt: { $gte: monthStart, $lt: monthEnd },
            eventType: AnalyticsEventType.FEATURE_USAGE,
            feature: { $in: ["smart-search", "hybrid-search"] },
          },
        },
        { $group: { _id: "$feature", count: { $sum: 1 } } },
      ]),
    ]);

    const featureMap = {
      "smart-search": 0,
      "hybrid-search": 0,
    };
    featureRows.forEach((row) => {
      featureMap[row._id] = row.count;
    });

    await AnalyticsMonthlyAggregateModel.findOneAndUpdate(
      { month },
      {
        $set: {
          month,
          monthStart,
          monthEnd,
          visits,
          uniqueVisitors: uniqueRows[0]?.count || 0,
          smartSearchUses: featureMap["smart-search"],
          hybridSearchUses: featureMap["hybrid-search"],
          source: "raw-events",
        },
      },
      { upsert: true, returnDocument: "after" },
    ).exec();
  }

  async archiveMonthsBefore(cutoffMonthStart) {
    const months = await AnalyticsEventModel.aggregate([
      {
        $match: {
          occurredAt: { $lt: cutoffMonthStart },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$occurredAt" },
            month: { $month: "$occurredAt" },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    for (const row of months) {
      const monthDate = new Date(row._id.year, row._id.month - 1, 1);
      await this.archiveMonthFromRaw(monthDate);
    }

    return months.length;
  }

  async cleanupRawEventsOlderThan(cutoffDate) {
    const result = await AnalyticsEventModel.deleteMany({
      occurredAt: { $lt: cutoffDate },
    });
    return result.deletedCount || 0;
  }

  async cleanupStaleVisitorSessionsOlderThan(cutoffDate) {
    const result = await VisitorSessionModel.deleteMany({
      lastSeenAt: { $lt: cutoffDate },
    });
    return result.deletedCount || 0;
  }
}
