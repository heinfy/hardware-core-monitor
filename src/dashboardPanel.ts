import * as path from "path";
import * as si from "systeminformation";
import * as vscode from "vscode";

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._update();
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "hardwareDashboard",
      "Hardware Dashboard",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "media"),
          vscode.Uri.joinPath(extensionUri, "out/compiled"),
        ],
      },
    );

    DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri);
  }

  private async _update() {
    const webview = this._panel.webview;
    this._panel.webview.html = this._getHtmlForWebview(webview);

    // 定期更新数据
    setInterval(async () => {
      const data = await this.getHardwareData();
      webview.postMessage({ type: "update", data });
    }, 2000);
  }

  private async getHardwareData() {
    try {
      const [cpu, memory, disk, temperature] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.cpuTemperature(),
      ]);

      return {
        cpu: {
          usage: cpu.currentLoad,
          cores: cpu.cpus,
        },
        memory: {
          total: memory.total,
          used: memory.used,
          free: memory.free,
        },
        disk: disk.map((d) => ({
          mount: d.mount,
          size: d.size,
          used: d.used,
          usage: (d.used / d.size) * 100,
        })),
        temperature: temperature.main,
      };
    } catch (error) {
      console.error("Error getting hardware data:", error);
      return null;
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptPath = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "dashboard.js"),
    );

    const stylePath = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "dashboard.css"),
    );

    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${stylePath}" rel="stylesheet">
            <title>Hardware Dashboard</title>
        </head>
        <body>
            <div class="dashboard">
                <h1>Hardware Monitor Dashboard</h1>
                
                <div class="grid">
                    <div class="card">
                        <h2>CPU Usage</h2>
                        <div class="progress-container">
                            <div class="progress-bar" id="cpu-progress"></div>
                            <span id="cpu-text">0%</span>
                        </div>
                        <div id="cpu-cores"></div>
                    </div>

                    <div class="card">
                        <h2>Memory Usage</h2>
                        <div class="progress-container">
                            <div class="progress-bar" id="memory-progress"></div>
                            <span id="memory-text">0%</span>
                        </div>
                    </div>

                    <div class="card">
                        <h2>Temperature</h2>
                        <div class="temperature" id="temperature">0°C</div>
                    </div>

                    <div class="card">
                        <h2>Disk Usage</h2>
                        <div id="disk-usage"></div>
                    </div>
                </div>
            </div>

            <script src="${scriptPath}"></script>
        </body>
        </html>`;
  }

  public dispose() {
    DashboardPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
