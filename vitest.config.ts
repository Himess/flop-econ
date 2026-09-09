import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // The docs registry lives under app/ and imports the generated params through the same "@/"
  // alias Next resolves, so the test runner has to honour it too.
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["model/**/*.test.ts"],
    environment: "node",
  },
});
