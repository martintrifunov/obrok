import { ImageModel } from "./image.model.js";
import { ChainModel } from "../chain/chain.model.js";
import { ProductModel } from "../product/product.model.js";

export class ImageRepository {
  async findAll({ page, limit }) {
    if (limit === 0) {
      const docs = await ImageModel.find().exec();
      return { docs, total: null };
    }
    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      ImageModel.find().skip(skip).limit(limit).exec(),
      ImageModel.countDocuments().exec(),
    ]);
    return { docs, total };
  }

  async findById(id) {
    return ImageModel.findById(id).exec();
  }

  async findByFilename(filename) {
    return ImageModel.findOne({ filename }).exec();
  }

  async findByTitle(title) {
    return ImageModel.findOne({ title }).exec();
  }

  async countReferences(imageId) {
    const [chains, products] = await Promise.all([
      ChainModel.countDocuments({ image: imageId }).exec(),
      ProductModel.countDocuments({ image: imageId }).exec(),
    ]);
    return { chains, products };
  }

  async create(data) {
    return ImageModel.create(data);
  }

  async delete(image) {
    return image.deleteOne();
  }
}
