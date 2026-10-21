import { z } from "zod";

export const smartSearchQuerySchema = z.object({
  q: z.string().min(1, "Search query is required.").max(200),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  budgetOnly: z.coerce.boolean().default(false),
});
