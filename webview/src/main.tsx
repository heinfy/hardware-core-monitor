import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles/global.css";

// React 19 入口：挂载 VSCode Webview 页面
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("未找到 #root 挂载节点");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
