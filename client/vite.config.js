import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api calls are proxied to the Express server in dev, so the browser
// always talks to the same origin and the LLM is only ever called by the server.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Dev preview environments connect through proxied hostnames
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
