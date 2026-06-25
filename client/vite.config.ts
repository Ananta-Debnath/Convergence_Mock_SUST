import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const apiTarget = process.env.VITE_API_BASE ?? "http://localhost:3001";
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: mode === "development" ? {
        // Forward `/api/*` to the Express API so the client can simply POST
        // to `/api/sort-ticket` regardless of environment.
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      } : undefined,
    },
    build: {
      outDir: "dist",
      sourcemap: true,
    },
  };
});