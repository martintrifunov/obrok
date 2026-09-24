import multer from "multer";
import { AppError } from "../errors/AppError.js";
import { ValidationError } from "../errors/ValidationError.js";

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: "File is too large. The maximum size is 10 MB.",
};

export const errorHandler = (err, req, res, _next) => {
  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json(err.errors);
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  if (err instanceof multer.MulterError) {
    return res
      .status(400)
      .json({ message: MULTER_MESSAGES[err.code] || err.message });
  }

  // Unique index violation, e.g. a product title that already exists.
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0];
    return res.status(409).json({
      message: field
        ? `A record with this ${field} already exists.`
        : "A record with these values already exists.",
    });
  }

  // body-parser and other http-errors style errors (malformed JSON, payload too large).
  const status = err?.status ?? err?.statusCode;
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return res
      .status(status)
      .json({ message: err.expose ? err.message : "Bad request." });
  }

  console.error(err);
  res.status(500).json({ message: "Internal server error." });
};
