import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0", // 👈 exposes to local network
    port: 5173, // 👈 optional, set fixed port
  },
});
