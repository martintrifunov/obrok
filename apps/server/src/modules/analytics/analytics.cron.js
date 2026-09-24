import cron from "node-cron";

export const startAnalyticsCron = (analyticsService) => {
  const retentionDays = Number(process.env.ANALYTICS_RAW_RETENTION_DAYS || 90);

  const task = cron.schedule("30 2 * * *", async () => {
    try {
      const result = await analyticsService.cleanupRawEvents({ retentionDays });
      console.log(
        `[AnalyticsCron] Cleanup complete (retention=${retentionDays}d): events=${result.eventsDeleted}, sessions=${result.sessionsDeleted}`,
      );
    } catch (err) {
      console.error("[AnalyticsCron] Cleanup failed:", err.message);
    }
  });

  console.log(
    `[AnalyticsCron] Scheduled daily cleanup at 02:30 (raw retention ${retentionDays} days).`,
  );

  return task;
};
