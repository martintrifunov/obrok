import bcrypt from "bcrypt";
import { UserModel } from "../../modules/auth/user.model.js";

export const seedAdminUser = async () => {
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD must be set.");
  }

  const existing = await UserModel.findOne({
    username: process.env.ADMIN_USERNAME,
  }).exec();

  if (!existing) {
    const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    await UserModel.create({
      username: process.env.ADMIN_USERNAME,
      password: hashed,
      role: "admin",
    });
    console.log("Admin user seeded.");
  }
};
