// Scripts import this first: ES imports are hoisted, so a config() call in a
// script's body would run after modules that read process.env when they load.
import { config } from "dotenv";
import path from "path";

config({ path: path.resolve(import.meta.dirname, "../../../../.env") });
