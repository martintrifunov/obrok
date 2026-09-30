export class OrphanProductService {
  constructor(productRepository, marketProductRepository, productEmbeddingRepository) {
    this.productRepository = productRepository;
    this.marketProductRepository = marketProductRepository;
    this.productEmbeddingRepository = productEmbeddingRepository;
  }

  /**
   * @param {Iterable<unknown>} candidateIds products that may have lost their last price
   * @returns {Promise<number>} products deleted
   */
  async removeOrphans(candidateIds) {
    const ids = [...new Map([...candidateIds].map((id) => [String(id), id])).values()];
    if (!ids.length) return 0;

    const priced = new Set(
      (await this.marketProductRepository.findPricedProductIds(ids)).map(String),
    );
    const unpriced = ids.filter((id) => !priced.has(String(id)));
    if (!unpriced.length) return 0;

    const deletable = await this.productRepository.findScraperMadeIds(unpriced);
    if (!deletable.length) return 0;

    await this.productEmbeddingRepository.deleteByProducts(deletable);
    const { deletedCount } = await this.productRepository.deleteScraperMadeByIds(deletable);
    return deletedCount;
  }

  async sweep() {
    return this.removeOrphans(await this.productRepository.findUnpricedScraperMadeIds());
  }
}
