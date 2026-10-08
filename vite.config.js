import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const aws = {
  live: "https://zz4fonhxsf.execute-api.us-east-1.amazonaws.com",
  platform: "https://3f2vz55km0.execute-api.us-east-1.amazonaws.com",
};

export default defineConfig({
  base: '/EarthSense-Dashboard./',
  plugins: [react()],
  server: {
    proxy: {
      "/api/earthsense-data": {
        target: aws.live,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/earthsense-data/, "/data"),
      },
      "/api/earthsense-status": {
        target: aws.platform,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/earthsense-status/, ""),
      },
      "/api/earthsense-test": {
        target: aws.platform,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/earthsense-test/, "/test"),
      },
    },
  },
});
