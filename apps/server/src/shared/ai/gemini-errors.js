const NETWORK_CODES = ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "ENOTFOUND"];
const TRANSIENT_STATUSES = [429, 500, 502, 503, 504];

/** Rate limits, server errors and network failures, which are worth retrying. */
export const isTransientError = (err) => {
  const message = String(err?.message || "").toUpperCase();
  const code = err?.code || err?.cause?.code;
  return (
    TRANSIENT_STATUSES.includes(err?.status) ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("UNAVAILABLE") ||
    message.includes("FETCH FAILED") ||
    NETWORK_CODES.includes(code)
  );
};

/** The model id doesn't exist (or no longer does); retrying it won't help. */
export const isModelUnavailableError = (err) => {
  const message = String(err?.message || "").toUpperCase();
  return err?.status === 404 || message.includes("NO LONGER AVAILABLE") || message.includes("NOT_FOUND");
};

/**
 * The server's "retry in Ns" hint if present, otherwise exponential backoff
 * with a little jitter so parallel retries don't line up.
 * @param {unknown} err
 * @param {number} attempt
 * @param {number} maxMs
 */
export const retryDelayMs = (err, attempt, maxMs) => {
  const retryIn = String(/** @type {any} */ (err)?.message || "").match(/retry in ([\d.]+)s/i);
  if (retryIn) return Math.ceil(Number(retryIn[1]) * 1000);
  return Math.min(maxMs, 2_000 * 2 ** attempt) + Math.floor(Math.random() * 500);
};
