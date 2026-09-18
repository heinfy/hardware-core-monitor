import * as si from "systeminformation";
import * as vscode from "vscode";
import type { MonitorSnapshot, SystemSnapshot } from "./shared/protocol";

/**
 * 硬件监控服务：整个插件里唯一的数据源。
 *
 * 设计要点：
 * 1. 只有这个类允许调用 systeminformation，TreeView / StatusBar / Webview
 *    都只消费它发出的事件，避免多处轮询造成重复采集。
 * 2. 使用“递归 setTimeout”而不是 setInterval，保证上一轮采集完成后
 *    才安排下一轮，避免慢机器上请求堆积。
 * 3. systeminformation 的原始对象会被转换成轻量、可序列化的
 *    MonitorSnapshot，再发送给 Webview。
 */
export class MonitorService implements vscode.Disposable {
  private readonly _onDidChangeSnapshot =
    new vscode.EventEmitter<MonitorSnapshot>();

  private readonly _onDidError = new vscode.EventEmitter<string>();

  /** 快照更新事件，所有 UI 组件都订阅它 */
  readonly onDidChangeSnapshot = this._onDidChangeSnapshot.event;

  /** 采集失败事件，用于把错误传递给 Webview 或日志 */
  readonly onDidError = this._onDidError.event;

  private timer: NodeJS.Timeout | undefined;
  private isRunning = false;
  private isCollecting = false;
  private intervalMs: number;

  /** 静态系统信息只需要采集一次，之后缓存复用 */
  private cachedSystemInfo: SystemSnapshot | null = null;

  /** 最近一次成功采集的快照，用于 Webview 打开后立即补发 */
  private latest: MonitorSnapshot | null = null;

  constructor(intervalMs = 2000) {
    this.intervalMs = Math.max(500, intervalMs);
  }

  get latestSnapshot(): MonitorSnapshot | null {
    return this.latest;
  }

  /** 开始周期性采集；重复调用是安全的 */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    void this.collectAndSchedule();
  }

  /** 停止周期性采集 */
  stop(): void {
    this.isRunning = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  /** 响应配置变化：更新刷新间隔并在运行中时重启调度 */
  updateInterval(intervalMs: number): void {
    this.intervalMs = Math.max(500, intervalMs);

    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * 立即采集一次数据，不影响原有周期调度。
   * 典型场景是 Webview 加载完成或用户点击刷新按钮。
   */
  requestNow(): void {
    void this.collectOnce();
  }

  dispose(): void {
    this.stop();
    this._onDidChangeSnapshot.dispose();
    this._onDidError.dispose();
  }

  /** 采集一轮数据，然后按配置间隔安排下一轮 */
  private async collectAndSchedule(): Promise<void> {
    await this.collectOnce();

    if (!this.isRunning) {
      return;
    }

    // 采集完成后才安排下一次，避免任务堆积
    this.timer = setTimeout(() => {
      void this.collectAndSchedule();
    }, this.intervalMs);
  }

  /** 执行一次采集；并发调用时只保留一次实际执行 */
  private async collectOnce(): Promise<void> {
    if (this.isCollecting) {
      return;
    }

    this.isCollecting = true;

    try {
      const snapshot = await collectSnapshot(async () => {
        // 第一次调用时缓存静态系统信息，减少后续轮询开销
        this.cachedSystemInfo ??= await collectSystemInfo();
        return this.cachedSystemInfo;
      });

      this.latest = snapshot;
      this._onDidChangeSnapshot.fire(snapshot);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown monitor error";

      console.error("[Hardware Monitor] collect failed:", error);
      this._onDidError.fire(message);
    } finally {
      this.isCollecting = false;
    }
  }
}

/** 采集静态系统信息；失败时返回 null，不影响主流程 */
async function collectSystemInfo(): Promise<SystemSnapshot | null> {
  try {
    const [osInfo, cpuInfo] = await Promise.all([si.osInfo(), si.cpu()]);

    return {
      platform: osInfo.platform,
      distro: osInfo.distro,
      release: osInfo.release,
      kernel: osInfo.kernel,
      hostname: osInfo.hostname,
      arch: osInfo.arch,
      cpuModel: cpuInfo.brand,
    };
  } catch (error) {
    console.warn("[Hardware Monitor] system info unavailable:", error);
    return null;
  }
}

/** 把 systeminformation 的原始返回值转换成轻量快照 */
async function collectSnapshot(
  getSystemInfo: () => Promise<SystemSnapshot | null>,
): Promise<MonitorSnapshot> {
  // 温度和电池在部分平台/虚拟机中不可用，失败时返回 null 而不是中断整个快照
  const [cpu, memory, disks, network, temperature, battery, system] =
    await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
      si.networkStats(),
      si.cpuTemperature().catch(() => ({ main: undefined })),
      si.battery().catch(() => null),
      getSystemInfo(),
    ]);

  return {
    timestamp: Date.now(),
    cpu: {
      usage: cpu.currentLoad,
      cores: cpu.cpus.map((core, index) => ({
        label: `Core ${index}`,
        usage: core.load,
      })),
    },
    memory: {
      total: memory.total,
      used: memory.used,
      free: memory.free,
      usage: memory.total > 0 ? (memory.used / memory.total) * 100 : 0,
    },
    disks: disks
      .filter((disk) => disk.size > 0)
      .map((disk) => ({
        mount: disk.mount,
        total: disk.size,
        used: disk.used,
        usage: disk.size > 0 ? (disk.used / disk.size) * 100 : 0,
      })),
    network: network.map((item) => ({
      iface: item.iface,
      rxSec: item.rx_sec ?? 0,
      txSec: item.tx_sec ?? 0,
    })),
    temperature:
      typeof temperature.main === "number" && temperature.main > 0
        ? temperature.main
        : null,
    system,
    battery:
      battery && battery.hasBattery
        ? {
            percent:
              typeof battery.percent === "number" ? battery.percent : null,
            isCharging: battery.isCharging,
            pluggedIn: battery.acConnected,
          }
        : null,
  };
}
