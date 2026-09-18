import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Webview 构建配置：
// - 输出到插件根目录的 dist/webview；
// - 固定产物文件名，扩展宿主端无需解析 hash 文件名；
// - base 使用相对路径，配合 webview.asWebviewUri 使用。
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "../dist/webview",
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/index.js",
        assetFileNames: "assets/index[extname]",
        chunkFileNames: "assets/chunks/[name].js",
      },
    },
  },
});
