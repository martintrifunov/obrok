import { NotFoundError } from "../../shared/errors/NotFoundError.js";
import { AppError } from "../../shared/errors/AppError.js";
import { ValidationError } from "../../shared/errors/ValidationError.js";
import { buildPaginationMeta } from "../../shared/utils/buildPaginationMeta.js";

// Placeholder images seeded as "chain-<key>" (see seed-chain-images.js); the
// scraper reuses them for chains it creates, so they're never deleted.
const SEEDED_CHAIN_IMAGE = /^chain-[a-z0-9-]+$/i;

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export class ImageService {
  constructor(imageRepository, fileService) {
    this.imageRepository = imageRepository;
    this.fileService = fileService;
  }

  async getAllImages({ page, limit }) {
    const { docs, total } = await this.imageRepository.findAll({ page, limit });
    return {
      data: docs,
      pagination: buildPaginationMeta({ total, page, limit }),
    };
  }

  async getImageById(id) {
    const image = await this.imageRepository.findById(id);
    if (!image) throw new NotFoundError(`No image matches ID ${id}.`);
    return image;
  }

  async uploadImage(file) {
    if (!file) throw new ValidationError("Image file is required.");

    try {
      return await this.imageRepository.create({
        title: file.originalname,
        filename: file.filename,
        url: this.fileService.buildUrl(file.filename),
        mimeType: file.mimetype,
        size: file.size,
      });
    } catch (err) {
      this.fileService.delete(file.filename);
      throw err;
    }
  }

  async deleteImage(id) {
    const image = await this.imageRepository.findById(id);
    if (!image) throw new NotFoundError(`No image matches ID ${id}.`);

    const { chains, products } = await this.imageRepository.countReferences(id);
    if (chains || products) {
      const users = [
        chains && plural(chains, "chain"),
        products && plural(products, "product"),
      ].filter(Boolean);
      throw new AppError(
        `Image is used by ${users.join(" and ")}. Change or remove it there first.`,
        409,
      );
    }

    this.fileService.delete(image.filename);
    await this.imageRepository.delete(image);
  }

  async deleteIfUnused(imageId) {
    if (!imageId) return false;
    const image = await this.imageRepository.findById(imageId);
    if (!image || SEEDED_CHAIN_IMAGE.test(image.title)) return false;

    const { chains, products } = await this.imageRepository.countReferences(imageId);
    if (chains || products) return false;

    this.fileService.delete(image.filename);
    await this.imageRepository.delete(image);
    return true;
  }
}
