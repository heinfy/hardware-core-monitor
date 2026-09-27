import { statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import * as vscode from "vscode";
import type {
  HostToWebviewMessage,
  MonitorSnapshot,
  WebviewToHostMessage,
} from "./shared/protocol";
import { text } from "./i18n";
import type { MonitorService } from "./monitorService";

/** React Webview 的面板视图类型 */
export const DashboardViewType = "hardware-core-monitor.dashboard";

/**
 * React 仪表盘面板。
 *
 * 职责边界：
 * - 创建 WebviewPanel 并注入安全的 CSP；
 * - 加载 Vite 构建产物（或开发环境的 Vite Dev Server）；
 * - 在 MonitorService 与 React 页面之间转发消息；
 * - 默认 F5 加载 dist 产物。调试 Restart 会重新构建，再由序列化器把最新页面灌回已打开的面板。
 *
 * 面板本身不做数据采集，也不包含渲染逻辑。
 */
export class DashboardPanel implements vscode.Disposable {
  private static currentPanel: DashboardPanel | undefined;

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
        switch (message.type) {
          case "ready":
          case "refresh":
            // 页面加载完成或用户手动刷新时，立即采集一次
            this.monitorService.requestNow();

            // 如果已有缓存快照，先补发，避免页面空白等待
            if (this.monitorService.latestSnapshot) {
              void this.postSnapshot(this.monitorService.latestSnapshot);
            }
            break;
          case "copyReport":
            void this.copyReport(message.content);
            break;
          case "exportReport":
            void this.exportReport(message.content, message.fileName);
            break;
          case "openExternal":
            void vscode.env.openExternal(vscode.Uri.parse(message.url));
            break;
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

  /**
   * 注册面板恢复。
   * 调试工具栏的 Restart 会重启扩展宿主，已打开的面板靠这个回调重新注入 HTML。
   */
  static registerSerializer(
    context: vscode.ExtensionContext,
    monitorService: MonitorService,
  ): void {
    context.subscriptions.push(
      vscode.window.registerWebviewPanelSerializer(DashboardViewType, {
        async deserializeWebviewPanel(panel: vscode.WebviewPanel) {
          DashboardPanel.revive(panel, context.extensionUri, monitorService);
        },
      }),
    );
  }

  /** 创建面板；如果已存在则直接显示 */
  static createOrShow(
    context: vscode.ExtensionContext,
    monitorService: MonitorService,
  ): void {
    const column = vscode.window.activeTextEditor?.viewColumn;

    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      DashboardViewType,
      text.panel.dashboardTitle(),
      column ?? vscode.ViewColumn.One,
      {
        ...DashboardPanel.webviewOptions(context.extensionUri),

        // 隐藏时保留 React 状态，重新打开不需要重新初始化
        retainContextWhenHidden: true,
      },
    );

    DashboardPanel.currentPanel = new DashboardPanel(
      panel,
      context.extensionUri,
      monitorService,
    );
  }

  /** Restart 后恢复面板，并强制丢掉上一份 HTML */
  private static revive(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    monitorService: MonitorService,
  ): void {
    panel.webview.options = DashboardPanel.webviewOptions(extensionUri);
    // 先清空，避免和上一轮 HTML 字符串相同时被跳过刷新
    panel.webview.html = "";
    DashboardPanel.currentPanel = new DashboardPanel(
      panel,
      extensionUri,
      monitorService,
    );
  }

  /** Webview 可访问的本地资源范围，只放行仪表盘产物 */
  private static webviewOptions(
    extensionUri: vscode.Uri,
  ): vscode.WebviewOptions {
    return {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, "dist/webview")],
    };
  }

  /** 发送快照给 Webview */
  private async postSnapshot(snapshot: MonitorSnapshot): Promise<void> {
    await this.panel.webview.postMessage({
      type: "snapshot",
      snapshot,
    } satisfies HostToWebviewMessage);
  }

  /** 将硬件报告复制到系统剪贴板 */
  private async copyReport(content: string): Promise<void> {
    try {
      await vscode.env.clipboard.writeText(content);
      await this.postActionResult(true, "已复制到剪贴板");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "复制失败，请稍后重试";
      await this.postActionResult(false, message);
    }
  }

  /** 将硬件报告导出为 txt 文件 */
  private async exportReport(content: string, fileName: string): Promise<void> {
    try {
      const targetUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(fileName),
        filters: {
          "Text Files": ["txt"],
        },
        saveLabel: "导出",
      });

      if (!targetUri) {
        return;
      }

      await writeFile(targetUri.fsPath, content, "utf8");
      await this.postActionResult(true, "报告已导出");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "导出失败，请稍后重试";
      await this.postActionResult(false, message);
    }
  }

  /** 向 Webview 发送操作结果反馈 */
  private async postActionResult(
    success: boolean,
    message: string,
  ): Promise<void> {
    await this.panel.webview.postMessage({
      type: "actionResult",
      success,
      message,
    } satisfies HostToWebviewMessage);
  }

  /** 生成 Webview HTML，包含 CSP 与资源引用 */
  private getHtml(webview: vscode.Webview): string {
    // 开发环境：配合 launch.json 里的 WEBVIEW_DEV_SERVER_URL 使用 Vite Dev Server
    const devServerUrl = process.env["WEBVIEW_DEV_SERVER_URL"];

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
        `connect-src ${devServerUrl} ws://localhost:5173 http://localhost:5173`,
        "img-src data: blob:",
      ].join("; ");
    } else {
      // 产物文件名固定，必须带上修改时间，否则 Webview 会一直用缓存里的旧 JS/CSS
      scriptUri = this.versionedUri(webview, "dist/webview/assets/index.js");
      styleUri = this.versionedUri(webview, "dist/webview/assets/index.css");

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
    <title>Hardware Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${scriptUri}"></script>
  </body>
</html>`;
  }

  /**
   * 给固定文件名的产物加上修改时间。
   * Webview 会按 URL 缓存 index.js / index.css，Restart 后如果不改 URL，页面仍是旧的。
   */
  private versionedUri(webview: vscode.Webview, relativePath: string): string {
    const fileUri = vscode.Uri.joinPath(this.extensionUri, relativePath);
    const version = this.assetVersion(fileUri);
    return `${webview.asWebviewUri(fileUri)}?v=${version}`;
  }

  /** 读取产物修改时间；文件还不存在时用当前时间，避免 URL 被永久缓存 */
  private assetVersion(fileUri: vscode.Uri): string {
    try {
      return String(Math.round(statSync(fileUri.fsPath).mtimeMs));
    } catch {
      return String(Date.now());
    }
  }

  dispose(): void {
    DashboardPanel.currentPanel = undefined;

    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop();
      disposable?.dispose();
    }

    this.panel.dispose();
  }
}
