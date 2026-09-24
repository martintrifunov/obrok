import { z } from "zod";
import { messages } from "../../shared/schemas/messages.js";

export const updateFeatureFlagSchema = z.object({
  key: z.string().min(1, "Key is required."),
  enabled: z.boolean(messages("Enabled is required.")),
  description: z.string().optional(),
});
