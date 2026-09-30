import { ProductEmbeddingModel } from "./product-embedding.model.js";
import { encodeEmbedding } from "./embedding-codec.js";

const PACK_BATCH_SIZE = 500;

export class ProductEmbeddingRepository {
  async findAllHashes() {
    return ProductEmbeddingModel.find()
      .select("product textHash")
      .lean()
      .exec();
  }

  streamAll() {
    // The native cursor skips Mongoose's per-document work on a 93k-row scan.
    return ProductEmbeddingModel.collection.find(
      {},
      { projection: { _id: 0, product: 1, embedding: 1 }, batchSize: 1000 },
    );
  }

  /** Changes whenever an embedding is added, re-embedded or deleted. */
  async latestVersion() {
    const [latest, count] = await Promise.all([
      ProductEmbeddingModel.findOne().sort({ updatedAt: -1 }).select("updatedAt").lean().exec(),
      ProductEmbeddingModel.estimatedDocumentCount().exec(),
    ]);
    return `${count}:${latest?.updatedAt?.getTime() ?? 0}`;
  }

  async bulkUpsert(entries) {
    if (!entries.length) return;
    const ops = entries.map(({ productId, embedding, textHash }) => ({
      updateOne: {
        filter: { product: productId },
        update: { $set: { embedding: encodeEmbedding(embedding), textHash } },
        upsert: true,
      },
    }));
    return ProductEmbeddingModel.bulkWrite(ops, { ordered: false });
  }

  /**
   * One-time migration from number arrays to packed float32 bytes. Idempotent:
   * only array embeddings are touched. updatedAt is left alone so the vector
   * index doesn't see a change.
   * @returns {Promise<number>} embeddings converted
   */
  async packLegacyEmbeddings() {
    const cursor = ProductEmbeddingModel.collection.find(
      { embedding: { $type: "array" } },
      { projection: { embedding: 1 }, batchSize: PACK_BATCH_SIZE },
    );
    let converted = 0;
    let ops = [];
    for await (const doc of cursor) {
      ops.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { embedding: encodeEmbedding(doc.embedding) } },
        },
      });
      if (ops.length === PACK_BATCH_SIZE) {
        await ProductEmbeddingModel.collection.bulkWrite(ops, { ordered: false });
        converted += ops.length;
        ops = [];
      }
    }
    if (ops.length) {
      await ProductEmbeddingModel.collection.bulkWrite(ops, { ordered: false });
      converted += ops.length;
    }
    return converted;
  }

  async deleteByProduct(productId, options = {}) {
    return ProductEmbeddingModel.deleteOne({ product: productId }, options).exec();
  }

  async deleteByProducts(productIds) {
    if (!productIds.length) return { deletedCount: 0 };
    return ProductEmbeddingModel.deleteMany({ product: { $in: productIds } }).exec();
  }

  async count() {
    return ProductEmbeddingModel.countDocuments().exec();
  }
}
