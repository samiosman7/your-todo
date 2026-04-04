import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        day: resolve(__dirname, "day.html"),
        now: resolve(__dirname, "now.html"),
        week: resolve(__dirname, "week.html"),
        month: resolve(__dirname, "month.html"),
      },
    },
  },
});
