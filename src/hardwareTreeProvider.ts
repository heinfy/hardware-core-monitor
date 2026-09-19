import * as vscode from "vscode";
import { text } from "./i18n";
import type { MonitorSnapshot } from "./shared/protocol";

/**
 * 侧边栏 TreeView 数据提供器。
 *
 * 它不直接调用 systeminformation，只把 MonitorService 推送的快照
 * 转换成 TreeItem。这样树视图、状态栏和 Webview 始终看到同一份数据。
 */
export class HardwareTreeProvider implements vscode.TreeDataProvider<HardwareTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    HardwareTreeItem | undefined | null | void
  >();

  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private snapshot: MonitorSnapshot | null = null;

  /** 收到新快照时调用：保存数据并刷新整棵树 */
  update(snapshot: MonitorSnapshot): void {
    this.snapshot = snapshot;

    // 第一次拿到数据后更新欢迎页显示条件
    void vscode.commands.executeCommand(
      "setContext",
      "hardwareMonitorHasData",
      true,
    );

    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: HardwareTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(
    element?: HardwareTreeItem,
  ): vscode.ProviderResult<HardwareTreeItem[]> {
    if (!this.snapshot) {
      return [HardwareTreeItem.createLoading()];
    }

    if (!element) {
      return this.createRootItems(this.snapshot);
    }

    return this.createDetailItems(element.id, this.snapshot);
  }

  /** 根节点：硬件分类 */
  private createRootItems(snapshot: MonitorSnapshot): HardwareTreeItem[] {
    const config = vscode.workspace.getConfiguration("hardwareCoreMonitor");
    const cpuThreshold = config.get<number>("cpuThreshold", 80);
    const memoryThreshold = config.get<number>("memoryThreshold", 85);
    const temperatureThreshold = config.get<number>("temperatureThreshold", 80);
    const maxDiskUsage = Math.max(
      0,
      ...snapshot.disks.map((disk) => disk.usage),
    );
    const totalDownload = snapshot.network.reduce(
      (total, item) => total + item.rxSec,
      0,
    );
    const totalUpload = snapshot.network.reduce(
      (total, item) => total + item.txSec,
      0,
    );

    return [
      new HardwareTreeItem(
        text.tree.processor(),
        vscode.TreeItemCollapsibleState.Expanded,
        "cpu",
        "circuit-board",
        text.tree.cpuSummary(
          formatPercent(snapshot.cpu.usage),
          snapshot.cpu.cores.length,
        ),
        text.tree.cpuTooltip(snapshot.cpu.usage.toFixed(1)),
        getUsageColor(snapshot.cpu.usage, cpuThreshold),
      ),
      new HardwareTreeItem(
        text.tree.memory(),
        vscode.TreeItemCollapsibleState.Collapsed,
        "memory",
        "server",
        `${formatPercent(snapshot.memory.usage)} · ${formatBytes(snapshot.memory.used)} / ${formatBytes(snapshot.memory.total)}`,
        text.tree.memoryTooltip(snapshot.memory.usage.toFixed(1)),
        getUsageColor(snapshot.memory.usage, memoryThreshold),
      ),
      new HardwareTreeItem(
        text.tree.storage(),
        vscode.TreeItemCollapsibleState.Collapsed,
        "disk",
        "database",
        text.tree.storageSummary(
          snapshot.disks.length,
          maxDiskUsage.toFixed(1),
        ),
        text.tree.storageTooltip(),
        getUsageColor(maxDiskUsage, 90),
      ),
      new HardwareTreeItem(
        text.tree.network(),
        vscode.TreeItemCollapsibleState.Collapsed,
        "network",
        "globe",
        `↓ ${formatSpeed(totalDownload)} · ↑ ${formatSpeed(totalUpload)}`,
        text.tree.networkInterfaces(snapshot.network.length),
        "charts.blue",
      ),
      new HardwareTreeItem(
        text.tree.system(),
        vscode.TreeItemCollapsibleState.Collapsed,
        "system",
        "device-desktop",
        snapshot.system?.hostname ?? text.tree.unknown(),
        snapshot.system
          ? `${snapshot.system.distro} ${snapshot.system.release} · ${snapshot.system.arch}`
          : text.tree.systemUnavailable(),
        "charts.purple",
      ),
      new HardwareTreeItem(
        text.tree.cpuTemperature(),
        vscode.TreeItemCollapsibleState.None,
        "temperature",
        "flame",
        snapshot.temperature === null
          ? text.tree.unavailable()
          : `${snapshot.temperature.toFixed(1)}℃`,
        snapshot.temperature === null
          ? text.tree.cpuTemperatureUnavailable()
          : text.tree.alertThreshold(temperatureThreshold),
        snapshot.temperature === null
          ? "disabledForeground"
          : getUsageColor(snapshot.temperature, temperatureThreshold),
      ),
      new HardwareTreeItem(
        text.tree.battery(),
        vscode.TreeItemCollapsibleState.None,
        "battery",
        snapshot.battery?.isCharging ? "plug" : "zap",
        formatBattery(snapshot),
        formatBatteryTooltip(snapshot),
        getBatteryColor(snapshot),
      ),
    ];
  }

  /** 子节点：各类别的具体数据 */
  private createDetailItems(
    id: string,
    snapshot: MonitorSnapshot,
  ): HardwareTreeItem[] {
    const none = vscode.TreeItemCollapsibleState.None;
    const config = vscode.workspace.getConfiguration("hardwareCoreMonitor");
    const cpuThreshold = config.get<number>("cpuThreshold", 80);
    const memoryThreshold = config.get<number>("memoryThreshold", 85);

    switch (id) {
      case "cpu":
        return [...snapshot.cpu.cores]
          .sort((left, right) => right.usage - left.usage)
          .map(
            (core) =>
              new HardwareTreeItem(
                formatCoreLabel(core.label),
                none,
                `cpu-${core.label}`,
                undefined,
                formatPercent(core.usage),
                text.tree.coreUsage(
                  formatCoreLabel(core.label),
                  core.usage.toFixed(1),
                ),
                getUsageColor(core.usage, cpuThreshold),
              ),
          );

      case "memory": {
        const { memory } = snapshot;
        return [
          new HardwareTreeItem(
            text.tree.usage(),
            none,
            "memory-usage",
            undefined,
            formatPercent(memory.usage),
            undefined,
            getUsageColor(memory.usage, memoryThreshold),
          ),
          new HardwareTreeItem(
            text.tree.used(),
            none,
            "memory-used",
            undefined,
            formatBytes(memory.used),
          ),
          new HardwareTreeItem(
            text.tree.available(),
            none,
            "memory-free",
            undefined,
            formatBytes(memory.free),
          ),
          new HardwareTreeItem(
            text.tree.total(),
            none,
            "memory-total",
            undefined,
            formatBytes(memory.total),
          ),
        ];
      }

      case "disk":
        return [...snapshot.disks]
          .sort((left, right) => right.usage - left.usage)
          .map(
            (disk) =>
              new HardwareTreeItem(
                formatDiskLabel(disk.mount),
                none,
                `disk-${disk.mount}`,
                undefined,
                `${formatPercent(disk.usage)} · ${formatBytes(disk.used)} / ${formatBytes(disk.total)}`,
                text.tree.diskUsage(
                  disk.mount,
                  formatBytes(disk.used),
                  formatBytes(disk.total),
                ),
                getUsageColor(disk.usage, 90),
              ),
          );

      case "network":
        return [...snapshot.network]
          .sort(
            (left, right) =>
              right.rxSec + right.txSec - (left.rxSec + left.txSec),
          )
          .map(
            (item) =>
              new HardwareTreeItem(
                item.iface,
                none,
                `network-${item.iface}`,
                undefined,
                `↓ ${formatSpeed(item.rxSec)} · ↑ ${formatSpeed(item.txSec)}`,
                text.tree.networkThroughput(item.iface),
                "charts.blue",
              ),
          );

      case "system": {
        if (!snapshot.system) {
          return [
            HardwareTreeItem.createUnavailable(
              "system-unavailable",
              text.tree.systemUnavailable(),
            ),
          ];
        }

        const system = snapshot.system;
        return [
          new HardwareTreeItem(
            text.tree.hostname(),
            none,
            "system-hostname",
            undefined,
            system.hostname,
          ),
          new HardwareTreeItem(
            text.tree.distribution(),
            none,
            "system-distro",
            undefined,
            `${system.distro} ${system.release}`,
          ),
          new HardwareTreeItem(
            text.tree.platform(),
            none,
            "system-platform",
            undefined,
            `${system.platform} / ${system.arch}`,
          ),
          new HardwareTreeItem(
            text.tree.kernel(),
            none,
            "system-kernel",
            undefined,
            system.kernel,
          ),
          new HardwareTreeItem(
            text.tree.cpuModel(),
            none,
            "system-cpu-model",
            undefined,
            system.cpuModel,
          ),
        ];
      }

      default:
        return [];
    }
  }
}

