import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));
const srcAlias = {
  "@": path.resolve(root, "src"),
};

/** Capture preview URL before Vite overwrites process.env.BASE_URL with the asset base ("/"). */
function previewBaseUrlFromEnv(): string {
  for (const key of ["PREVIEW_BASE_URL", "TEST_BASE_URL", "BASE_URL"] as const) {
    const value = process.env[key]?.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "http:" || url.protocol === "https:") return value.replace(/\/+$/, "");
    } catch {
      // not an absolute URL
    }
  }
  return "";
}

const previewBaseUrl = previewBaseUrlFromEnv();

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
          env: {
            PREVIEW_BASE_URL: previewBaseUrl,
          },
        },
      },
    ],
  },
});
