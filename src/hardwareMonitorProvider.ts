import * as si from "systeminformation";
import * as vscode from "vscode";
import { statusBarItem } from "./extension"; // 导入导出的 statusBarItem
import { HardwareItem } from "./hardwareItem";

export class HardwareMonitorProvider
  implements vscode.TreeDataProvider<HardwareItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    HardwareItem | undefined | null | void
  > = new vscode.EventEmitter<HardwareItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    HardwareItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  private monitoringInterval: NodeJS.Timeout | null = null;
  private currentData: any = {};

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: HardwareItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: HardwareItem): Promise<HardwareItem[]> {
    if (!element) {
      // 根节点
      return [
        new HardwareItem(
          "CPU",
          vscode.TreeItemCollapsibleState.Collapsed,
          "cpu",
          this.currentData.cpu,
        ),
        new HardwareItem(
          "Memory",
          vscode.TreeItemCollapsibleState.Collapsed,
          "memory",
          this.currentData.memory,
        ),
        new HardwareItem(
          "Disk",
          vscode.TreeItemCollapsibleState.Collapsed,
          "disk",
          this.currentData.disk,
        ),
        new HardwareItem(
          "Network",
          vscode.TreeItemCollapsibleState.Collapsed,
          "network",
          this.currentData.network,
        ),
        new HardwareItem(
          "Temperature",
          vscode.TreeItemCollapsibleState.Collapsed,
          "temperature",
          this.currentData.temperature,
        ),
        new HardwareItem(
          "System",
          vscode.TreeItemCollapsibleState.Collapsed,
          "system",
          this.currentData.system,
        ),
        new HardwareItem(
          "Battery",
          vscode.TreeItemCollapsibleState.Collapsed,
          "battery",
          this.currentData.battery,
        ),
      ];
    }

    // 根据元素类型返回子项
    return this.getHardwareDetails(element.id);
  }

  private async getHardwareDetails(type: string): Promise<HardwareItem[]> {
    try {
      switch (type) {
        case "cpu":
          const cpuData = await si.currentLoad();
          return [
            new HardwareItem(
              `Usage: ${cpuData.currentLoad.toFixed(1)}%`,
              vscode.TreeItemCollapsibleState.None,
              "cpu-usage",
            ),
            ...cpuData.cpus.map(
              (core, index) =>
                new HardwareItem(
                  `Core ${index}: ${core.load.toFixed(1)}%`,
                  vscode.TreeItemCollapsibleState.None,
                  `core-${index}`,
                ),
            ),
          ];

        case "memory":
          const memData = await si.mem();
          const totalMem = (memData.total / 1024 / 1024 / 1024).toFixed(1);
          const usedMem = (memData.used / 1024 / 1024 / 1024).toFixed(1);
          const usagePercent = ((memData.used / memData.total) * 100).toFixed(
            1,
          );

          return [
            new HardwareItem(
              `Total: ${totalMem} GB`,
              vscode.TreeItemCollapsibleState.None,
              "mem-total",
            ),
            new HardwareItem(
              `Used: ${usedMem} GB (${usagePercent}%)`,
              vscode.TreeItemCollapsibleState.None,
              "mem-used",
            ),
            new HardwareItem(
              `Free: ${(memData.free / 1024 / 1024 / 1024).toFixed(1)} GB`,
              vscode.TreeItemCollapsibleState.None,
              "mem-free",
            ),
          ];

        case "disk":
          const diskData = await si.fsSize();
          return diskData.map(
            (disk) =>
              new HardwareItem(
                `${disk.mount}: ${(disk.used / 1024 / 1024 / 1024).toFixed(1)}GB / ${(disk.size / 1024 / 1024 / 1024).toFixed(1)}GB`,
                vscode.TreeItemCollapsibleState.None,
                `disk-${disk.mount}`,
              ),
          );

        default:
          return [
            new HardwareItem(
              "Loading...",
              vscode.TreeItemCollapsibleState.None,
              `loading-${Math.random().toString(36).substring(2, 9)}`,
            ),
          ];
      }
    } catch (error) {
      return [
        new HardwareItem(
          `Error: ${error}`,
          vscode.TreeItemCollapsibleState.None,
          "error",
        ),
      ];
    }
  }

  async startMonitoring() {
    const config = vscode.workspace.getConfiguration("hardwareCoreMonitor");
    const interval = config.get<number>("refreshInterval", 2000);

    this.monitoringInterval = setInterval(async () => {
      try {
        // 获取所有硬件数据
        const [cpu, memory, disk, network, temperature, system, battery] =
          await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.fsSize(),
            si.networkStats(),
            si.cpuTemperature(),
            si.osInfo(),
            si.battery().catch(() => null), // 电池可能不存在
          ]);

        this.currentData = {
          cpu,
          memory,
          disk,
          network,
          temperature,
          system,
          battery,
        };
        this.refresh();
        this.updateStatusBar();

        // 检查阈值警告
        this.checkThresholds();
      } catch (error) {
        console.error("Monitoring error:", error);
      }
    }, interval);
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  private updateStatusBar() {
    const cpuUsage = this.currentData.cpu?.currentLoad?.toFixed(1) || "0";
    const memUsage = this.currentData.memory
      ? (
          (this.currentData.memory.used / this.currentData.memory.total) *
          100
        ).toFixed(1)
      : "0";

    // 使用导入的 statusBarItem
    statusBarItem.text = `$(pulse) CPU: ${cpuUsage}% | RAM: ${memUsage}%`;
    statusBarItem.show();
  }

  private checkThresholds() {
    const config = vscode.workspace.getConfiguration("hardwareCoreMonitor");

    // CPU 警告
    const cpuThreshold = config.get<number>("cpuThreshold", 80);
    if (this.currentData.cpu?.currentLoad > cpuThreshold) {
      vscode.window.showWarningMessage(
        `High CPU usage: ${this.currentData.cpu.currentLoad.toFixed(1)}%`,
      );
    }

    // 内存警告
    const memThreshold = config.get<number>("memoryThreshold", 85);
    const memUsage =
      (this.currentData.memory.used / this.currentData.memory.total) * 100;
    if (memUsage > memThreshold) {
      vscode.window.showWarningMessage(
        `High memory usage: ${memUsage.toFixed(1)}%`,
      );
    }

    // 温度警告
    const tempThreshold = config.get<number>("temperatureThreshold", 80);
    if (this.currentData.temperature?.main > tempThreshold) {
      vscode.window.showWarningMessage(
        `High temperature: ${this.currentData.temperature.main}°C`,
      );
    }
  }
}