/** 侧边栏节点 */
export class HardwareTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    readonly id: string,
    icon?: string,
    description?: string,
    tooltip?: string,
    color?: string,
  ) {
    super(label, collapsibleState);

    this.id = id;
    if (icon !== undefined) {
      this.iconPath = new vscode.ThemeIcon(
        icon,
        color ? new vscode.ThemeColor(color) : undefined,
      );
    }

    if (description !== undefined) {
      this.description = description;
    }

    if (tooltip !== undefined) {
      this.tooltip = tooltip;
    }
  }

  static createLoading(): HardwareTreeItem {
    return new HardwareTreeItem(
      text.tree.loading(),
      vscode.TreeItemCollapsibleState.None,
      "loading",
      "loading~spin",
    );
  }

  static createUnavailable(id: string, label: string): HardwareTreeItem {
    return new HardwareTreeItem(
      label,
      vscode.TreeItemCollapsibleState.None,
      id,
      "circle-slash",
      undefined,
      undefined,
      "disabledForeground",
    );
  }
}

/** 字节数格式化，供树视图描述使用 */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );

  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
}

/** 将只有斜杠的系统根挂载点转换成更易识别的名称 */
function formatDiskLabel(mount: string): string {
  if (mount === "/") {
    return text.tree.systemDisk();
  }

  return mount || text.tree.unnamedDisk();
}

