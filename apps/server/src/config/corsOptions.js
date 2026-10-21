const corsOptions = {
  origin: (origin, callback) => {
    // !origin allows same-origin requests (no Origin header) and non-browser clients;
    // authentication (JWT) is the real access control, not CORS.
    // Other origins get no CORS headers, so the browser blocks them.
    callback(null, !origin || origin === process.env.CLIENT_ORIGIN);
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

export default corsOptions;
