import { AnalyticsEventType } from "./analytics.model.js";
import { Parser } from "@json2csv/plainjs";

export class AnalyticsService {
  constructor(analyticsRepository) {
    this.analyticsRepository = analyticsRepository;
  }

  #identityKey(visitorId, userId) {
    return userId ? `user:${userId}` : `visitor:${visitorId}`;
  }

  async trackHeartbeat({ visitorId, userId, path, isPageView = false }) {
    const seenAt = new Date();
    const identityKey = this.#identityKey(visitorId, userId);

    await this.analyticsRepository.upsertVisitorSession({
      visitorId,
      userId,
      path,
      seenAt,
    });

    // Count visits only on route/page transitions, not every keepalive ping.
    if (isPageView && path) {
      await this.analyticsRepository.createEvent({
        visitorId,
        userId: userId || null,
        identityKey,
        eventType: AnalyticsEventType.PAGE_VIEW,
        path,
        occurredAt: seenAt,
      });
    }

    return { ok: true };
  }

  async trackFeatureUsage({ visitorId, userId, feature, path }) {
    if (!visitorId || !feature) return;

    await this.analyticsRepository.createEvent({
      visitorId,
      userId: userId || null,
      identityKey: this.#identityKey(visitorId, userId),
      eventType: AnalyticsEventType.FEATURE_USAGE,
      feature,
      path: path || null,
      occurredAt: new Date(),
    });
  }

  async getSummary({ days = 30, activeWindowMinutes = 5 }) {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days + 1);
    from.setHours(0, 0, 0, 0);

    const summary = await this.analyticsRepository.getSummary({
      from,
      to,
      activeWindowMinutes,
    });

    return {
      range: {
        from,
        to,
        days,
      },
      ...summary,
    };
  }

  async getFeatureUsageTrend({ days = 30 }) {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days + 1);
    from.setHours(0, 0, 0, 0);

    const daily = await this.analyticsRepository.getFeatureUsageTrend({ from, to });

    return {
      range: { from, to, days },
      daily,
    };
  }

  async exportSummaryCsv({ days = 30, activeWindowMinutes = 5 }) {
    const summary = await this.getSummary({ days, activeWindowMinutes });

    const dailyMap = new Map(summary.daily.map((row) => [row.day, row]));
    const featureMap = new Map(summary.featureUsageDaily.map((row) => [row.day, row]));
    const allDays = new Set([...dailyMap.keys(), ...featureMap.keys()]);

    const rows = Array.from(allDays)
      .sort()
      .map((day) => ({
        day,
        visits: dailyMap.get(day)?.visits || 0,
        uniqueVisitors: dailyMap.get(day)?.uniqueVisitors || 0,
        smartSearchUses: featureMap.get(day)?.smartSearch || 0,
        hybridSearchUses: featureMap.get(day)?.hybridSearch || 0,
      }));

    const parser = new Parser({
      fields: ["day", "visits", "uniqueVisitors", "smartSearchUses", "hybridSearchUses"],
    });

    const csv = parser.parse(rows.length ? rows : [
      {
        day: "",
        visits: 0,
        uniqueVisitors: 0,
        smartSearchUses: 0,
        hybridSearchUses: 0,
      },
    ]);

    return {
      fileName: `insights-${summary.range.from.toISOString().slice(0, 10)}-to-${summary.range.to.toISOString().slice(0, 10)}.csv`,
      csv,
    };
  }

  async cleanupRawEvents({ retentionDays = 90 }) {
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
    const cutoffMonthStart = new Date(cutoffDate.getFullYear(), cutoffDate.getMonth(), 1);

    const archivedMonths = await this.analyticsRepository.archiveMonthsBefore(cutoffMonthStart);

    const [eventsDeleted, sessionsDeleted] = await Promise.all([
      this.analyticsRepository.cleanupRawEventsOlderThan(cutoffMonthStart),
      this.analyticsRepository.cleanupStaleVisitorSessionsOlderThan(cutoffDate),
    ]);

    return {
      cutoffDate,
      cutoffMonthStart,
      retentionDays,
      archivedMonths,
      eventsDeleted,
      sessionsDeleted,
    };
  }
}
