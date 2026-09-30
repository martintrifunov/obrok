import mongoose from "mongoose";

const ProductEmbeddingSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
    },
    // Packed float32 bytes (see embedding-codec.js); older rows may still be number arrays.
    embedding: { type: Buffer, required: true },
    textHash: { type: String, required: true },
  },
  { timestamps: true },
);

ProductEmbeddingSchema.index({ updatedAt: -1 });

export const ProductEmbeddingModel = mongoose.model(
  "ProductEmbedding",
  ProductEmbeddingSchema,
  "product_embeddings",
);
