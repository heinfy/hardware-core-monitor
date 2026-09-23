import * as vscode from "vscode";
import { DashboardPanel } from "./dashboardPanel";
import { HardwareTreeProvider } from "./hardwareTreeProvider";
import { text } from "./i18n";
import { MonitorService } from "./monitorService";
import { StatusBarController } from "./statusBarController";
import { ThresholdAlerter } from "./thresholdAlerter";
import { Webview2Panel } from "./webview2Panel";

/** 侧栏打开时的监控刷新间隔（毫秒） */
const SIDEBAR_REFRESH_INTERVAL = 10_000;

/** 控制活动栏标题按钮显示状态的上下文键 */
const MONITORING_CONTEXT = "hardwareMonitorIsRunning";

/**
 * 插件入口。
 *
 * 这里只做装配：创建唯一的 MonitorService，并把它的数据流
 * 分发给 TreeView、StatusBar、阈值告警和 React 仪表盘。
 */
export function activate(context: vscode.ExtensionContext): void {
  // 唯一的数据源：所有 UI 都订阅它
  const monitorService = new MonitorService(SIDEBAR_REFRESH_INTERVAL);
  const treeProvider = new HardwareTreeProvider();
  const statusBar = new StatusBarController();
  const alerter = new ThresholdAlerter();

  const treeView = vscode.window.createTreeView(
    "hardware-core-monitor.sidebarView",
    { treeDataProvider: treeProvider },
  );

  // 同一份快照同时驱动侧边栏、状态栏和告警
  monitorService.onDidChangeSnapshot(
    (snapshot) => {
      treeProvider.update(snapshot);
      statusBar.update(snapshot);
      alerter.update(snapshot);
    },
    undefined,
    context.subscriptions,
  );

  /** 根据侧栏可见性自动启停监控 */
  const syncMonitoringWithSidebarVisibility = (visible: boolean): void => {
    if (visible) {
      monitorService.updateInterval(SIDEBAR_REFRESH_INTERVAL);
      monitorService.start();
      void vscode.commands.executeCommand(
        "setContext",
        MONITORING_CONTEXT,
        true,
      );
      return;
    }

    monitorService.stop();
    void vscode.commands.executeCommand(
      "setContext",
      MONITORING_CONTEXT,
      false,
    );
  };

  treeView.onDidChangeVisibility(
    (event) => syncMonitoringWithSidebarVisibility(event.visible),
    undefined,
    context.subscriptions,
  );

  // 扩展激活时若侧栏已处于打开状态，立即开始监控
  if (treeView.visible) {
    syncMonitoringWithSidebarVisibility(true);
  }

  const startMonitoring = vscode.commands.registerCommand(
    "hardware-core-monitor.startMonitoring",
    () => {
      monitorService.updateInterval(SIDEBAR_REFRESH_INTERVAL);
      monitorService.start();
      void vscode.commands.executeCommand(
        "setContext",
        MONITORING_CONTEXT,
        true,
      );
      void vscode.window.showInformationMessage(text.monitor.started());
    },
  );

  const stopMonitoring = vscode.commands.registerCommand(
    "hardware-core-monitor.stopMonitoring",
    () => {
      monitorService.stop();
      void vscode.commands.executeCommand(
        "setContext",
        MONITORING_CONTEXT,
        false,
      );
      void vscode.window.showInformationMessage(text.monitor.paused());
    },
  );

  const refreshMonitoring = vscode.commands.registerCommand(
    "hardware-core-monitor.refreshMonitoring",
    () => {
      monitorService.requestNow();
    },
  );

  const showDashboard = vscode.commands.registerCommand(
    "hardware-core-monitor.showDashboard",
    () => {
      DashboardPanel.createOrShow(context, monitorService);
    },
  );

  // 打开带前端路由的第二个 Webview 窗口
  const showWebview2 = vscode.commands.registerCommand(
    "hardware-core-monitor.showWebview2",
    () => {
      Webview2Panel.createOrShow(context, monitorService);
    },
  );

  // VSCode 会统一清理这些资源
  context.subscriptions.push(
    monitorService,
    treeView,
    statusBar,
    alerter,
    startMonitoring,
    stopMonitoring,
    refreshMonitoring,
    showDashboard,
    showWebview2,
  );
}

export function deactivate(): void {
  // 清理逻辑由 context.subscriptions 统一处理，这里不需要额外工作
}

