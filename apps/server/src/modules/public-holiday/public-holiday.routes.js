import { Router } from "express";
import { publicHolidayController } from "../../container.js";
import verifyJWT from "../auth/middleware/verifyJWT.js";
import verifyAdmin from "../auth/middleware/verifyAdmin.js";
import { validateRequest } from "../../shared/middleware/validateRequest.js";
import { idSchema } from "../../shared/schemas/zodObjectId.js";
import {
  publicHolidayQuerySchema,
  createPublicHolidaySchema,
  updatePublicHolidaySchema,
} from "./public-holiday.schema.js";

const router = Router();

router.get(
  "/",
  validateRequest(publicHolidayQuerySchema, "query"),
  publicHolidayController.getAll,
);
router.get(
  "/:id",
  validateRequest(idSchema, "params"),
  publicHolidayController.getById,
);
router.post(
  "/",
  verifyJWT,
  verifyAdmin,
  validateRequest(createPublicHolidaySchema),
  publicHolidayController.create,
);
router.put(
  "/",
  verifyJWT,
  verifyAdmin,
  validateRequest(updatePublicHolidaySchema),
  publicHolidayController.update,
);
router.delete(
  "/",
  verifyJWT,
  verifyAdmin,
  validateRequest(idSchema),
  publicHolidayController.delete,
);

export { router as publicHolidayRouter };
