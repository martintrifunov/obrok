import { z } from "zod";
import { dateField } from "../../shared/schemas/messages.js";
import { zodObjectId } from "../../shared/schemas/zodObjectId.js";

export const createReportSchema = z
  .object({
    chainId: zodObjectId.optional(),
    marketId: zodObjectId.optional(),
    from: dateField("From date is required.", "From date is invalid."),
    to: dateField("To date is required.", "To date is invalid."),
  })
  .refine((data) => data.from <= data.to, {
    message: "From date must be before or equal to To date.",
    path: ["from"],
  });

export const reportJobIdSchema = z.object({
  jobId: zodObjectId,
});
