import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target:
          process.env.VITE_API_URL || "https://ticket.karaokeicool.com.vn:2053",
        changeOrigin: true,
      },
    },
  },
});
