import * as vscode from "vscode";

/** 监控刷新间隔默认值（毫秒） */
export const DEFAULT_REFRESH_INTERVAL_MS = 10_000;

/** 允许的最小刷新间隔（毫秒） */
export const MIN_REFRESH_INTERVAL_MS = 500;

/** 从工作区配置读取并钳制后的监控刷新间隔 */
export function getRefreshIntervalMs(): number {
  const config = vscode.workspace.getConfiguration("hardwareCoreMonitor");
  const raw = config.get<number>(
    "refreshIntervalMs",
    DEFAULT_REFRESH_INTERVAL_MS,
  );

  if (typeof raw !== "number" || Number.isNaN(raw)) {
    return DEFAULT_REFRESH_INTERVAL_MS;
  }

  return Math.max(MIN_REFRESH_INTERVAL_MS, raw);
}
