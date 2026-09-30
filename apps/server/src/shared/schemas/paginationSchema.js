import { z } from "zod";

export const MAX_PAGE_SIZE = 100;

const page = z.coerce
  .number()
  .int()
  .min(1, "Page must be at least 1.")
  .default(1);

export const paginationSchema = z.object({
  page,
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit must be at least 1.")
    .max(MAX_PAGE_SIZE, `Limit must be at most ${MAX_PAGE_SIZE}.`)
    .default(10),
});

/**
 * Like paginationSchema, but limit=0 returns every row. Only for small,
 * cheap collections (chains, markets, images) that the map and admin
 * dropdowns load in full; products stay capped since each carries all its prices.
 */
export const paginationWithAllSchema = z.object({
  page,
  limit: z.coerce
    .number()
    .int()
    .min(0, "Limit must be 0 or greater.")
    .max(MAX_PAGE_SIZE, `Limit must be at most ${MAX_PAGE_SIZE}.`)
    .default(10),
});
