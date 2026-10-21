import { Router } from "express";
import { chainController } from "../../container.js";
import verifyJWT from "../auth/middleware/verifyJWT.js";
import verifyAdmin from "../auth/middleware/verifyAdmin.js";
import { validateRequest } from "../../shared/middleware/validateRequest.js";
import { idSchema } from "../../shared/schemas/zodObjectId.js";
import {
  chainQuerySchema,
  createChainSchema,
  updateChainSchema,
} from "./chain.schema.js";

const router = Router();

router.get("/report", verifyJWT, verifyAdmin, chainController.generateReport);
router.get(
  "/",
  validateRequest(chainQuerySchema, "query"),
  chainController.getAll,
);
router.get(
  "/:id",
  validateRequest(idSchema, "params"),
  chainController.getById,
);
router.post(
  "/",
  verifyJWT,
  verifyAdmin,
  validateRequest(createChainSchema),
  chainController.create,
);
router.put(
  "/",
  verifyJWT,
  verifyAdmin,
  validateRequest(updateChainSchema),
  chainController.update,
);
router.delete(
  "/",
  verifyJWT,
  verifyAdmin,
  validateRequest(idSchema),
  chainController.delete,
);

export { router as chainRouter };
