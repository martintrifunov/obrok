import { Router } from "express";
import { imageController } from "../../container.js";
import verifyJWT from "../auth/middleware/verifyJWT.js";
import verifyAdmin from "../auth/middleware/verifyAdmin.js";
import upload from "../../config/multerConfig.js";
import { validateRequest } from "../../shared/middleware/validateRequest.js";
import { deleteImageSchema, imageParamsSchema } from "./image.schema.js";
import { paginationWithAllSchema } from "../../shared/schemas/paginationSchema.js";

const router = Router();

router.get(
  "/",
  verifyJWT,
  verifyAdmin,
  validateRequest(paginationWithAllSchema, "query"),
  imageController.getAll,
);
router.get(
  "/:id",
  validateRequest(imageParamsSchema, "params"),
  imageController.getById,
);
router.post("/", verifyJWT, verifyAdmin, upload.single("image"), imageController.upload);
router.delete(
  "/",
  verifyJWT,
  verifyAdmin,
  validateRequest(deleteImageSchema),
  imageController.delete,
);

export { router as imageRouter };
