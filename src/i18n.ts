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
    gpuModel: (model: string): string => vscode.l10n.t("GPU: {0}", model),
    gpuUnavailable: (): string => vscode.l10n.t("GPU: unavailable"),
    diskIo: (readSpeed: string, writeSpeed: string): string =>
      vscode.l10n.t("Disk I/O: ↓ {0} · ↑ {1}", readSpeed, writeSpeed),
    diskIoUnavailable: (): string => vscode.l10n.t("Disk I/O: unavailable"),
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
  },

  tree: {
    processor: (): string => vscode.l10n.t("Processor"),
    cpuRootSummary: (usage: string, model: string): string =>
      vscode.l10n.t("{0} · {1}", usage, model),
    cpuTooltip: (usage: string): string =>
      vscode.l10n.t("Total CPU usage: {0}%. Expand to view CPU details.", usage),
    memory: (): string => vscode.l10n.t("Memory"),
    memoryRootSummary: (usage: string, total: string): string =>
      vscode.l10n.t("{0} · {1}", usage, total),
    memoryTooltip: (usage: string, total: string): string =>
      vscode.l10n.t("Memory usage: {0}% ({1})", usage, total),
    storage: (): string => vscode.l10n.t("Storage"),
    storageCapacitySummary: (usage: string, total: string): string =>
      vscode.l10n.t("{0} · {1}", usage, total),
    storageTooltip: (): string =>
      vscode.l10n.t(
        "System disk usage and total capacity. Expand to view each drive.",
      ),
    diskManufacturer: (): string => vscode.l10n.t("Disk Manufacturer"),
    diskModel: (): string => vscode.l10n.t("Disk Model"),
    diskCapacity: (): string => vscode.l10n.t("Disk Capacity"),
    diskType: (): string => vscode.l10n.t("Disk Type"),
    diskInterfaceType: (): string => vscode.l10n.t("Disk Interface Type"),
    diskTotalCapacity: (): string => vscode.l10n.t("Disk Total Capacity"),
    diskUsed: (): string => vscode.l10n.t("Disk Used"),
    diskReadWriteSpeed: (): string => vscode.l10n.t("Disk Read/Write Speed"),
    diskReadWriteSummary: (readSpeed: string, writeSpeed: string): string =>
      vscode.l10n.t("↓ {0} · ↑ {1}", readSpeed, writeSpeed),
    gpu: (): string => vscode.l10n.t("GPU"),
    gpuTooltip: (usage: string): string =>
      vscode.l10n.t(
        "GPU usage: {0}%. Expand to view GPU details.",
        usage,
      ),
    gpuModel: (): string => vscode.l10n.t("GPU Model"),
    gpuVendor: (): string => vscode.l10n.t("GPU Vendor"),
    gpuVram: (): string => vscode.l10n.t("VRAM"),
    gpuBus: (): string => vscode.l10n.t("Bus"),
    gpuCores: (): string => vscode.l10n.t("GPU cores"),
    gpuProcessTechnology: (): string =>
      vscode.l10n.t("GPU Process Technology"),
    gpuTdp: (): string => vscode.l10n.t("GPU TDP"),
    gpuSharedMemory: (): string => vscode.l10n.t("Shared memory"),
    gpuUnavailable: (): string =>
      vscode.l10n.t("No GPU information is available on this system"),
    display: (): string => vscode.l10n.t("Display"),
    displayTooltip: (count: number): string =>
      vscode.l10n.t(
        "{0} display(s). Expand to view built-in and external monitor details.",
        count,
      ),
    displaySummary: (count: number, primaryResolution: string): string =>
      vscode.l10n.t("{0} displays · primary {1}", count, primaryResolution),
    displayUnavailable: (): string =>
      vscode.l10n.t("No display information is available on this system"),
    displayModel: (): string => vscode.l10n.t("Display Model"),
    displayVendor: (): string => vscode.l10n.t("Display Vendor"),
    displayNativeResolution: (): string =>
      vscode.l10n.t("Native Resolution"),
    displayCurrentResolution: (): string =>
      vscode.l10n.t("Current Resolution"),
    displayRefreshRate: (): string => vscode.l10n.t("Refresh Rate"),
    displayPixelDepth: (): string => vscode.l10n.t("Color Depth"),
    displayPhysicalSize: (): string => vscode.l10n.t("Physical Size"),
    displayRefreshRateValue: (rate: number): string =>
      vscode.l10n.t("{0} Hz", String(rate)),
    displayPixelDepthValue: (depth: number): string =>
      vscode.l10n.t("{0}-bit", String(depth)),
    camera: (): string => vscode.l10n.t("Camera"),
    cameraTooltip: (count: number): string =>
      vscode.l10n.t(
        "{0} camera(s). Expand to view built-in and external camera details.",
        count,
      ),
    cameraSummary: (count: number, primaryName: string): string =>
      vscode.l10n.t("{0} cameras · {1}", count, primaryName),
    cameraUnavailable: (): string =>
      vscode.l10n.t("No camera information is available on this system"),
    cameraModel: (): string => vscode.l10n.t("Camera Model"),
    cameraVendor: (): string => vscode.l10n.t("Camera Vendor"),
    cameraMaxResolution: (): string => vscode.l10n.t("Max Resolution"),
    cameraFrameRate: (): string => vscode.l10n.t("Frame Rate"),
    cameraFrameRateValue: (rate: number): string =>
      vscode.l10n.t("{0} fps", rate.toFixed(rate % 1 === 0 ? 0 : 1)),
    network: (): string => vscode.l10n.t("Network"),
    networkInterfaces: (count: number): string =>
      vscode.l10n.t("{0} network interfaces", count),
    bluetooth: (): string => vscode.l10n.t("Bluetooth"),
    bluetoothSummary: (deviceCount: number, connectedCount: number): string =>
      vscode.l10n.t(
        "{0} devices · {1} connected",
        deviceCount,
        connectedCount,
      ),
    bluetoothControllerSummary: (vendor: string, chipset: string): string =>
      vscode.l10n.t("{0} · {1}", vendor, chipset),
    bluetoothDevices: (count: number): string =>
      vscode.l10n.t("{0} Bluetooth devices", count),
    bluetoothUnavailable: (): string =>
      vscode.l10n.t("Bluetooth information is unavailable on this system"),
    bluetoothController: (): string => vscode.l10n.t("Bluetooth adapter"),
    bluetoothChipset: (): string => vscode.l10n.t("Chipset"),
    bluetoothVendor: (): string => vscode.l10n.t("Vendor"),
    bluetoothProductId: (): string => vscode.l10n.t("Product ID"),
    bluetoothFirmware: (): string => vscode.l10n.t("Firmware"),
    bluetoothTransport: (): string => vscode.l10n.t("Transport"),
    bluetoothPoweredOn: (): string => vscode.l10n.t("Powered on"),
    bluetoothPoweredOff: (): string => vscode.l10n.t("Powered off"),
    bluetoothDiscoverable: (): string => vscode.l10n.t("Discoverable"),
    bluetoothHidden: (): string => vscode.l10n.t("Not discoverable"),
    bluetoothSupportedServices: (): string =>
      vscode.l10n.t("Supported services"),
    bluetoothControllerAddress: (): string =>
      vscode.l10n.t("Controller address"),
    bluetoothNoPairedDevices: (): string =>
      vscode.l10n.t("No paired Bluetooth devices"),
    deviceType: (type: string): string => vscode.l10n.t("Device type: {0}", type),
    connectionStatus: (status: string): string =>
      vscode.l10n.t("Connection status: {0}", status),
    manufacturer: (name: string): string =>
      vscode.l10n.t("Manufacturer: {0}", name),
    macAddress: (address: string): string =>
      vscode.l10n.t("MAC address: {0}", address),
    system: (): string => vscode.l10n.t("System"),
    unknown: (): string => vscode.l10n.t("Unknown"),
    systemUnavailable: (): string =>
      vscode.l10n.t("System information unavailable"),
    unavailable: (): string => vscode.l10n.t("Unavailable"),
    battery: (): string => vscode.l10n.t("Battery"),
    coreUsage: (core: string, usage: string): string =>
      vscode.l10n.t("Current usage of {0}: {1}%", core, usage),
    usage: (): string => vscode.l10n.t("Usage"),
    used: (): string => vscode.l10n.t("Used"),
    available: (): string => vscode.l10n.t("Available"),
    total: (): string => vscode.l10n.t("Total"),
    networkThroughput: (interfaceName: string): string =>
      vscode.l10n.t("Real-time network throughput for {0}", interfaceName),
    hostname: (): string => vscode.l10n.t("Hostname"),
    distribution: (): string => vscode.l10n.t("Distribution"),
    platform: (): string => vscode.l10n.t("Platform"),
    kernel: (): string => vscode.l10n.t("Kernel"),
    cpuModel: (): string => vscode.l10n.t("CPU Model"),
    cpuManufacturer: (): string => vscode.l10n.t("CPU Manufacturer"),
    cpuArchitecture: (): string => vscode.l10n.t("CPU Architecture"),
    cpuCoreCount: (): string => vscode.l10n.t("CPU Core Count"),
    cpuBaseFrequency: (): string => vscode.l10n.t("CPU Base Frequency"),
    cpuProcessTechnology: (): string => vscode.l10n.t("CPU Process Technology"),
    cpuTdp: (): string => vscode.l10n.t("CPU TDP"),
    memoryModel: (): string => vscode.l10n.t("Memory Model"),
    memoryManufacturer: (): string => vscode.l10n.t("Memory Manufacturer"),
    memoryType: (): string => vscode.l10n.t("Memory Type"),
    memoryTotalCapacity: (): string =>
      vscode.l10n.t("Memory Total Capacity"),
    memoryUsed: (): string => vscode.l10n.t("Memory Used"),
    memoryCached: (): string => vscode.l10n.t("Memory Cached Files"),
    memorySwapUsed: (): string => vscode.l10n.t("Memory Swap Used"),
    memoryTdp: (): string => vscode.l10n.t("Memory TDP"),
    memoryModuleCapacity: (): string =>
      vscode.l10n.t("Memory Module Capacity"),
    motherboard: (): string => vscode.l10n.t("Motherboard"),
    motherboardTooltip: (): string =>
      vscode.l10n.t("Expand to view motherboard details."),
    motherboardUnavailable: (): string =>
      vscode.l10n.t("No motherboard information is available on this system"),
    motherboardManufacturer: (): string =>
      vscode.l10n.t("Motherboard Manufacturer"),
    motherboardModel: (): string => vscode.l10n.t("Motherboard Model"),
    motherboardVersion: (): string => vscode.l10n.t("Motherboard Version"),
    motherboardMaxMemory: (): string =>
      vscode.l10n.t("Motherboard Max Memory"),
    motherboardMemorySlots: (): string =>
      vscode.l10n.t("Motherboard Memory Slots"),
    motherboardMemorySlotsValue: (count: number): string =>
      vscode.l10n.t("{0} slots", count),
    physicalDisk: (): string => vscode.l10n.t("Physical Disk"),
    loading: (): string => vscode.l10n.t("Loading hardware data…"),
    core: (index: string): string => vscode.l10n.t("Core {0}", index),
    charging: (): string => vscode.l10n.t("Charging"),
    connectedToPower: (): string => vscode.l10n.t("Connected to AC power"),
    onBattery: (): string => vscode.l10n.t("On battery"),
    batterySummary: (percent: string, state: string): string =>
      vscode.l10n.t("{0} · {1}", percent, state),
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
