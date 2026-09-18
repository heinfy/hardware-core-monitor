import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import "./styles/global.css";

// Webview 中必须使用 HashRouter：
// VSCode Webview 运行在 vscode-webview:// 源下，没有服务器路由可回退，
// BrowserRouter 切换路由时会整页导航到不存在的地址。
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("未找到 #root 挂载节点");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
