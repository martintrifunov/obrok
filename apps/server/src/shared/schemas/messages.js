import { z } from "zod";

/**
 * Zod 4 dropped `required_error` / `invalid_type_error`; they're silently ignored.
 * This builds the `error` option that restores both messages.
 * @param {string} required message when the value is missing
 * @param {string} [invalid] message when it has the wrong type (defaults to `required`)
 */
export const messages = (required, invalid = required) => ({
  error: (/** @type {{ input: unknown }} */ issue) =>
    issue.input === undefined ? required : invalid,
});

/**
 * A date accepting ISO strings or timestamps. Unlike z.coerce.date, a missing
 * value reports `required` instead of being coerced into an invalid date.
 * @param {string} required
 * @param {string} [invalid]
 */
export const dateField = (required, invalid = required) =>
  z.preprocess(
    (value) =>
      typeof value === "string" || typeof value === "number" ? new Date(value) : value,
    z.date(messages(required, invalid)),
  );