/** 本地化 systeminformation 生成的核心名称，同时保持原始快照不变 */
function formatCoreLabel(label: string): string {
  const match = /^Core\s+(\d+)$/.exec(label);

  return match ? text.tree.core(match[1]) : label;
}

/** 网速格式化 */
function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
    return "0 B/s";
  }

  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytesPerSecond) / Math.log(1024)),
  );

  return `${(bytesPerSecond / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

/** 只显示百分比，用于资源使用率等紧凑节点 */
function formatPercent(value: number): string {
  const normalized = Math.min(100, Math.max(0, value));

  return `${normalized.toFixed(1)}%`;
}

/** 根据告警阈值返回符合当前 VSCode 主题的状态色 */
function getUsageColor(value: number, dangerThreshold: number): string {
  if (value >= dangerThreshold) {
    return "charts.red";
  }

  if (value >= dangerThreshold * 0.8) {
    return "charts.yellow";
  }

  return "charts.green";
}

/** 电池描述格式化 */
function formatBattery(snapshot: MonitorSnapshot): string {
  if (!snapshot.battery) {
    return text.tree.unavailable();
  }

  const percent =
    snapshot.battery.percent === null
      ? text.tree.unknown()
      : `${snapshot.battery.percent.toFixed(0)}%`;

  const state = snapshot.battery.isCharging
    ? text.tree.charging()
    : snapshot.battery.pluggedIn
      ? text.tree.connectedToPower()
      : text.tree.onBattery();

  return text.tree.batterySummary(percent, state);
}

/** 电池节点悬停提示 */
function formatBatteryTooltip(snapshot: MonitorSnapshot): string {
  if (!snapshot.battery) {
    return text.tree.noBatteryInfo();
  }

  const percent =
    snapshot.battery.percent === null
      ? text.tree.unknown()
      : `${snapshot.battery.percent.toFixed(0)}%`;

  return [
    text.tree.batteryLevel(percent),
    text.tree.chargingStatus(
      snapshot.battery.isCharging
        ? text.tree.charging()
        : text.tree.notCharging(),
    ),
    text.tree.externalPower(
      snapshot.battery.pluggedIn
        ? text.tree.connected()
        : text.tree.disconnected(),
    ),
  ].join("\n");
}

/** 电池状态色：低电量优先，其次标识充电状态 */
function getBatteryColor(snapshot: MonitorSnapshot): string {
  if (!snapshot.battery || snapshot.battery.percent === null) {
    return "disabledForeground";
  }

  if (snapshot.battery.percent <= 15 && !snapshot.battery.isCharging) {
    return "charts.red";
  }

  if (snapshot.battery.percent <= 30 && !snapshot.battery.isCharging) {
    return "charts.yellow";
  }

  return snapshot.battery.isCharging ? "charts.blue" : "charts.green";
}
