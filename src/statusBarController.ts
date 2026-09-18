import * as vscode from "vscode";
import type { MonitorSnapshot } from "./shared/protocol";

/**
 * 状态栏控制器。
 *
 * 只负责把快照渲染到 VSCode 状态栏，不参与数据采集。
 */
export class StatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );

    // 点击状态栏打开 React 仪表盘
    this.item.command = "hardware-core-monitor.showDashboard";
    this.item.name = "Hardware Core Monitor";
    this.item.text = "$(pulse) CPU --% | RAM --%";
    this.item.tooltip = "Hardware Core Monitor（点击打开仪表盘）";
  }

  /** 根据最新快照更新状态栏内容 */
  update(snapshot: MonitorSnapshot): void {
    this.item.text = `$(pulse) CPU ${snapshot.cpu.usage.toFixed(0)}% | RAM ${snapshot.memory.usage.toFixed(0)}%`;
    this.item.tooltip = new vscode.MarkdownString(
      [
        `CPU：${snapshot.cpu.usage.toFixed(1)}%`,
        `内存：${snapshot.memory.usage.toFixed(1)}%`,
        snapshot.temperature !== null
          ? `温度：${snapshot.temperature.toFixed(1)}℃`
          : "温度：不可用",
        "",
        "点击打开完整仪表盘",
      ].join("\n"),
    );
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
