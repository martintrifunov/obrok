export class AnalyticsController {
  constructor(analyticsService) {
    this.analyticsService = analyticsService;
  }

  heartbeat = async (req, res) => {
    const result = await this.analyticsService.trackHeartbeat({
      visitorId: req.visitorId,
      userId: req.user || null,
      path: req.body?.path || req.path,
      isPageView: req.body?.isPageView === true,
    });

    res.status(200).json(result);
  };

  summary = async (req, res) => {
    const result = await this.analyticsService.getSummary({ days: req.query.days });
    res.status(200).json(result);
  };

  featureTrends = async (req, res) => {
    const result = await this.analyticsService.getFeatureUsageTrend({ days: req.query.days });
    res.status(200).json(result);
  };

  exportCsv = async (req, res) => {
    const { csv, fileName } = await this.analyticsService.exportSummaryCsv({ days: req.query.days });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.status(200).send(csv);
  };
}
