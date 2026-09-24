import { z } from "zod";
import { messages } from "../../shared/schemas/messages.js";

export const loginSchema = z.object({
  username: z
    .string(messages("Username is required."))
    .min(1, "Username is required."),
  password: z
    .string(messages("Password is required."))
    .min(1, "Password is required."),
});
