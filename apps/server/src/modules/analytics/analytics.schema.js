import { z } from "zod";

export const analyticsHeartbeatSchema = z.object({
  path: z.string().trim().max(2048).optional().nullable(),
  isPageView: z.boolean().optional(),
});

export const analyticsDaysQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).optional(),
});
