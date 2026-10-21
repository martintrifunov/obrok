import { z } from "zod";
import { messages } from "./messages.js";

export const zodObjectId = z
  .string(messages("This field is required."))
  .refine((val) => /^[a-f\d]{24}$/i.test(val), {
    message: "Invalid ID format.",
  });

/** Body or params that only carry a document id (delete, get by id). */
export const idSchema = z.object({ id: zodObjectId });
