import { Router } from "express";
import { analyticsController } from "../../container.js";
import verifyJWT from "../auth/middleware/verifyJWT.js";
import optionalVerifyJWT from "../auth/middleware/optionalVerifyJWT.js";
import verifyAdmin from "../auth/middleware/verifyAdmin.js";
import verifyAdminUser from "../auth/middleware/verifyAdminUser.js";
import { validateRequest } from "../../shared/middleware/validateRequest.js";
import {
  analyticsHeartbeatSchema,
  analyticsDaysQuerySchema,
} from "./analytics.schema.js";
import { createRateLimiter } from "../../shared/middleware/rateLimiter.js";

const heartbeatLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many heartbeat requests. Please slow down.",
});

const router = Router();

router.post(
  "/heartbeat",
  heartbeatLimiter,
  optionalVerifyJWT,
  validateRequest(analyticsHeartbeatSchema),
  analyticsController.heartbeat,
);

router.get(
  "/summary",
  verifyJWT,
  verifyAdmin,
  validateRequest(analyticsDaysQuerySchema, "query"),
  analyticsController.summary,
);

router.get(
  "/feature-trends",
  verifyJWT,
  verifyAdmin,
  validateRequest(analyticsDaysQuerySchema, "query"),
  analyticsController.featureTrends,
);

router.get(
  "/export",
  verifyJWT,
  verifyAdminUser,
  validateRequest(analyticsDaysQuerySchema, "query"),
  analyticsController.exportCsv,
);

export { router as analyticsRouter };
