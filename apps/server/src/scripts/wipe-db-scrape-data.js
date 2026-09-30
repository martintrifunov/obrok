import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, "../../../../.env") });

const CHAIN_NAME_MAP = {
  vero: "Vero",
  ramstore: "Ramstore",
  stokomak: "Stokomak",
  kam: "KAM",
  superkitgo: "Super KIT-GO",
};

const COLLECTIONS_TO_WIPE = [
  "chains",
  "markets",
  "market_products",
  "products",
  "product_embeddings",
];

async function wipeAll(db) {
  console.log("Wiping ALL collections...");
  for (const name of COLLECTIONS_TO_WIPE) {
    const result = await db.collection(name).deleteMany({});
    console.log(`- ${name}: deleted ${result.deletedCount}`);
  }
  console.log("✅ Database wiped cleanly!");
}

async function wipeChain(db, chainKey) {
  const chainName = CHAIN_NAME_MAP[chainKey];
  if (!chainName) {
    console.error(
      `Unknown chain "${chainKey}". Available: ${Object.keys(CHAIN_NAME_MAP).join(", ")}`,
    );
    process.exit(1);
  }

  console.log(`Wiping data for chain "${chainName}"...`);

  const chain = await db.collection("chains").findOne({ name: chainName });
  if (!chain) {
    console.log(`No chain found with name "${chainName}". Nothing to wipe.`);
    return;
  }

  const chainId = chain._id;

  const markets = await db
    .collection("markets")
    .find({ chain: chainId })
    .project({ _id: 1 })
    .toArray();
  const marketIds = markets.map((m) => m._id);

  const affectedProducts = await db
    .collection("market_products")
    .distinct("product", { market: { $in: marketIds } });

  const mpResult = await db
    .collection("market_products")
    .deleteMany({ market: { $in: marketIds } });
  console.log(`- market_products: deleted ${mpResult.deletedCount}`);

  let orphanedProducts = [];
  if (affectedProducts.length > 0) {
    const stillReferenced = await db
      .collection("market_products")
      .distinct("product", { product: { $in: affectedProducts } });
    const stillReferencedSet = new Set(stillReferenced.map((id) => id.toString()));
    orphanedProducts = affectedProducts.filter(
      (id) => !stillReferencedSet.has(id.toString()),
    );
  }

  if (orphanedProducts.length > 0) {
    const embResult = await db
      .collection("product_embeddings")
      .deleteMany({ product: { $in: orphanedProducts } });
    console.log(`- product_embeddings: deleted ${embResult.deletedCount}`);

    const prodResult = await db
      .collection("products")
      .deleteMany({ _id: { $in: orphanedProducts } });
    console.log(`- products: deleted ${prodResult.deletedCount}`);
  } else {
    console.log("- product_embeddings: deleted 0");
    console.log("- products: deleted 0");
  }

  const mktResult = await db
    .collection("markets")
    .deleteMany({ chain: chainId });
  console.log(`- markets: deleted ${mktResult.deletedCount}`);

  const chainResult = await db
    .collection("chains")
    .deleteOne({ _id: chainId });
  console.log(`- chains: deleted ${chainResult.deletedCount}`);

  console.log(`✅ Chain "${chainName}" wiped cleanly!`);
}

async function wipe() {
  const target = process.argv[2]?.toLowerCase();
  const uri = process.env.MONGO_URI_LOCAL ?? process.env.DATABASE_URI;
  if (!uri) throw new Error("No Mongo URI found");

  console.log("Connecting to database...");
  await mongoose.connect(uri);

  try {
    const db = mongoose.connection.db;

    if (target) {
      await wipeChain(db, target);
    } else {
      await wipeAll(db);
    }
  } finally {
    await mongoose.disconnect();
  }
}

wipe().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
