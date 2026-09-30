import { z } from "zod";

/**
 * @param {string} required message when the value is missing
 * @param {string} [invalid] message when it has the wrong type (defaults to `required`)
 */
export const messages = (required, invalid = required) => ({
  error: (/** @type {{ input: unknown }} */ issue) =>
    issue.input === undefined ? required : invalid,
});

/**
 * @param {string} required
 * @param {string} [invalid]
 */
export const dateField = (required, invalid = required) =>
  z.preprocess(
    (value) =>
      typeof value === "string" || typeof value === "number" ? new Date(value) : value,
    z.date(messages(required, invalid)),
  );
