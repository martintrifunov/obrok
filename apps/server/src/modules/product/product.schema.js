import { z } from "zod";
import { zodObjectId } from "../../shared/schemas/zodObjectId.js";
import { paginationSchema } from "../../shared/schemas/paginationSchema.js";

export const productQuerySchema = paginationSchema.extend({
  title: z.string().optional(),
  category: z.string().optional(),
  marketId: zodObjectId.optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
});

export const createProductSchema = z
  .object({
    title: z
      .string({
        required_error: "Product title is required.",
        invalid_type_error: "Product title is required.",
      })
      .min(1, "Product title cannot be empty."),
    description: z.string().min(1, "Description cannot be empty.").optional(),
    category: z.string().min(1, "Category cannot be empty.").optional(),
    image: zodObjectId.optional(),
    market: zodObjectId.optional(),
    price: z.number().positive("Price must be greater than 0.").optional(),
  })
  .refine(
    (data) => !(data.market && !data.price) && !(data.price && !data.market),
    {
      message: "Market and price must be provided together.",
      path: ["market"],
    },
  );

export const updateProductSchema = z.object({
  id: zodObjectId,
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  // null clears the image; omitted leaves it unchanged.
  image: zodObjectId.nullable().optional(),
  // Only hand-added prices (not scraped ones) can be changed or removed.
  prices: z
    .array(
      z.object({
        market: zodObjectId,
        price: z.number().positive("Price must be greater than 0."),
      }),
    )
    .optional(),
  removedMarkets: z.array(zodObjectId).optional(),
  // New hand-added prices at markets the product isn't sold at yet.
  addedPrices: z
    .array(
      z.object({
        market: zodObjectId,
        price: z.number().positive("Price must be greater than 0."),
      }),
    )
    .refine(
      (entries) => new Set(entries.map((e) => e.market)).size === entries.length,
      "Each market can only be added once.",
    )
    .optional(),
});

export const deleteProductSchema = z.object({
  id: zodObjectId,
});

export const productParamsSchema = z.object({
  id: zodObjectId,
});

export const categoriesQuerySchema = z.object({
  marketId: zodObjectId.optional(),
});
