/**
 * Removes products left with no price rows (after stale price cleanup or a
 * market/chain delete), together with their embeddings. Only scraper-made
 * products are removed: anything with a description or image was edited by an
 * admin and is kept even without prices.
 */
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

  /** Removes every orphan that already exists. */
  async sweep() {
    return this.removeOrphans(await this.productRepository.findUnpricedScraperMadeIds());
  }
}
