import { z } from "zod";
import { dateField, messages } from "../../shared/schemas/messages.js";
import { zodObjectId } from "../../shared/schemas/zodObjectId.js";
import { paginationSchema } from "../../shared/schemas/paginationSchema.js";

export const publicHolidayQuerySchema = paginationSchema.extend({
  name: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const createPublicHolidaySchema = z.object({
  name: z
    .string(messages("Holiday name is required."))
    .min(1, "Holiday name cannot be empty."),
  date: dateField("Holiday date is required.", "Holiday date is invalid."),
});

export const updatePublicHolidaySchema = z.object({
  id: zodObjectId,
  name: z.string().min(1).optional(),
  date: z.coerce.date().optional(),
});

export const deletePublicHolidaySchema = z.object({
  id: zodObjectId,
});

export const publicHolidayParamsSchema = z.object({
  id: zodObjectId,
});
