import { Router } from "express";
import { smartSearchController } from "../../container.js";
import { validateRequest } from "../../shared/middleware/validateRequest.js";
import { smartSearchLimiter } from "../../shared/middleware/rateLimiter.js";
import optionalVerifyJWT from "../auth/middleware/optionalVerifyJWT.js";
import {
  smartSearchQuerySchema,
  smartSearchBudgetQuerySchema,
} from "./smart-search.schema.js";

const router = Router();

router.get(
  "/budget",
  optionalVerifyJWT,
  validateRequest(smartSearchBudgetQuerySchema, "query"),
  smartSearchController.getBudget,
);

router.post(
  "/",
  smartSearchLimiter,
  optionalVerifyJWT,
  validateRequest(smartSearchQuerySchema, "body"),
  smartSearchController.search,
);

export { router as smartSearchRouter };
