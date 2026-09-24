import { NotFoundError } from "../../shared/errors/NotFoundError.js";
import { buildPaginationMeta } from "../../shared/utils/buildPaginationMeta.js";

export class ProductService {
  constructor(
    productRepository,
    marketRepository,
    imageRepository,
    marketProductRepository,
    productEmbeddingRepository,
  ) {
    this.productRepository = productRepository;
    this.marketRepository = marketRepository;
    this.imageRepository = imageRepository;
    this.marketProductRepository = marketProductRepository;
    this.productEmbeddingRepository = productEmbeddingRepository;
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

  async updateProduct(id, { title, description, category, image }) {
    const product = await this.productRepository.findById(id);
    if (!product) throw new NotFoundError(`No product matches ID ${id}.`);

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

    return this.productRepository.save(product);
  }

  async deleteProduct(id) {
    const product = await this.productRepository.findById(id);
    if (!product) throw new NotFoundError(`No product matches ID ${id}.`);

    await this.marketProductRepository.deleteByProduct(id);
    await this.productEmbeddingRepository.deleteByProduct(id);
    await this.productRepository.delete(product);
  }

  async getCategories(marketId) {
    if (marketId) {
      return this.marketProductRepository.getUniqueCategories(marketId);
    }
    return this.productRepository.getUniqueCategories();
  }
}
