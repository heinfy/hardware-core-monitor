import * as vscode from "vscode";
import type { MonitorSnapshot } from "./shared/protocol";

/**
 * 侧边栏 TreeView 数据提供器。
 *
 * 它不直接调用 systeminformation，只把 MonitorService 推送的快照
 * 转换成 TreeItem。这样树视图、状态栏和 Webview 始终看到同一份数据。
 */
export class HardwareTreeProvider
  implements vscode.TreeDataProvider<HardwareTreeItem>
{
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
    return [
      new HardwareTreeItem(
        "CPU",
        vscode.TreeItemCollapsibleState.Expanded,
        "cpu",
        "$(cpu)",
        `${snapshot.cpu.usage.toFixed(1)}% / ${snapshot.cpu.cores.length} cores`,
      ),
      new HardwareTreeItem(
        "内存",
        vscode.TreeItemCollapsibleState.Collapsed,
        "memory",
        "$(server)",
        `${formatBytes(snapshot.memory.used)} / ${formatBytes(snapshot.memory.total)}`,
      ),
      new HardwareTreeItem(
        "磁盘",
        vscode.TreeItemCollapsibleState.Collapsed,
        "disk",
        "$(database)",
        `${snapshot.disks.length} 个挂载点`,
      ),
      new HardwareTreeItem(
        "网络",
        vscode.TreeItemCollapsibleState.Collapsed,
        "network",
        "$(globe)",
        `${snapshot.network.length} 个接口`,
      ),
      new HardwareTreeItem(
        "温度",
        vscode.TreeItemCollapsibleState.None,
        "temperature",
        "$(flame)",
        snapshot.temperature === null
          ? "不可用"
          : `${snapshot.temperature.toFixed(1)}℃`,
      ),
      new HardwareTreeItem(
        "电池",
        vscode.TreeItemCollapsibleState.None,
        "battery",
        "$(zap)",
        formatBattery(snapshot),
      ),
      new HardwareTreeItem(
        "系统",
        vscode.TreeItemCollapsibleState.Collapsed,
        "system",
        "$(device-desktop)",
        snapshot.system?.hostname ?? "未知",
      ),
    ];
  }

  /** 子节点：各类别的具体数据 */
  private createDetailItems(
    id: string,
    snapshot: MonitorSnapshot,
  ): HardwareTreeItem[] {
    const none = vscode.TreeItemCollapsibleState.None;

    switch (id) {
      case "cpu":
        return snapshot.cpu.cores.map(
          (core) =>
            new HardwareTreeItem(
              core.label,
              none,
              `cpu-${core.label}`,
              "$(pulse)",
              `${core.usage.toFixed(1)}%`,
            ),
        );

      case "memory": {
        const { memory } = snapshot;
        return [
          new HardwareTreeItem(
            "使用率",
            none,
            "memory-usage",
            "$(graph)",
            `${memory.usage.toFixed(1)}%`,
          ),
          new HardwareTreeItem(
            "已使用",
            none,
            "memory-used",
            "$(arrow-up)",
            formatBytes(memory.used),
          ),
          new HardwareTreeItem(
            "可用",
            none,
            "memory-free",
            "$(arrow-down)",
            formatBytes(memory.free),
          ),
          new HardwareTreeItem(
            "总量",
            none,
            "memory-total",
            "$(unfold)",
            formatBytes(memory.total),
          ),
        ];
      }

      case "disk":
        return snapshot.disks.map(
          (disk) =>
            new HardwareTreeItem(
              disk.mount,
              none,
              `disk-${disk.mount}`,
              "$(hard-drive)",
              `${formatBytes(disk.used)} / ${formatBytes(disk.total)}（${disk.usage.toFixed(1)}%）`,
            ),
        );

      case "network":
        return snapshot.network.map(
          (item) =>
            new HardwareTreeItem(
              item.iface,
              none,
              `network-${item.iface}`,
              "$(arrow-both)",
              `↓ ${formatSpeed(item.rxSec)} / ↑ ${formatSpeed(item.txSec)}`,
            ),
        );

      case "system": {
        if (!snapshot.system) {
          return [
            HardwareTreeItem.createUnavailable(
              "system-unavailable",
              "系统信息不可用",
            ),
          ];
        }

        const system = snapshot.system;
        return [
          new HardwareTreeItem(
            "主机名",
            none,
            "system-hostname",
            "$(home)",
            system.hostname,
          ),
          new HardwareTreeItem(
            "发行版",
            none,
            "system-distro",
            "$(info)",
            `${system.distro} ${system.release}`,
          ),
          new HardwareTreeItem(
            "平台",
            none,
            "system-platform",
            "$(vm)",
            `${system.platform} / ${system.arch}`,
          ),
          new HardwareTreeItem(
            "内核",
            none,
            "system-kernel",
            "$(terminal)",
            system.kernel,
          ),
          new HardwareTreeItem(
            "CPU 型号",
            none,
            "system-cpu-model",
            "$(chip)",
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
    icon: string,
    description?: string,
  ) {
    super(label, collapsibleState);

    this.id = id;
    this.iconPath = new vscode.ThemeIcon(icon);

    if (description !== undefined) {
      this.description = description;
    }
  }

  static createLoading(): HardwareTreeItem {
    return new HardwareTreeItem(
      "正在加载硬件数据…",
      vscode.TreeItemCollapsibleState.None,
      "loading",
      "$(loading~spin)",
    );
  }

  static createUnavailable(id: string, label: string): HardwareTreeItem {
    return new HardwareTreeItem(
      label,
      vscode.TreeItemCollapsibleState.None,
      id,
      "$(circle-slash)",
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

/** 网速格式化 */
function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) {
    return `${bytesPerSecond.toFixed(0)} B/s`;
  }

  return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
}

/** 电池描述格式化 */
function formatBattery(snapshot: MonitorSnapshot): string {
  if (!snapshot.battery) {
    return "不可用";
  }

  const percent =
    snapshot.battery.percent === null
      ? "未知"
      : `${snapshot.battery.percent.toFixed(0)}%`;

  const state = snapshot.battery.isCharging
    ? "充电中"
    : snapshot.battery.pluggedIn
      ? "已接通电源"
      : "使用电池";

  return `${percent}（${state}）`;
}
