import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { ImageModel } from "../../modules/image/image.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHAIN_IMAGES_DIR = path.resolve(__dirname, "../../data/chain-images");
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

const CHAIN_IMAGE_DEFS = [
  { key: "vero", title: "chain-vero" },
  { key: "ramstore", title: "chain-ramstore" },
  { key: "stokomak", title: "chain-stokomak" },
  { key: "kam", title: "chain-kam" },
  { key: "superkitgo", title: "chain-superkitgo" },
];

const SUPPORTED_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

const findSourceFile = (key) => {
  for (const ext of SUPPORTED_EXTS) {
    const filePath = path.join(CHAIN_IMAGES_DIR, `${key}${ext}`);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
};

const MIME_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export const seedChainImages = async () => {
  for (const { key, title } of CHAIN_IMAGE_DEFS) {
    const existing = await ImageModel.findOne({ title }).exec();
    if (existing) continue;

    const sourcePath = findSourceFile(key);
    if (!sourcePath) {
      console.warn(
        `[SeedChainImages] No image file found for "${key}" in ${CHAIN_IMAGES_DIR}. Skipping.`,
      );
      continue;
    }

    const ext = path.extname(sourcePath);
    const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    const destPath = path.join(UPLOADS_DIR, uniqueName);

    fs.copyFileSync(sourcePath, destPath);

    const stats = fs.statSync(destPath);

    await ImageModel.create({
      title,
      filename: uniqueName,
      url: `/uploads/${uniqueName}`,
      mimeType: MIME_TYPES[ext] || "image/png",
      size: stats.size,
    });

    console.log(`[SeedChainImages] Seeded "${title}" → ${uniqueName}`);
  }
};
