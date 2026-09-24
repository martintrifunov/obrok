import { NotFoundError } from "../../shared/errors/NotFoundError.js";
import { ValidationError } from "../../shared/errors/ValidationError.js";
import { buildPaginationMeta } from "../../shared/utils/buildPaginationMeta.js";

export class ProductService {
  constructor(
    productRepository,
    marketRepository,
    imageRepository,
    marketProductRepository,
    productEmbeddingRepository,
    imageService = null,
  ) {
    this.productRepository = productRepository;
    this.marketRepository = marketRepository;
    this.imageRepository = imageRepository;
    this.marketProductRepository = marketProductRepository;
    this.productEmbeddingRepository = productEmbeddingRepository;
    this.imageService = imageService;
  }

  async getAllProducts({
    page = 1,
    limit = 10,
    title,
    category,
    marketId,
    minPrice,
    maxPrice,
  }) {
    if (marketId) {
      const filter = {};
      if (title) filter.title = title;
      if (category) filter.category = category;
      if (minPrice !== undefined) filter.minPrice = minPrice;
      if (maxPrice !== undefined) filter.maxPrice = maxPrice;

      const { docs, total } = await this.marketProductRepository.findByMarket({
        marketId,
        page,
        limit,
        filter,
      });

      return {
        data: docs,
        pagination: buildPaginationMeta({ total, page, limit }),
      };
    }

    const filter = {};
    if (title) filter.title = title;
    if (category) filter.category = category;

    const { docs, total } = await this.productRepository.findAll({
      page,
      limit,
      filter,
    });

    return {
      data: docs,
      pagination: buildPaginationMeta({ total, page, limit }),
    };
  }

  async getProductById(id) {
    const product = await this.productRepository.findById(id);
    if (!product) throw new NotFoundError(`No product matches ID ${id}.`);
    return product;
  }

  async createProduct({ title, description, category, market, price, image }) {
    if (market) {
      const foundMarket = await this.marketRepository.findById(market);
      if (!foundMarket) throw new NotFoundError("Market not found.");
    }

    if (image) {
      const imageExists = await this.imageRepository.findById(image);
      if (!imageExists) throw new NotFoundError("Selected image not found.");
    }

    const product = await this.productRepository.create({
      title,
      description,
      category,
      image: image || null,
    });

    if (market && price !== undefined) {
      await this.marketProductRepository.create({
        market,
        product: product._id,
        price,
      });
    }

    return product;
  }

  async updateProduct(
    id,
    {
      title,
      description,
      category,
      image,
      prices = [],
      removedMarkets = [],
      addedPrices = [],
    },
  ) {
    const product = await this.productRepository.findById(id);
    if (!product) throw new NotFoundError(`No product matches ID ${id}.`);

    // Validate price changes before saving anything, so a rejected request changes nothing.
    const changedMarkets = [...prices.map((p) => p.market), ...removedMarkets];
    if (changedMarkets.length) {
      const manual = await this.marketProductRepository.findManualByProduct(
        id,
        changedMarkets,
      );
      const manualMarkets = new Set(manual.map((mp) => mp.market.toString()));
      if (changedMarkets.some((m) => !manualMarkets.has(m.toString()))) {
        throw new ValidationError({
          prices:
            "Only hand-added prices can be changed. Scraped prices are updated by the scraper.",
        });
      }
    }

    if (addedPrices.length) await this.#validateAddedPrices(id, addedPrices, changedMarkets);

    if (title) product.title = title;
    if (description) product.description = description;
    if (category) product.category = category;

    if (image === null) {
      product.image = null;
    } else if (image) {
      const imageExists = await this.imageRepository.findById(image);
      if (!imageExists) throw new NotFoundError("Selected image not found.");
      product.image = image;
    }

    const saved = await this.productRepository.save(product);
    await this.marketProductRepository.updateManualPrices(id, prices);
    await this.marketProductRepository.deleteManualByMarkets(id, removedMarkets);
    await this.marketProductRepository.insertManualPrices(id, addedPrices);
    return saved;
  }

  async #validateAddedPrices(productId, addedPrices, changedMarkets) {
    const added = addedPrices.map((p) => p.market.toString());
    const changed = new Set(changedMarkets.map((m) => m.toString()));
    if (added.some((m) => changed.has(m))) {
      throw new ValidationError({
        addedPrices: "A market can't be added and changed or removed in the same save.",
      });
    }

    const markets = await Promise.all(added.map((m) => this.marketRepository.findById(m)));
    if (markets.some((m) => !m)) {
      throw new ValidationError({ addedPrices: "One of the selected markets no longer exists." });
    }

    const existing = await this.marketProductRepository.findByProductAndMarkets(productId, added);
    if (existing.length) {
      throw new ValidationError({
        addedPrices: "This product already has a price at one of the selected markets.",
      });
    }
  }

  async deleteProduct(id) {
    const product = await this.productRepository.findById(id);
    if (!product) throw new NotFoundError(`No product matches ID ${id}.`);

    await this.marketProductRepository.deleteByProduct(id);
    await this.productEmbeddingRepository.deleteByProduct(id);
    await this.productRepository.delete(product);
    await this.imageService?.deleteIfUnused(product.image?._id ?? product.image);
  }

  async getCategories(marketId) {
    if (marketId) {
      return this.marketProductRepository.getUniqueCategories(marketId);
    }
    return this.productRepository.getUniqueCategories();
  }
}
