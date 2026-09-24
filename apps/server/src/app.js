import express from "express";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import corsOptions from "./config/corsOptions.js";
import { errorHandler } from "./shared/middleware/errorHandler.js";
import visitorTracking from "./shared/middleware/visitorTracking.js";

import { authRouter } from "./modules/auth/auth.routes.js";
import { chainRouter } from "./modules/chain/chain.routes.js";
import { productRouter } from "./modules/product/product.routes.js";
import { imageRouter } from "./modules/image/image.routes.js";
import { marketRouter } from "./modules/market/market.routes.js";
import { featureFlagRouter } from "./modules/feature-flag/feature-flag.routes.js";
import { searchRouter } from "./modules/search/search.routes.js";
import { smartSearchRouter } from "./modules/search/smart-search.routes.js";
import { publicHolidayRouter } from "./modules/public-holiday/public-holiday.routes.js";
import { reportRouter } from "./modules/report/report.routes.js";
import { analyticsRouter } from "./modules/analytics/analytics.routes.js";

const app = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production",
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(cors(corsOptions));
app.use(express.urlencoded({ limit: "1mb", extended: false }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(visitorTracking);
app.use("/uploads", express.static(path.resolve("src/uploads")));

app.use("/api", authRouter);
app.use("/api/chains", chainRouter);
app.use("/api/products", productRouter);
app.use("/api/images", imageRouter);
app.use("/api/markets", marketRouter);
app.use("/api/flags", featureFlagRouter);
app.use("/api/search", searchRouter);
app.use("/api/smart-search", smartSearchRouter);
app.use("/api/public-holidays", publicHolidayRouter);
app.use("/api/reports", reportRouter);
app.use("/api/analytics", analyticsRouter);

app.use(errorHandler);

export default app;
