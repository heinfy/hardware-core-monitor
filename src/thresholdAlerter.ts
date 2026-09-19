import * as vscode from "vscode";
import { text } from "./i18n";
import type { MonitorSnapshot } from "./shared/protocol";

/** 告警冷却时间：避免每个刷新周期都弹出一次警告 */
const ALERT_COOLDOWN_MS = 60_000;

/** 需要检查的告警类型 */
type AlertKind = "cpu" | "memory" | "temperature";

/**
 * 阈值告警器。
 *
 * 读取用户配置的阈值，在快照超过阈值时提示用户；
 * 同类告警在冷却时间内只提示一次。
 */
export class ThresholdAlerter implements vscode.Disposable {
  /** 记录每种告警最近一次弹出时间 */
  private readonly lastAlertAt = new Map<AlertKind, number>();

  /** 根据快照检查阈值并触发告警 */
  update(snapshot: MonitorSnapshot): void {
    const config = vscode.workspace.getConfiguration("hardwareCoreMonitor");

    const cpuThreshold = config.get<number>("cpuThreshold", 80);
    const memoryThreshold = config.get<number>("memoryThreshold", 85);
    const temperatureThreshold = config.get<number>("temperatureThreshold", 80);

    if (snapshot.cpu.usage > cpuThreshold) {
      this.alert(
        "cpu",
        text.alert.highCpuUsage(snapshot.cpu.usage.toFixed(1), cpuThreshold),
      );
    }

    if (snapshot.memory.usage > memoryThreshold) {
      this.alert(
        "memory",
        text.alert.highMemoryUsage(
          snapshot.memory.usage.toFixed(1),
          memoryThreshold,
        ),
      );
    }

    if (
      snapshot.temperature !== null &&
      snapshot.temperature > temperatureThreshold
    ) {
      this.alert(
        "temperature",
        text.alert.highCpuTemperature(
          snapshot.temperature.toFixed(1),
          temperatureThreshold,
        ),
      );
    }
  }

  /** 带冷却时间的告警 */
  private alert(kind: AlertKind, message: string): void {
    const now = Date.now();
    const lastAt = this.lastAlertAt.get(kind) ?? 0;

    if (now - lastAt < ALERT_COOLDOWN_MS) {
      return;
    }

    this.lastAlertAt.set(kind, now);
    void vscode.window.showWarningMessage(message);
  }

  dispose(): void {
    this.lastAlertAt.clear();
  }
}
