import crypto from "crypto";
import { ProductModel } from "../product/product.model.js";

const BATCH_SIZE = 50;
const CURSOR_BATCH_SIZE = 500;

export async function syncProductEmbeddings({
  embeddingService,
  productEmbeddingRepository,
  featureFlagService,
  logger = console,
  logPrefix = "[EmbeddingSync]",
}) {
  try {
    if (!embeddingService?.isAvailable()) {
      logger.log(`${logPrefix} Embedding service not available, skipping.`);
      return;
    }

    if (featureFlagService) {
      const aiSearchEnabled = await featureFlagService.isEnabled("ai-search");
      if (!aiSearchEnabled) {
        logger.log(`${logPrefix} ai-search feature flag disabled, skipping embeddings.`);
        return;
      }
    }

    const totalProducts = await ProductModel.countDocuments().exec();
    logger.log(`${logPrefix} Generating embeddings for ${totalProducts} products...`);

    const existing = await productEmbeddingRepository.findAllHashes();
    const existingMap = new Map(
      existing.map((entry) => [entry.product.toString(), entry.textHash]),
    );

    const toEmbed = [];
    const cursor = ProductModel.find()
      .select("_id title category")
      .lean()
      .cursor({ batchSize: CURSOR_BATCH_SIZE });

    for await (const product of cursor) {
      const text = product.category
        ? `${product.title} ${product.category}`
        : product.title;
      const hash = crypto.createHash("md5").update(text).digest("hex");

      if (existingMap.get(product._id.toString()) === hash) continue;

      toEmbed.push({ productId: product._id, text, hash });
    }

    logger.log(
      `${logPrefix} ${toEmbed.length} products need new embeddings ` +
        `(${totalProducts - toEmbed.length} up-to-date).`,
    );

    if (toEmbed.length === 0) return;

    let processed = 0;
    for (let index = 0; index < toEmbed.length; index += BATCH_SIZE) {
      const batch = toEmbed.slice(index, index + BATCH_SIZE);
      const texts = batch.map((entry) => entry.text);
      const embeddings = await embeddingService.generateBatchEmbeddings(texts);

      const entries = batch.map((entry, batchIndex) => ({
        productId: entry.productId,
        embedding: embeddings[batchIndex],
        textHash: entry.hash,
      }));

      await productEmbeddingRepository.bulkUpsert(entries);
      processed += batch.length;

      if (processed % 500 === 0 || processed === toEmbed.length) {
        logger.log(`${logPrefix} Embeddings: ${processed}/${toEmbed.length}`);
      }
    }

    logger.log(`${logPrefix} Embedding generation complete. ${processed} embeddings created.`);
  } catch (err) {
    logger.error(`${logPrefix} Embedding generation failed: ${err.message}`);
  }
}