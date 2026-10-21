import { Router } from "express";
import { productController } from "../../container.js";
import verifyJWT from "../auth/middleware/verifyJWT.js";
import verifyAdmin from "../auth/middleware/verifyAdmin.js";
import { validateRequest } from "../../shared/middleware/validateRequest.js";
import { idSchema } from "../../shared/schemas/zodObjectId.js";
import {
  productQuerySchema,
  createProductSchema,
  updateProductSchema,
  categoriesQuerySchema,
} from "./product.schema.js";

const router = Router();

router.get(
  "/",
  validateRequest(productQuerySchema, "query"),
  productController.getAll,
);
router.get(
  "/categories",
  validateRequest(categoriesQuerySchema, "query"),
  productController.getCategories,
);
router.get(
  "/:id",
  validateRequest(idSchema, "params"),
  productController.getById,
);
router.post(
  "/",
  verifyJWT,
  verifyAdmin,
  validateRequest(createProductSchema),
  productController.create,
);
router.put(
  "/",
  verifyJWT,
  verifyAdmin,
  validateRequest(updateProductSchema),
  productController.update,
);
router.delete(
  "/",
  verifyJWT,
  verifyAdmin,
  validateRequest(idSchema),
  productController.delete,
);

export { router as productRouter };
