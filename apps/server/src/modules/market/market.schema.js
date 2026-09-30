import { z } from "zod";
import { messages } from "../../shared/schemas/messages.js";
import { zodObjectId } from "../../shared/schemas/zodObjectId.js";
import { paginationWithAllSchema } from "../../shared/schemas/paginationSchema.js";

export const marketQuerySchema = paginationWithAllSchema.extend({
  name: z.string().optional(),
  chainId: zodObjectId.optional(),
});

export const createMarketSchema = z.object({
  name: z
    .string(messages("Market name is required."))
    .min(1, "Market name cannot be empty."),
  location: z
    .array(
      z.number(messages("Coordinate is required.", "Coordinate must be a number.")),
      messages("Location coordinates are required."),
    )
    .length(2, "Location must contain exactly 2 coordinates."),
  chain: zodObjectId,
});

export const updateMarketSchema = z.object({
  id: zodObjectId,
  name: z.string().min(1).optional(),
  location: z.array(z.number()).length(2).optional(),
  chain: zodObjectId.optional(),
});

export const deleteMarketSchema = z.object({
  id: zodObjectId,
});

export const marketParamsSchema = z.object({
  id: zodObjectId,
});
