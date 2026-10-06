import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcAlias = {
  "@": path.resolve(root, "src"),
};

export default defineConfig({
  resolve: {
    alias: srcAlias,
  },
  test: {
    projects: [
      {
        resolve: {
          alias: srcAlias,
        },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        resolve: {
          alias: srcAlias,
        },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
  },
});
