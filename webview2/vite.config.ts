import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Webview2 构建配置：
// - 独立输出到插件根目录的 dist/webview2，与 webview 的产物完全隔离；
// - 固定产物文件名，扩展宿主端无需解析 hash 文件名；
// - base 使用相对路径，配合 webview.asWebviewUri 使用；
// - 开发服务器固定使用 5174 端口，可与 webview 的 5173 同时运行。
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: "../dist/webview2",
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
