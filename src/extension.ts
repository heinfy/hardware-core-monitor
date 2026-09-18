import * as si from "systeminformation";
import * as vscode from "vscode";
import { DashboardPanel } from "./dashboardPanel";
import { HardwareMonitorProvider } from "./hardwareMonitorProvider";

export let statusBarItem: vscode.StatusBarItem;
export let monitorProvider: HardwareMonitorProvider;

export function activate(context: vscode.ExtensionContext) {
  console.log("Hardware Core Monitor is now active!");

  // 创建状态栏项
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.command = "hardware-core-monitor.showDashboard";
  context.subscriptions.push(statusBarItem);

  // 创建侧边栏提供者
  monitorProvider = new HardwareMonitorProvider(context);
  const treeView = vscode.window.createTreeView(
    "hardware-core-monitor.sidebarView",
    {
      treeDataProvider: monitorProvider,
    },
  );
  context.subscriptions.push(treeView);

  // 注册命令
  const startCommand = vscode.commands.registerCommand(
    "hardware-core-monitor.startMonitoring",
    () => {
      monitorProvider.startMonitoring();
      vscode.window.showInformationMessage("Hardware monitoring started");
    },
  );

  const showDashboardCommand = vscode.commands.registerCommand(
    "hardware-core-monitor.showDashboard",
    () => {
      DashboardPanel.createOrShow(context.extensionUri);
    },
  );

  context.subscriptions.push(startCommand, showDashboardCommand);

  // 自动开始监控
  monitorProvider.startMonitoring();
}

export function deactivate() {
  if (monitorProvider) {
    monitorProvider.stopMonitoring();
  }
}
