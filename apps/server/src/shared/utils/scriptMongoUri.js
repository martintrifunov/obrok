import fs from "fs";

/**
 * Database URI for CLI scripts. Inside the API container DATABASE_URI points at
 * the db service; on the host that name doesn't resolve, so MONGO_URI_LOCAL
 * (the published port) is used there instead.
 * @param {{ inContainer?: boolean, env?: Record<string, string | undefined> }} [options]
 * @returns {string | undefined}
 */
export const scriptMongoUri = ({
  inContainer = fs.existsSync("/.dockerenv"),
  env = process.env,
} = {}) =>
  inContainer
    ? env.DATABASE_URI ?? env.MONGO_URI_LOCAL
    : env.MONGO_URI_LOCAL ?? env.DATABASE_URI;
