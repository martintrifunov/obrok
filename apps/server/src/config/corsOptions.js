const corsOptions = {
  origin: (origin, callback) => {
    // !origin allows same-origin requests (no Origin header) and non-browser clients;
    // authentication (JWT) is the real access control, not CORS.
    if (!origin || origin === process.env.CLIENT_ORIGIN) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

export default corsOptions;
