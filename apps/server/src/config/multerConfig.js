import multer from "multer";
import path from "path";
import crypto from "crypto";
import { AppError } from "../shared/errors/AppError.js";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve("src/uploads"));
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-randomhex.ext
    const uniqueSuffix =
      Date.now() + "-" + crypto.randomBytes(6).toString("hex");
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError("Only .jpeg, .jpg, .png, and .webp files are allowed.", 400));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

export default upload;
