import { describe, it, expect, vi, beforeEach } from "vitest";
import { ImageService } from "./image.service.js";
import { NotFoundError } from "../../shared/errors/NotFoundError.js";
import { ValidationError } from "../../shared/errors/ValidationError.js";
import { AppError } from "../../shared/errors/AppError.js";

const mockImageRepository = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  countReferences: vi.fn().mockResolvedValue({ chains: 0, products: 0 }),
};

const mockFileService = {
  buildUrl: vi.fn((filename) => `http://localhost/uploads/${filename}`),
  delete: vi.fn(),
};

const makeSut = () => new ImageService(mockImageRepository, mockFileService);

beforeEach(() => vi.clearAllMocks());

describe("ImageService", () => {
  describe("getAllImages", () => {
    it("returns paginated data", async () => {
      mockImageRepository.findAll.mockResolvedValue({
        docs: [{ title: "img.jpg" }],
        total: 1,
      });
      const sut = makeSut();
      const result = await sut.getAllImages({ page: 1, limit: 10 });
      expect(result.data).toEqual([{ title: "img.jpg" }]);
      expect(result.pagination).toMatchObject({ total: 1, page: 1, limit: 10 });
    });

    it("returns null pagination when limit is 0", async () => {
      mockImageRepository.findAll.mockResolvedValue({ docs: [], total: null });
      const sut = makeSut();
      const result = await sut.getAllImages({ page: 1, limit: 0 });
      expect(result.pagination).toBeNull();
    });
  });

  describe("getImageById", () => {
    it("returns image if found", async () => {
      const image = { _id: "img1", title: "photo.jpg" };
      mockImageRepository.findById.mockResolvedValue(image);
      const sut = makeSut();
      const result = await sut.getImageById("img1");
      expect(result).toEqual(image);
    });

    it("throws NotFoundError if image does not exist", async () => {
      mockImageRepository.findById.mockResolvedValue(null);
      const sut = makeSut();
      await expect(sut.getImageById("img1")).rejects.toThrow(NotFoundError);
    });
  });

  describe("uploadImage", () => {
    it("throws ValidationError if no file provided", async () => {
      const sut = makeSut();
      await expect(sut.uploadImage(null)).rejects.toThrow(ValidationError);
    });

    it("creates and returns image record", async () => {
      const file = {
        originalname: "photo.jpg",
        filename: "photo-123.jpg",
        mimetype: "image/jpeg",
        size: 1024,
      };
      const created = { _id: "img1", title: "photo.jpg" };
      mockImageRepository.create.mockResolvedValue(created);
      const sut = makeSut();
      const result = await sut.uploadImage(file);
      expect(result).toEqual(created);
      expect(mockImageRepository.create).toHaveBeenCalledWith({
        title: "photo.jpg",
        filename: "photo-123.jpg",
        url: "http://localhost/uploads/photo-123.jpg",
        mimeType: "image/jpeg",
        size: 1024,
      });
    });

    it("deletes file and rethrows if repository create fails", async () => {
      const file = {
        originalname: "photo.jpg",
        filename: "photo-123.jpg",
        mimetype: "image/jpeg",
        size: 1024,
      };
      mockImageRepository.create.mockRejectedValue(new Error("DB error"));
      const sut = makeSut();
      await expect(sut.uploadImage(file)).rejects.toThrow("DB error");
      expect(mockFileService.delete).toHaveBeenCalledWith("photo-123.jpg");
    });
  });

  describe("deleteImage", () => {
    it("throws NotFoundError if image does not exist", async () => {
      mockImageRepository.findById.mockResolvedValue(null);
      const sut = makeSut();
      await expect(sut.deleteImage("img1")).rejects.toThrow(NotFoundError);
    });

    it("deletes file and image record", async () => {
      const image = { _id: "img1", filename: "photo-123.jpg" };
      mockImageRepository.findById.mockResolvedValue(image);
      mockImageRepository.delete.mockResolvedValue(null);
      const sut = makeSut();
      await sut.deleteImage("img1");
      expect(mockFileService.delete).toHaveBeenCalledWith("photo-123.jpg");
      expect(mockImageRepository.delete).toHaveBeenCalledWith(image);
    });

    it("refuses to delete an image a chain or product still uses", async () => {
      mockImageRepository.findById.mockResolvedValue({ _id: "img1", filename: "logo.png" });
      mockImageRepository.countReferences.mockResolvedValueOnce({ chains: 1, products: 3 });
      const sut = makeSut();

      const err = await sut.deleteImage("img1").catch((e) => e);

      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(409);
      expect(err.message).toBe(
        "Image is used by 1 chain and 3 products. Change or remove it there first.",
      );
      expect(mockFileService.delete).not.toHaveBeenCalled();
      expect(mockImageRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe("deleteIfUnused", () => {
    it("deletes an image nothing uses anymore", async () => {
      const image = { _id: "img1", title: "milk.png", filename: "123-milk.png" };
      mockImageRepository.findById.mockResolvedValue(image);
      const sut = makeSut();

      expect(await sut.deleteIfUnused("img1")).toBe(true);
      expect(mockFileService.delete).toHaveBeenCalledWith("123-milk.png");
      expect(mockImageRepository.delete).toHaveBeenCalledWith(image);
    });

    it("keeps an image another chain or product still uses", async () => {
      mockImageRepository.findById.mockResolvedValue({ _id: "img1", title: "shared.png" });
      mockImageRepository.countReferences.mockResolvedValueOnce({ chains: 0, products: 1 });
      const sut = makeSut();

      expect(await sut.deleteIfUnused("img1")).toBe(false);
      expect(mockImageRepository.delete).not.toHaveBeenCalled();
    });

    it("never deletes a seeded chain placeholder", async () => {
      mockImageRepository.findById.mockResolvedValue({ _id: "img1", title: "chain-vero" });
      const sut = makeSut();

      expect(await sut.deleteIfUnused("img1")).toBe(false);
      expect(mockImageRepository.countReferences).not.toHaveBeenCalled();
      expect(mockImageRepository.delete).not.toHaveBeenCalled();
    });

    it("still deletes an uploaded file whose name merely starts with chain-", async () => {
      mockImageRepository.findById.mockResolvedValue({
        _id: "img1",
        title: "chain-logo.png",
        filename: "1-chain-logo.png",
      });
      const sut = makeSut();

      expect(await sut.deleteIfUnused("img1")).toBe(true);
    });

    it("does nothing without an image id", async () => {
      const sut = makeSut();
      expect(await sut.deleteIfUnused(null)).toBe(false);
      expect(mockImageRepository.findById).not.toHaveBeenCalled();
    });
  });
});
