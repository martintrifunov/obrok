import { z } from "zod";
import { messages } from "../../shared/schemas/messages.js";
import { zodObjectId } from "../../shared/schemas/zodObjectId.js";
import { paginationWithAllSchema } from "../../shared/schemas/paginationSchema.js";

export const chainQuerySchema = paginationWithAllSchema.extend({
  name: z.string().optional(),
});

export const createChainSchema = z.object({
  name: z
    .string(messages("Chain name is required."))
    .min(1, "Chain name cannot be empty."),
  image: zodObjectId,
});

export const updateChainSchema = z.object({
  id: zodObjectId,
  name: z.string().min(1).optional(),
  image: zodObjectId.optional(),
});

export const deleteChainSchema = z.object({
  id: zodObjectId,
});

export const chainParamsSchema = z.object({
  id: zodObjectId,
});
