import { Parser } from "@json2csv/plainjs";
import { NotFoundError } from "../../shared/errors/NotFoundError.js";
import { buildPaginationMeta } from "../../shared/utils/buildPaginationMeta.js";

export class ChainService {
  constructor(
    chainRepository,
    imageRepository,
    marketRepository,
    marketProductRepository,
    imageService = null,
    orphanProductService = null,
  ) {
    this.chainRepository = chainRepository;
    this.imageRepository = imageRepository;
    this.marketRepository = marketRepository;
    this.marketProductRepository = marketProductRepository;
    this.imageService = imageService;
    this.orphanProductService = orphanProductService;
  }

  async getAllChains({ page, limit, name }) {
    const filter = {};
    if (name) filter.name = name;

    const { docs, total } = await this.chainRepository.findAll({
      page,
      limit,
      filter,
    });
    return {
      data: docs,
      pagination: buildPaginationMeta({ total, page, limit }),
    };
  }

  async getChainById(id) {
    const chain = await this.chainRepository.findById(id);
    if (!chain) throw new NotFoundError(`No chain matches ID ${id}.`);
    return chain;
  }

  async createChain({ name, image }) {
    const imageExists = await this.imageRepository.findById(image);
    if (!imageExists) throw new NotFoundError("Selected image not found.");
    return this.chainRepository.create({ name, image });
  }

  async updateChain(id, { name, image }) {
    const chain = await this.chainRepository.findById(id);
    if (!chain) throw new NotFoundError(`No chain matches ID ${id}.`);

    if (name) chain.name = name;

    if (image) {
      const imageExists = await this.imageRepository.findById(image);
      if (!imageExists) throw new NotFoundError("Selected image not found.");
      chain.image = image;
    }

    return this.chainRepository.save(chain);
  }

  async deleteChain(id) {
    const chain = await this.chainRepository.findById(id);
    if (!chain) throw new NotFoundError(`No chain matches ID ${id}.`);

    const markets = await this.marketRepository.findByChain(id);
    const productIds = [];
    for (const market of markets) {
      productIds.push(
        ...(await this.marketProductRepository.findProductIdsByMarket(market._id)),
      );
      await this.marketProductRepository.deleteByMarket(market._id);
      await this.marketRepository.delete(market);
    }
    await this.chainRepository.delete(chain);
    await this.orphanProductService?.removeOrphans(productIds);
    await this.imageService?.deleteIfUnused(chain.image?._id ?? chain.image);
  }

  async generateReport() {
    const marketsData = await this.marketRepository.findAllForReport();

    const rows = marketsData.map(
      ({ name, location, chain, marketProducts }) => {
        const productsData = marketProducts?.length
          ? marketProducts
              .map((mp) => `${mp.product.title}, ${mp.price} ден`)
              .join("\n")
          : "";
        return {
          market: name,
          chain: chain?.name || "",
          location: location.join(", "),
          image: chain?.image
            ? `${process.env.SERVER_ORIGIN}/uploads/${chain.image.filename}`
            : "",
          products: productsData,
        };
      },
    );

    const parser = new Parser({
      fields: ["market", "chain", "location", "image", "products"],
    });

    return parser.parse(rows);
  }
}
