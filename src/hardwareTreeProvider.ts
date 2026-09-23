import * as vscode from "vscode";
import { text } from "./i18n";
import type {
  BluetoothControllerSnapshot,
  BluetoothDeviceSnapshot,
  CameraSnapshot,
  DisplaySnapshot,
  MonitorSnapshot,
  MotherboardSnapshot,
  StorageDiskSnapshot,
} from "./shared/protocol";

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
    const systemDisk = snapshot.systemDisk;
    const totalDownload = snapshot.network.reduce(
      (total, item) => total + item.rxSec,
      0,
    );
    const totalUpload = snapshot.network.reduce(
      (total, item) => total + item.txSec,
      0,
    );
    const primaryGpu = snapshot.gpus[0];
    const primaryDisplay = snapshot.displays[0];
    const primaryCamera = snapshot.cameras[0];
    const connectedBluetoothCount = snapshot.bluetooth.devices.filter(
      (device) => device.connected,
    ).length;
    const hasBluetoothInfo =
      snapshot.bluetooth.controller !== null ||
      snapshot.bluetooth.devices.length > 0;

    return [
      new HardwareTreeItem(
        text.tree.processor(),
        vscode.TreeItemCollapsibleState.Collapsed,
        "cpu",
        "chip",
        text.tree.cpuRootSummary(
          formatPercent(snapshot.cpu.usage),
          formatOptionalTreeValue(snapshot.cpu.model),
        ),
        text.tree.cpuTooltip(snapshot.cpu.usage.toFixed(1)),
      ),
      new HardwareTreeItem(
        text.tree.memory(),
        vscode.TreeItemCollapsibleState.Collapsed,
        "memory",
        "layers",
        text.tree.memoryRootSummary(
          formatPercent(snapshot.memory.usage),
          formatBytes(snapshot.memory.total),
        ),
        text.tree.memoryTooltip(
          snapshot.memory.usage.toFixed(1),
          formatBytes(snapshot.memory.total),
        ),
      ),
      new HardwareTreeItem(
        text.tree.motherboard(),
        snapshot.motherboard
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
        "motherboard",
        "server",
        snapshot.motherboard
          ? formatMotherboardRootSummary(snapshot.motherboard)
          : text.tree.unavailable(),
        snapshot.motherboard
          ? text.tree.motherboardTooltip()
          : text.tree.motherboardUnavailable(),
      ),
      new HardwareTreeItem(
        text.tree.storage(),
        snapshot.storageDisks.length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
        "disk",
        "save",
        systemDisk
          ? text.tree.storageCapacitySummary(
              formatPercent(systemDisk.usage),
              formatBytes(systemDisk.total),
            )
          : text.tree.unavailable(),
        text.tree.storageTooltip(),
      ),
      new HardwareTreeItem(
        text.tree.gpu(),
        snapshot.gpus.length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
        "gpu",
        "circuit-board",
        primaryGpu
          ? formatGpuUsage(primaryGpu)
          : text.tree.unavailable(),
        primaryGpu
          ? text.tree.gpuTooltip(formatGpuUsage(primaryGpu))
          : text.tree.gpuUnavailable(),
      ),
      new HardwareTreeItem(
        text.tree.display(),
        snapshot.displays.length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
        "display",
        "screen-full",
        primaryDisplay
          ? formatDisplayRootSummary(snapshot.displays, primaryDisplay)
          : text.tree.unavailable(),
        primaryDisplay
          ? text.tree.displayTooltip(snapshot.displays.length)
          : text.tree.displayUnavailable(),
      ),
      new HardwareTreeItem(
        text.tree.camera(),
        snapshot.cameras.length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
        "camera",
        "device-camera",
        primaryCamera
          ? formatCameraRootSummary(snapshot.cameras, primaryCamera)
          : text.tree.unavailable(),
        primaryCamera
          ? text.tree.cameraTooltip(snapshot.cameras.length)
          : text.tree.cameraUnavailable(),
      ),
      new HardwareTreeItem(
        text.tree.network(),
        vscode.TreeItemCollapsibleState.Collapsed,
        "network",
        "globe",
        `↓ ${formatSpeed(totalDownload)} · ↑ ${formatSpeed(totalUpload)}`,
        text.tree.networkInterfaces(snapshot.network.length),
      ),
      new HardwareTreeItem(
        text.tree.bluetooth(),
        hasBluetoothInfo
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
        "bluetooth",
        "radio-tower",
        formatBluetoothRootDescription(
          snapshot.bluetooth.controller,
          snapshot.bluetooth.devices.length,
          connectedBluetoothCount,
        ),
        snapshot.bluetooth.devices.length > 0
          ? text.tree.bluetoothDevices(snapshot.bluetooth.devices.length)
          : snapshot.bluetooth.controller
            ? formatBluetoothControllerLabel(snapshot.bluetooth.controller)
            : text.tree.bluetoothUnavailable(),
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
      ),
      new HardwareTreeItem(
        text.tree.battery(),
        vscode.TreeItemCollapsibleState.None,
        "battery",
        snapshot.battery?.isCharging ? "plug" : "zap",
        formatBattery(snapshot),
        formatBatteryTooltip(snapshot),
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
      case "cpu": {
        const { cpu } = snapshot;

        return [
          new HardwareTreeItem(
            text.tree.cpuManufacturer(),
            none,
            "cpu-manufacturer",
            undefined,
            formatOptionalTreeValue(cpu.manufacturer),
          ),
          new HardwareTreeItem(
            text.tree.cpuModel(),
            none,
            "cpu-model",
            undefined,
            formatOptionalTreeValue(cpu.model),
          ),
          new HardwareTreeItem(
            text.tree.cpuArchitecture(),
            none,
            "cpu-architecture",
            undefined,
            formatOptionalTreeValue(cpu.architecture),
          ),
          new HardwareTreeItem(
            text.tree.cpuCoreCount(),
            none,
            "cpu-core-count",
            undefined,
            cpu.coreCount > 0
              ? String(cpu.coreCount)
              : text.tree.unavailable(),
          ),
          new HardwareTreeItem(
            text.tree.cpuBaseFrequency(),
            none,
            "cpu-base-frequency",
            undefined,
            formatOptionalTreeValue(cpu.baseFrequency),
          ),
          new HardwareTreeItem(
            text.tree.cpuProcessTechnology(),
            none,
            "cpu-process-technology",
            undefined,
            formatOptionalTreeValue(cpu.processTechnology),
          ),
          new HardwareTreeItem(
            text.tree.cpuTdp(),
            none,
            "cpu-tdp",
            undefined,
            formatOptionalTreeValue(cpu.tdp),
          ),
        ];
      }

      case "memory": {
        const { memory } = snapshot;

        return [
          new HardwareTreeItem(
            text.tree.memoryModel(),
            none,
            "memory-model",
            undefined,
            formatOptionalTreeValue(memory.model),
          ),
          new HardwareTreeItem(
            text.tree.memoryManufacturer(),
            none,
            "memory-manufacturer",
            undefined,
            formatOptionalTreeValue(memory.manufacturer),
          ),
          new HardwareTreeItem(
            text.tree.memoryType(),
            none,
            "memory-type",
            undefined,
            formatOptionalTreeValue(memory.type),
          ),
          new HardwareTreeItem(
            text.tree.memoryTotalCapacity(),
            none,
            "memory-total",
            undefined,
            formatBytes(memory.total),
          ),
          new HardwareTreeItem(
            text.tree.memoryUsed(),
            none,
            "memory-used",
            undefined,
            formatBytes(memory.used),
          ),
          new HardwareTreeItem(
            text.tree.memoryCached(),
            none,
            "memory-cached",
            undefined,
            formatBytes(memory.cached),
          ),
          new HardwareTreeItem(
            text.tree.memorySwapUsed(),
            none,
            "memory-swap-used",
            undefined,
            formatBytes(memory.swapUsed),
          ),
          new HardwareTreeItem(
            text.tree.memoryTdp(),
            none,
            "memory-tdp",
            undefined,
            formatOptionalTreeValue(memory.tdp),
          ),
          new HardwareTreeItem(
            text.tree.memoryModuleCapacity(),
            none,
            "memory-module-capacity",
            undefined,
            formatOptionalTreeValue(memory.moduleCapacity),
          ),
        ];
      }

      case "motherboard": {
        if (!snapshot.motherboard) {
          return [
            HardwareTreeItem.createUnavailable(
              "motherboard-unavailable",
              text.tree.motherboardUnavailable(),
            ),
          ];
        }

        return buildMotherboardFieldItems(snapshot.motherboard);
      }

      case "disk": {
        if (snapshot.storageDisks.length === 0) {
          return [
            HardwareTreeItem.createUnavailable(
              "storage-unavailable",
              text.tree.unavailable(),
            ),
          ];
        }

        return snapshot.storageDisks.map(
          (disk, index) =>
            new HardwareTreeItem(
              disk.name || disk.vendor || text.tree.physicalDisk(),
              vscode.TreeItemCollapsibleState.Collapsed,
              `storage-disk-${index}`,
              undefined,
              formatBytes(disk.size),
            ),
        );
      }

      case "gpu":
        if (snapshot.gpus.length === 0) {
          return [
            HardwareTreeItem.createUnavailable(
              "gpu-unavailable",
              text.tree.gpuUnavailable(),
            ),
          ];
        }

        return snapshot.gpus.flatMap((gpu, index) => {
          const suffix =
            snapshot.gpus.length > 1 ? ` #${index + 1}` : "";

          return [
            new HardwareTreeItem(
              `${text.tree.gpuModel()}${suffix}`,
              none,
              `gpu-${index}-model`,
              undefined,
              formatOptionalTreeValue(gpu.model),
            ),
            new HardwareTreeItem(
              `${text.tree.gpuVendor()}${suffix}`,
              none,
              `gpu-${index}-vendor`,
              undefined,
              formatOptionalTreeValue(gpu.vendor),
            ),
            new HardwareTreeItem(
              `${text.tree.gpuVram()}${suffix}`,
              none,
              `gpu-${index}-vram`,
              undefined,
              formatGpuVram(gpu),
            ),
            new HardwareTreeItem(
              `${text.tree.gpuBus()}${suffix}`,
              none,
              `gpu-${index}-bus`,
              undefined,
              formatOptionalTreeValue(gpu.bus),
            ),
            new HardwareTreeItem(
              `${text.tree.gpuCores()}${suffix}`,
              none,
              `gpu-${index}-cores`,
              undefined,
              formatOptionalTreeValue(gpu.cores),
            ),
            new HardwareTreeItem(
              `${text.tree.gpuProcessTechnology()}${suffix}`,
              none,
              `gpu-${index}-process-technology`,
              undefined,
              formatOptionalTreeValue(gpu.processTechnology),
            ),
            new HardwareTreeItem(
              `${text.tree.gpuTdp()}${suffix}`,
              none,
              `gpu-${index}-tdp`,
              undefined,
              formatOptionalTreeValue(gpu.tdp),
            ),
          ];
        });

      case "display":
        if (snapshot.displays.length === 0) {
          return [
            HardwareTreeItem.createUnavailable(
              "display-unavailable",
              text.tree.displayUnavailable(),
            ),
          ];
        }

        return snapshot.displays.map(
          (display, index) =>
            new HardwareTreeItem(
              formatDisplayLabel(display),
              vscode.TreeItemCollapsibleState.Collapsed,
              `display-${index}`,
              undefined,
              formatDisplayDescription(display),
              formatDisplayTooltip(display),
            ),
        );

      case "camera":
        if (snapshot.cameras.length === 0) {
          return [
            HardwareTreeItem.createUnavailable(
              "camera-unavailable",
              text.tree.cameraUnavailable(),
            ),
          ];
        }

        return snapshot.cameras.map(
          (camera, index) =>
            new HardwareTreeItem(
              formatCameraLabel(camera),
              vscode.TreeItemCollapsibleState.Collapsed,
              `camera-${index}`,
              undefined,
              formatCameraDescription(camera),
              formatCameraTooltip(camera),
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
              ),
          );

      case "bluetooth": {
        if (
          !snapshot.bluetooth.controller &&
          snapshot.bluetooth.devices.length === 0
        ) {
          return [
            HardwareTreeItem.createUnavailable(
              "bluetooth-unavailable",
              text.tree.bluetoothUnavailable(),
            ),
          ];
        }

        const controllerItems = snapshot.bluetooth.controller
          ? buildBluetoothControllerItems(snapshot.bluetooth.controller)
          : [];
        const deviceItems = [...snapshot.bluetooth.devices]
          .sort((left, right) => compareBluetoothDevices(left, right))
          .map(
            (device, index) =>
              new HardwareTreeItem(
                device.name,
                none,
                `bluetooth-${index}-${device.macAddress || device.name}`,
                undefined,
                formatBluetoothDescription(device),
                formatBluetoothTooltip(device),
              ),
          );

        if (deviceItems.length === 0) {
          return [
            ...controllerItems,
            HardwareTreeItem.createUnavailable(
              "bluetooth-no-devices",
              text.tree.bluetoothNoPairedDevices(),
            ),
          ];
        }

        return [...controllerItems, ...deviceItems];
      }

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
        ];
      }

      default: {
        if (id.startsWith("storage-disk-")) {
          const index = Number.parseInt(id.slice("storage-disk-".length), 10);
          const disk = snapshot.storageDisks[index];

          if (!disk) {
            return [];
          }

          return buildStorageDiskFieldItems(disk);
        }

        if (id.startsWith("display-")) {
          const index = Number.parseInt(id.slice("display-".length), 10);
          const display = snapshot.displays[index];

          if (!display) {
            return [];
          }

          return buildDisplayFieldItems(display);
        }

        if (id.startsWith("camera-")) {
          const index = Number.parseInt(id.slice("camera-".length), 10);
          const camera = snapshot.cameras[index];

          if (!camera) {
            return [];
          }

          return buildCameraFieldItems(camera);
        }

        return [];
      }
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
  ) {
    super(label, collapsibleState);

    this.id = id;
    if (icon !== undefined) {
      this.iconPath = new vscode.ThemeIcon(icon);
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

/** 显示器根节点摘要，例如 2 块 · 主屏 1512×982 */
function formatDisplayRootSummary(
  displays: DisplaySnapshot[],
  primaryDisplay: DisplaySnapshot,
): string {
  const primaryResolution =
    primaryDisplay.currentResolution ||
    primaryDisplay.nativeResolution ||
    text.tree.unavailable();

  return text.tree.displaySummary(displays.length, primaryResolution);
}

/** 单个显示器节点标题 */
function formatDisplayLabel(display: DisplaySnapshot): string {
  const name =
    display.model || display.vendor || text.tree.display();

  return name;
}

/** 单个显示器节点描述 */
function formatDisplayDescription(display: DisplaySnapshot): string {
  const parts = [
    formatOptionalTreeValue(display.vendor),
    formatOptionalTreeValue(
      display.currentResolution || display.nativeResolution,
    ),
  ];

  if (display.refreshRate !== null) {
    parts.push(text.tree.displayRefreshRateValue(display.refreshRate));
  }

  return parts.join(" · ");
}

/** 单个显示器节点悬停提示 */
function formatDisplayTooltip(display: DisplaySnapshot): string {
  return [
    `${text.tree.displayModel()}: ${formatOptionalTreeValue(display.model)}`,
    `${text.tree.displayVendor()}: ${formatOptionalTreeValue(display.vendor)}`,
    `${text.tree.displayNativeResolution()}: ${formatOptionalTreeValue(display.nativeResolution)}`,
    `${text.tree.displayCurrentResolution()}: ${formatOptionalTreeValue(display.currentResolution)}`,
    `${text.tree.displayRefreshRate()}: ${
      display.refreshRate === null
        ? text.tree.unavailable()
        : text.tree.displayRefreshRateValue(display.refreshRate)
    }`,
    `${text.tree.displayPixelDepth()}: ${
      display.pixelDepth === null
        ? text.tree.unavailable()
        : text.tree.displayPixelDepthValue(display.pixelDepth)
    }`,
    `${text.tree.displayPhysicalSize()}: ${formatOptionalTreeValue(display.physicalSize)}`,
  ].join("\n");
}

/** 摄像头根节点摘要，例如 2 个 · 内置 FaceTime HD Camera */
function formatCameraRootSummary(
  cameras: CameraSnapshot[],
  primaryCamera: CameraSnapshot,
): string {
  const primaryName =
    primaryCamera.model || primaryCamera.vendor || text.tree.unavailable();

  return text.tree.cameraSummary(cameras.length, primaryName);
}

/** 单个摄像头节点标题 */
function formatCameraLabel(camera: CameraSnapshot): string {
  return camera.model || camera.vendor || text.tree.camera();
}

/** 单个摄像头节点描述 */
function formatCameraDescription(camera: CameraSnapshot): string {
  const parts = [formatOptionalTreeValue(camera.vendor)];

  if (camera.maxResolution) {
    parts.push(camera.maxResolution);
  }

  if (camera.frameRate !== null) {
    parts.push(text.tree.cameraFrameRateValue(camera.frameRate));
  }

  return parts.join(" · ");
}

/** 单个摄像头节点悬停提示 */
function formatCameraTooltip(camera: CameraSnapshot): string {
  return [
    `${text.tree.cameraModel()}: ${formatOptionalTreeValue(camera.model)}`,
    `${text.tree.cameraVendor()}: ${formatOptionalTreeValue(camera.vendor)}`,
    `${text.tree.cameraMaxResolution()}: ${formatOptionalTreeValue(camera.maxResolution)}`,
    `${text.tree.cameraFrameRate()}: ${
      camera.frameRate === null
        ? text.tree.unavailable()
        : text.tree.cameraFrameRateValue(camera.frameRate)
    }`,
  ].join("\n");
}

/** 构建单个摄像头的字段子节点 */
function buildCameraFieldItems(camera: CameraSnapshot): HardwareTreeItem[] {
  const none = vscode.TreeItemCollapsibleState.None;

  return [
    new HardwareTreeItem(
      text.tree.cameraModel(),
      none,
      "camera-field-model",
      undefined,
      formatOptionalTreeValue(camera.model),
    ),
    new HardwareTreeItem(
      text.tree.cameraVendor(),
      none,
      "camera-field-vendor",
      undefined,
      formatOptionalTreeValue(camera.vendor),
    ),
    new HardwareTreeItem(
      text.tree.cameraMaxResolution(),
      none,
      "camera-field-max-resolution",
      undefined,
      formatOptionalTreeValue(camera.maxResolution),
    ),
    new HardwareTreeItem(
      text.tree.cameraFrameRate(),
      none,
      "camera-field-frame-rate",
      undefined,
      camera.frameRate === null
        ? text.tree.unavailable()
        : text.tree.cameraFrameRateValue(camera.frameRate),
    ),
  ];
}

/** 构建单个显示器的字段子节点 */
function buildDisplayFieldItems(display: DisplaySnapshot): HardwareTreeItem[] {
  const none = vscode.TreeItemCollapsibleState.None;

  return [
    new HardwareTreeItem(
      text.tree.displayModel(),
      none,
      "display-field-model",
      undefined,
      formatOptionalTreeValue(display.model),
    ),
    new HardwareTreeItem(
      text.tree.displayVendor(),
      none,
      "display-field-vendor",
      undefined,
      formatOptionalTreeValue(display.vendor),
    ),
    new HardwareTreeItem(
      text.tree.displayNativeResolution(),
      none,
      "display-field-native-resolution",
      undefined,
      formatOptionalTreeValue(display.nativeResolution),
    ),
    new HardwareTreeItem(
      text.tree.displayCurrentResolution(),
      none,
      "display-field-current-resolution",
      undefined,
      formatOptionalTreeValue(display.currentResolution),
    ),
    new HardwareTreeItem(
      text.tree.displayRefreshRate(),
      none,
      "display-field-refresh-rate",
      undefined,
      display.refreshRate === null
        ? text.tree.unavailable()
        : text.tree.displayRefreshRateValue(display.refreshRate),
    ),
    new HardwareTreeItem(
      text.tree.displayPixelDepth(),
      none,
      "display-field-pixel-depth",
      undefined,
      display.pixelDepth === null
        ? text.tree.unavailable()
        : text.tree.displayPixelDepthValue(display.pixelDepth),
    ),
    new HardwareTreeItem(
      text.tree.displayPhysicalSize(),
      none,
      "display-field-physical-size",
      undefined,
      formatOptionalTreeValue(display.physicalSize),
    ),
  ];
}

/** 主板根节点摘要，例如 Apple Inc. · Mac15,3 */
function formatMotherboardRootSummary(
  motherboard: MotherboardSnapshot,
): string {
  const parts = [
    formatOptionalTreeValue(motherboard.manufacturer),
    formatOptionalTreeValue(motherboard.model),
  ].filter((value) => value !== text.tree.unavailable());

  if (parts.length > 0) {
    return parts.join(" · ");
  }

  return text.tree.unavailable();
}

/** 构建主板字段子节点 */
function buildMotherboardFieldItems(
  motherboard: MotherboardSnapshot,
): HardwareTreeItem[] {
  const none = vscode.TreeItemCollapsibleState.None;

  return [
    new HardwareTreeItem(
      text.tree.motherboardManufacturer(),
      none,
      "motherboard-manufacturer",
      undefined,
      formatOptionalTreeValue(motherboard.manufacturer),
    ),
    new HardwareTreeItem(
      text.tree.motherboardModel(),
      none,
      "motherboard-model",
      undefined,
      formatOptionalTreeValue(motherboard.model),
    ),
    new HardwareTreeItem(
      text.tree.motherboardVersion(),
      none,
      "motherboard-version",
      undefined,
      formatOptionalTreeValue(motherboard.version),
    ),
    new HardwareTreeItem(
      text.tree.motherboardMaxMemory(),
      none,
      "motherboard-max-memory",
      undefined,
      motherboard.maxMemory === null
        ? text.tree.unavailable()
        : formatBytes(motherboard.maxMemory),
    ),
    new HardwareTreeItem(
      text.tree.motherboardMemorySlots(),
      none,
      "motherboard-memory-slots",
      undefined,
      motherboard.memorySlots === null
        ? text.tree.unavailable()
        : text.tree.motherboardMemorySlotsValue(motherboard.memorySlots),
    ),
  ];
}

/** 构建单块磁盘的字段子节点 */
function buildStorageDiskFieldItems(
  disk: StorageDiskSnapshot,
): HardwareTreeItem[] {
  const none = vscode.TreeItemCollapsibleState.None;

  return [
    new HardwareTreeItem(
      text.tree.diskManufacturer(),
      none,
      "storage-field-manufacturer",
      undefined,
      formatOptionalTreeValue(disk.vendor),
    ),
    new HardwareTreeItem(
      text.tree.diskModel(),
      none,
      "storage-field-model",
      undefined,
      formatOptionalTreeValue(disk.name),
    ),
    new HardwareTreeItem(
      text.tree.diskCapacity(),
      none,
      "storage-field-capacity",
      undefined,
      formatBytes(disk.size),
    ),
    new HardwareTreeItem(
      text.tree.diskType(),
      none,
      "storage-field-type",
      undefined,
      formatOptionalTreeValue(disk.type),
    ),
    new HardwareTreeItem(
      text.tree.diskInterfaceType(),
      none,
      "storage-field-interface",
      undefined,
      formatOptionalTreeValue(disk.interfaceType),
    ),
    new HardwareTreeItem(
      text.tree.diskTotalCapacity(),
      none,
      "storage-field-total",
      undefined,
      formatBytes(disk.total),
    ),
    new HardwareTreeItem(
      text.tree.diskUsed(),
      none,
      "storage-field-used",
      undefined,
      formatBytes(disk.used),
    ),
    new HardwareTreeItem(
      text.tree.diskReadWriteSpeed(),
      none,
      "storage-field-io",
      undefined,
      formatDiskReadWriteSpeed(disk),
    ),
  ];
}

/** 格式化磁盘读写速率 */
function formatDiskReadWriteSpeed(disk: StorageDiskSnapshot): string {
  if (disk.readSec === null || disk.writeSec === null) {
    return text.tree.unavailable();
  }

  return text.tree.diskReadWriteSummary(
    formatSpeed(disk.readSec),
    formatSpeed(disk.writeSec),
  );
}

/** 树节点右侧值：空字符串时显示“不可用” */
function formatOptionalTreeValue(value: string): string {
  return value || text.tree.unavailable();
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

/** GPU 使用率格式化 */
function formatGpuUsage(gpu: { usage: number | null }): string {
  if (gpu.usage === null || !Number.isFinite(gpu.usage)) {
    return text.tree.unavailable();
  }

  return formatPercent(gpu.usage);
}

/** GPU 显存容量格式化 */
function formatGpuVram(gpu: {
  vram: number | null;
  vramDynamic: boolean;
}): string {
  if (gpu.vram !== null) {
    return formatBytes(gpu.vram);
  }

  if (gpu.vramDynamic) {
    return text.tree.gpuSharedMemory();
  }

  return text.tree.unavailable();
}

/** 只显示百分比，用于资源使用率等紧凑节点 */
function formatPercent(value: number): string {
  const normalized = Math.min(100, Math.max(0, value));

  return `${normalized.toFixed(1)}%`;
}

/** 蓝牙根节点摘要 */
function formatBluetoothRootDescription(
  controller: BluetoothControllerSnapshot | null,
  deviceCount: number,
  connectedCount: number,
): string {
  if (deviceCount > 0) {
    return text.tree.bluetoothSummary(deviceCount, connectedCount);
  }

  if (controller) {
    return formatBluetoothControllerLabel(controller);
  }

  return text.tree.unavailable();
}

/** 控制器节点标题，例如 Apple · BCM_4388 */
function formatBluetoothControllerLabel(
  controller: BluetoothControllerSnapshot,
): string {
  const vendor = extractBluetoothVendorName(controller.vendor);
  const parts = [vendor, controller.chipset].filter(Boolean);

  if (parts.length > 0) {
    return parts.length === 2
      ? text.tree.bluetoothControllerSummary(vendor, controller.chipset)
      : parts[0]!;
  }

  return text.tree.bluetoothController();
}

/** 从 vendorID 字符串中提取可读厂商名 */
function extractBluetoothVendorName(vendor: string): string {
  const match = vendor.match(/\(([^)]+)\)/);
  return match?.[1]?.trim() || vendor.trim();
}

/** 构建蓝牙控制器硬件子节点 */
function buildBluetoothControllerItems(
  controller: BluetoothControllerSnapshot,
): HardwareTreeItem[] {
  const vendor = extractBluetoothVendorName(controller.vendor);
  const none = vscode.TreeItemCollapsibleState.None;

  return [
    new HardwareTreeItem(
      text.tree.bluetoothController(),
      none,
      "bluetooth-controller",
      undefined,
      formatBluetoothControllerLabel(controller),
    ),
    ...(vendor
      ? [
          new HardwareTreeItem(
            text.tree.bluetoothVendor(),
            none,
            "bluetooth-controller-vendor",
            undefined,
            vendor,
          ),
        ]
      : []),
    ...(controller.chipset
      ? [
          new HardwareTreeItem(
            text.tree.bluetoothChipset(),
            none,
            "bluetooth-controller-chipset",
            undefined,
            controller.chipset,
          ),
        ]
      : []),
    new HardwareTreeItem(
      text.tree.bluetooth(),
      none,
      "bluetooth-controller-state",
      undefined,
      controller.poweredOn
        ? text.tree.bluetoothPoweredOn()
        : text.tree.bluetoothPoweredOff(),
    ),
    new HardwareTreeItem(
      text.tree.bluetoothDiscoverable(),
      none,
      "bluetooth-controller-discoverable",
      undefined,
      controller.discoverable
        ? text.tree.bluetoothDiscoverable()
        : text.tree.bluetoothHidden(),
    ),
  ];
}

/** 蓝牙设备排序：已连接优先，其次按名称 */
function compareBluetoothDevices(
  left: BluetoothDeviceSnapshot,
  right: BluetoothDeviceSnapshot,
): number {
  if (left.connected !== right.connected) {
    return left.connected ? -1 : 1;
  }

  return left.name.localeCompare(right.name);
}

/** 蓝牙设备节点描述 */
function formatBluetoothDescription(
  device: BluetoothDeviceSnapshot,
): string {
  const parts = [
    device.connected ? text.tree.connected() : text.tree.disconnected(),
  ];

  if (device.batteryPercent !== null) {
    parts.push(`${device.batteryPercent.toFixed(0)}%`);
  }

  return parts.join(" · ");
}

/** 蓝牙设备节点悬停提示 */
function formatBluetoothTooltip(device: BluetoothDeviceSnapshot): string {
  const lines = [
    text.tree.deviceType(device.type),
    text.tree.connectionStatus(
      device.connected ? text.tree.connected() : text.tree.disconnected(),
    ),
  ];

  if (device.manufacturer) {
    lines.push(text.tree.manufacturer(device.manufacturer));
  }

  if (device.macAddress) {
    lines.push(text.tree.macAddress(device.macAddress));
  }

  if (device.batteryPercent !== null) {
    lines.push(text.tree.batteryLevel(`${device.batteryPercent.toFixed(0)}%`));
  }

  return lines.join("\n");
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

