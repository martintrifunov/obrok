import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Readable } from "stream";
import express from "express";
import multer from "multer";
import { errorHandler } from "./errorHandler.js";
import { AppError } from "../errors/AppError.js";
import { ValidationError } from "../errors/ValidationError.js";

// Runs express.json() over a raw body and resolves with the error it produces.
const parseJson = (body) =>
  new Promise((resolve) => {
    const req = Object.assign(Readable.from([Buffer.from(body)]), {
      headers: { "content-type": "application/json", "content-length": String(body.length) },
    });
    express.json()(req, {}, resolve);
  });

describe("errorHandler", () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  const next = vi.fn();
  // Silence console.error before each test
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  // Restore it after each test so we don't break console.error globally
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns statusCode and errors object for ValidationError", () => {
    const err = new ValidationError({ title: "This field cannot be blank." });
    errorHandler(err, {}, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      title: "This field cannot be blank.",
    });
  });

  it("returns statusCode and message for AppError", () => {
    const err = new AppError("Not found", 404);
    errorHandler(err, {}, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Not found" });
  });

  it("returns 500 for unknown errors", () => {
    const err = new Error("Something exploded");
    errorHandler(err, {}, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Internal server error.",
    });
    expect(console.error).toHaveBeenCalledWith(err);
  });

  it("returns 400 for malformed JSON bodies", async () => {
    const err = await parseJson("{not json");
    errorHandler(err, {}, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 for oversized uploads", () => {
    errorHandler(new multer.MulterError("LIMIT_FILE_SIZE"), {}, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "File is too large. The maximum size is 10 MB.",
    });
  });

  it("returns 409 for duplicate keys", () => {
    const err = Object.assign(new Error("E11000"), {
      code: 11000,
      keyValue: { title: "Млеко" },
    });
    errorHandler(err, {}, res, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "A record with this title already exists.",
    });
  });
});
