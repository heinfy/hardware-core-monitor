import * as vscode from "vscode";

/**
 * Extension-host messages with English as the source and fallback language.
 *
 * Keep all runtime user-facing messages here. After changing a source message,
 * run `pnpm run l10n:export` and update the Simplified Chinese bundle.
 */
export const text = {
  monitor: {
    started: (): string => vscode.l10n.t("Hardware monitoring started"),
    paused: (): string => vscode.l10n.t("Hardware monitoring paused"),
  },

  panel: {
    dashboardTitle: (): string => vscode.l10n.t("Hardware Dashboard"),
    webview2Title: (): string => vscode.l10n.t("Hardware Monitor (Webview2)"),
  },

  statusBar: {
    name: (): string => vscode.l10n.t("Hardware Core Monitor"),
    tooltip: (): string =>
      vscode.l10n.t("Hardware Core Monitor (click to open dashboard)"),
    cpuUsage: (usage: string): string => vscode.l10n.t("CPU: {0}%", usage),
    memoryUsage: (usage: string): string =>
      vscode.l10n.t("Memory: {0}%", usage),
    temperature: (temperature: string): string =>
      vscode.l10n.t("Temperature: {0}°C", temperature),
    temperatureUnavailable: (): string =>
      vscode.l10n.t("Temperature: unavailable"),
    openDashboard: (): string =>
      vscode.l10n.t("Click to open the full dashboard"),
  },

  alert: {
    highCpuUsage: (usage: string, threshold: number): string =>
      vscode.l10n.t("High CPU usage: {0}% (threshold: {1}%)", usage, threshold),
    highMemoryUsage: (usage: string, threshold: number): string =>
      vscode.l10n.t(
        "High memory usage: {0}% (threshold: {1}%)",
        usage,
        threshold,
      ),
    highCpuTemperature: (temperature: string, threshold: number): string =>
      vscode.l10n.t(
        "High CPU temperature: {0}°C (threshold: {1}°C)",
        temperature,
        threshold,
      ),
  },

  tree: {
    processor: (): string => vscode.l10n.t("Processor"),
    cpuSummary: (usage: string, coreCount: number): string =>
      vscode.l10n.t("{0} · {1} cores", usage, coreCount),
    cpuTooltip: (usage: string): string =>
      vscode.l10n.t(
        "Total CPU usage: {0}%. Expand to view per-core load.",
        usage,
      ),
    memory: (): string => vscode.l10n.t("Memory"),
    memoryTooltip: (usage: string): string =>
      vscode.l10n.t("Memory usage: {0}%", usage),
    storage: (): string => vscode.l10n.t("Storage"),
    storageSummary: (volumeCount: number, maxUsage: string): string =>
      vscode.l10n.t("{0} volumes · Peak {1}%", volumeCount, maxUsage),
    storageTooltip: (): string =>
      vscode.l10n.t("Expand to view capacity and usage for each mount point"),
    network: (): string => vscode.l10n.t("Network"),
    networkInterfaces: (count: number): string =>
      vscode.l10n.t("{0} network interfaces", count),
    system: (): string => vscode.l10n.t("System"),
    unknown: (): string => vscode.l10n.t("Unknown"),
    systemUnavailable: (): string =>
      vscode.l10n.t("System information unavailable"),
    cpuTemperature: (): string => vscode.l10n.t("CPU Temperature"),
    unavailable: (): string => vscode.l10n.t("Unavailable"),
    cpuTemperatureUnavailable: (): string =>
      vscode.l10n.t("CPU temperature is unavailable on this system"),
    alertThreshold: (threshold: number): string =>
      vscode.l10n.t("Alert threshold: {0}°C", threshold),
    battery: (): string => vscode.l10n.t("Battery"),
    coreUsage: (core: string, usage: string): string =>
      vscode.l10n.t("Current usage of {0}: {1}%", core, usage),
    usage: (): string => vscode.l10n.t("Usage"),
    used: (): string => vscode.l10n.t("Used"),
    available: (): string => vscode.l10n.t("Available"),
    total: (): string => vscode.l10n.t("Total"),
    diskUsage: (mount: string, used: string, total: string): string =>
      vscode.l10n.t("{0}: {1} used, {2} total", mount, used, total),
    networkThroughput: (interfaceName: string): string =>
      vscode.l10n.t("Real-time network throughput for {0}", interfaceName),
    hostname: (): string => vscode.l10n.t("Hostname"),
    distribution: (): string => vscode.l10n.t("Distribution"),
    platform: (): string => vscode.l10n.t("Platform"),
    kernel: (): string => vscode.l10n.t("Kernel"),
    cpuModel: (): string => vscode.l10n.t("CPU Model"),
    loading: (): string => vscode.l10n.t("Loading hardware data…"),
    systemDisk: (): string => vscode.l10n.t("System Disk (/)"),
    unnamedDisk: (): string => vscode.l10n.t("Unnamed Disk"),
    core: (index: string): string => vscode.l10n.t("Core {0}", index),
    charging: (): string => vscode.l10n.t("Charging"),
    connectedToPower: (): string => vscode.l10n.t("Connected to AC power"),
    onBattery: (): string => vscode.l10n.t("On battery"),
    batterySummary: (percent: string, state: string): string =>
      vscode.l10n.t("{0} ({1})", percent, state),
    noBatteryInfo: (): string =>
      vscode.l10n.t("No battery information is available for this device"),
    batteryLevel: (percent: string): string =>
      vscode.l10n.t("Battery level: {0}", percent),
    chargingStatus: (status: string): string =>
      vscode.l10n.t("Charging status: {0}", status),
    notCharging: (): string => vscode.l10n.t("Not charging"),
    externalPower: (status: string): string =>
      vscode.l10n.t("External power: {0}", status),
    connected: (): string => vscode.l10n.t("Connected"),
    disconnected: (): string => vscode.l10n.t("Disconnected"),
  },
} as const;
