import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["src/uploads/**", "src/data/reports/**", "node_modules/**"] },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // puppeteer page.evaluate callbacks run in the browser
    files: ["src/modules/scraper/**/*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
