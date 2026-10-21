import { AppError } from "../shared/errors/AppError.js";

const corsOptions = {
  origin: (origin, callback) => {
    // !origin allows same-origin requests (no Origin header) and non-browser clients;
    // authentication (JWT) is the real access control, not CORS.
    if (!origin || origin === process.env.CLIENT_ORIGIN) return callback(null, true);
    // Refuse before any route runs: a cross-origin page could otherwise trigger
    // cookie-authenticated routes (refresh, logout) even though it can't read the reply.
    callback(new AppError("Origin not allowed.", 403));
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

export default corsOptions;
