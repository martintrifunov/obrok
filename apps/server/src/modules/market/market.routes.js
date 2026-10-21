import { Router } from "express";
import { marketController } from "../../container.js";
import verifyJWT from "../auth/middleware/verifyJWT.js";
import verifyAdmin from "../auth/middleware/verifyAdmin.js";
import { validateRequest } from "../../shared/middleware/validateRequest.js";
import { idSchema } from "../../shared/schemas/zodObjectId.js";
import {
  marketQuerySchema,
  createMarketSchema,
  updateMarketSchema,
} from "./market.schema.js";

const router = Router();

router.get(
  "/",
  validateRequest(marketQuerySchema, "query"),
  marketController.getAll,
);
router.get(
  "/:id",
  validateRequest(idSchema, "params"),
  marketController.getById,
);
router.post(
  "/",
  verifyJWT,
  verifyAdmin,
  validateRequest(createMarketSchema),
  marketController.create,
);
router.put(
  "/",
  verifyJWT,
  verifyAdmin,
  validateRequest(updateMarketSchema),
  marketController.update,
);
router.delete(
  "/",
  verifyJWT,
  verifyAdmin,
  validateRequest(idSchema),
  marketController.delete,
);

export { router as marketRouter };
