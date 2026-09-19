import * as vscode from "vscode";
import type {
  HostToWebviewMessage,
  MonitorSnapshot,
  WebviewToHostMessage,
} from "./shared/protocol";
import { text } from "./i18n";
import type { MonitorService } from "./monitorService";

/** Webview2 面板视图类型，与 DashboardPanel 完全独立 */
export const Webview2ViewType = "hardware-core-monitor.webview2";

/**
 * Webview2 面板：带前端路由（HashRouter）的第二个 React 页面。
 *
 * 与 DashboardPanel 的隔离边界：
 * - 独立的 WebviewViewType，可同时打开两个窗口；
 * - 资源只来自 dist/webview2，不与 dist/webview 混用；
 * - 开发环境使用 WEBVIEW2_DEV_SERVER_URL（默认端口 5174）。
 *
 * 面板本身不做数据采集，只负责创建窗口、注入 CSP 并转发消息。
 */
export class Webview2Panel implements vscode.Disposable {
  private static currentPanel: Webview2Panel | undefined;

  private readonly disposables: vscode.Disposable[] = [];

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly monitorService: MonitorService,
  ) {
    panel.webview.html = this.getHtml(panel.webview);

    // 处理来自 React 页面的消息
    panel.webview.onDidReceiveMessage(
      (message: WebviewToHostMessage) => {
        if (message.type === "ready" || message.type === "refresh") {
          this.monitorService.requestNow();

          if (this.monitorService.latestSnapshot) {
            void this.postSnapshot(this.monitorService.latestSnapshot);
          }
        }
      },
      this,
      this.disposables,
    );

    // 数据更新时转发给 Webview
    this.monitorService.onDidChangeSnapshot(
      (snapshot) => void this.postSnapshot(snapshot),
      this,
      this.disposables,
    );

    // 采集失败时把错误信息发给 Webview 展示
    this.monitorService.onDidError(
      (message) => {
        void this.panel.webview.postMessage({
          type: "error",
          message,
        } satisfies HostToWebviewMessage);
      },
      this,
      this.disposables,
    );

    this.panel.onDidDispose(() => this.dispose(), this, this.disposables);
  }

  /** 创建面板；如果已存在则直接显示 */
  static createOrShow(
    context: vscode.ExtensionContext,
    monitorService: MonitorService,
  ): void {
    const column = vscode.window.activeTextEditor?.viewColumn;

    if (Webview2Panel.currentPanel) {
      Webview2Panel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      Webview2ViewType,
      text.panel.webview2Title(),
      column ?? vscode.ViewColumn.Active,
      {
        enableScripts: true,

        // 隐藏时保留 React 状态，前端路由位置不会丢失
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "dist/webview2"),
        ],
      },
    );

    Webview2Panel.currentPanel = new Webview2Panel(
      panel,
      context.extensionUri,
      monitorService,
    );
  }

  /** 发送快照给 Webview */
  private async postSnapshot(snapshot: MonitorSnapshot): Promise<void> {
    await this.panel.webview.postMessage({
      type: "snapshot",
      snapshot,
    } satisfies HostToWebviewMessage);
  }

  /** 生成 Webview HTML，包含 CSP 与资源引用 */
  private getHtml(webview: vscode.Webview): string {
    // 开发环境：配合 launch.json 里的 WEBVIEW2_DEV_SERVER_URL 使用 Vite Dev Server
    const devServerUrl = process.env["WEBVIEW2_DEV_SERVER_URL"];

    let scriptUri: vscode.Uri | string;
    let styleUri: vscode.Uri | string | undefined;
    let csp: string;

    if (devServerUrl) {
      scriptUri = `${devServerUrl}/src/main.tsx`;
      styleUri = `${devServerUrl}/src/styles/global.css`;
      csp = [
        "default-src 'none'",
        `script-src ${devServerUrl} 'unsafe-inline' 'unsafe-eval'`,
        `style-src ${devServerUrl} 'unsafe-inline'`,
        `connect-src ${devServerUrl} ws://localhost:5174 http://localhost:5174`,
        "img-src data: blob:",
      ].join("; ");
    } else {
      // 生产环境：加载 webview2 独立的固定文件名产物
      scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(this.extensionUri, "dist/webview2/assets/index.js"),
      );
      styleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(
          this.extensionUri,
          "dist/webview2/assets/index.css",
        ),
      );

      // 生产 CSP 只允许加载 Webview 内部资源
      csp = [
        "default-src 'none'",
        `script-src ${webview.cspSource}`,
        `style-src ${webview.cspSource}`,
        `img-src ${webview.cspSource} data:`,
        `font-src ${webview.cspSource}`,
      ].join("; ");
    }

    return /* html */ `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <link rel="stylesheet" href="${styleUri}" />
    <title>Hardware Monitor (Webview2)</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${scriptUri}"></script>
  </body>
</html>`;
  }

  dispose(): void {
    Webview2Panel.currentPanel = undefined;

    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop();
      disposable?.dispose();
    }

    this.panel.dispose();
  }
}
