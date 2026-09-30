import { NotFoundError } from "../../shared/errors/NotFoundError.js";
import { buildPaginationMeta } from "../../shared/utils/buildPaginationMeta.js";

export class MarketService {
  constructor(
    marketRepository,
    chainRepository,
    marketProductRepository,
    orphanProductService = null,
  ) {
    this.marketRepository = marketRepository;
    this.chainRepository = chainRepository;
    this.marketProductRepository = marketProductRepository;
    this.orphanProductService = orphanProductService;
  }

  async getAllMarkets({ page, limit, name, chainId }) {
    const filter = {};
    if (name) filter.name = name;
    if (chainId) filter.chain = chainId;

    const { docs, total } = await this.marketRepository.findAll({
      page,
      limit,
      filter,
    });
    return {
      data: docs,
      pagination: buildPaginationMeta({ total, page, limit }),
    };
  }

  async getMarketById(id) {
    const market = await this.marketRepository.findById(id);
    if (!market) throw new NotFoundError(`No market matches ID ${id}.`);
    return market;
  }

  async createMarket({ name, location, chain }) {
    const chainExists = await this.chainRepository.findById(chain);
    if (!chainExists) throw new NotFoundError("Chain not found.");
    return this.marketRepository.create({ name, location, chain });
  }

  async updateMarket(id, { name, location, chain }) {
    const market = await this.marketRepository.findById(id);
    if (!market) throw new NotFoundError(`No market matches ID ${id}.`);

    if (name) market.name = name;
    if (location) market.location = location;

    if (chain) {
      const chainExists = await this.chainRepository.findById(chain);
      if (!chainExists) throw new NotFoundError("Chain not found.");
      market.chain = chain;
    }

    return this.marketRepository.save(market);
  }

  async deleteMarket(id) {
    const market = await this.marketRepository.findById(id);
    if (!market) throw new NotFoundError(`No market matches ID ${id}.`);

    const productIds = await this.marketProductRepository.findProductIdsByMarket(id);
    await this.marketProductRepository.deleteByMarket(id);
    await this.marketRepository.delete(market);
    await this.orphanProductService?.removeOrphans(productIds);
  }
}
