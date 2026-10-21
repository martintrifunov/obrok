export class SmartSearchController {
  constructor(smartSearchService) {
    this.smartSearchService = smartSearchService;
  }

  getBudget = async (req, res) => {
    const result = await this.smartSearchService.getBudget();
    res.status(200).json(result);
  };

  search = async (req, res) => {
    const result = await this.smartSearchService.search({
      ...req.body,
      // Admins' own use would skew the insights they read.
      analytics:
        req.role === "admin"
          ? null
          : { visitorId: req.visitorId, userId: req.user || null, path: req.originalUrl },
    });
    res.status(200).json(result);
  };
}
