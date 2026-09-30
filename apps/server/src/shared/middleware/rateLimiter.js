import rateLimit from "express-rate-limit";

/**
 * Creates a configured rate limiter middleware.
 *
 * @param {object} options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max      - Max requests per window
 * @param {string} options.message  - Error message sent to client
 */
export const createRateLimiter = ({ windowMs, max, message }) => {
  return rateLimit({
    windowMs,
    max,
    message: { message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json(options.message);
    },
  });
};

export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many login attempts. Please try again after 15 minutes.",
});

// Smart search calls a paid AI model per request, so keep it tight per IP.
export const smartSearchLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many smart search requests. Please try again in a minute.",
});
