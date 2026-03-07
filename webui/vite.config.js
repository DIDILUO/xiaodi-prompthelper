import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/react-dom")) {
            return "vendor-react";
          }
          return undefined;
        },
      },
    },
  },
});
