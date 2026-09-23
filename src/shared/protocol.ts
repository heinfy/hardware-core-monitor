/**
 * 扩展宿主（Extension Host）与 Webview 之间的共享消息协议。
 *
 * 这是整个项目的通信边界：
 * - 扩展宿主运行在 Node.js 环境，负责采集 systeminformation 数据；
 * - Webview 运行在浏览器沙箱，只负责渲染 React 页面；
 * - 两边只允许通过这个文件里定义的类型通信，避免把巨大的原始对象
 *   或者 Node 专属能力泄漏进 Webview。
 */

/** CPU 快照 */
export interface CpuSnapshot {
  /** 总体使用率（0-100） */
  usage: number;
  /** CPU 制造商，例如 Intel、Apple */
  manufacturer: string;
  /** CPU 型号/品牌，例如 M3、Core i7-9700K */
  model: string;
  /** CPU 架构，例如 arm64、x64 */
  architecture: string;
  /** 物理核心数量 */
  coreCount: number;
  /** 基础频率，例如 2.40 GHz；不可用时为空字符串 */
  baseFrequency: string;
  /** 制程工艺，例如 5nm；不可用时为空字符串 */
  processTechnology: string;
  /** TDP / 功耗设计，例如 65 W；不可用时为空字符串 */
  tdp: string;
}

/** 内存快照 */
export interface MemorySnapshot {
  /** 使用率（0-100） */
  usage: number;
  /** 物理内存总容量（字节） */
  total: number;
  /** 已使用内存（字节）；macOS 对齐活动监视器口径 */
  used: number;
  /** 已缓存文件（字节）；macOS 对齐活动监视器“已缓存文件” */
  cached: number;
  /** 已使用的交换空间（字节） */
  swapUsed: number;
  /** 内存型号/物料编号，多条模组时用逗号分隔 */
  model: string;
  /** 内存制造商，多条模组时用逗号分隔 */
  manufacturer: string;
  /** 内存类型，例如 DDR4、LPDDR5；多条模组时用逗号分隔 */
  type: string;
  /** TDP / 功耗设计；不可用时为空字符串 */
  tdp: string;
  /** 单条容量展示文本，例如 16 GB；多条且容量不同时用逗号分隔 */
  moduleCapacity: string;
}

/** 单块物理磁盘的存储快照 */
export interface StorageDiskSnapshot {
  /** 制造商 */
  vendor: string;
  /** 型号/品牌 */
  name: string;
  /** 物理容量（字节） */
  size: number;
  /** 硬盘类型，例如 SSD、NVMe */
  type: string;
  /** 接口类型，例如 SATA、PCIe */
  interfaceType: string;
  /** 数据卷总容量（字节） */
  total: number;
  /** 数据卷已用空间（字节） */
  used: number;
  /** 每秒读取字节数，不可用时为 null */
  readSec: number | null;
  /** 每秒写入字节数，不可用时为 null */
  writeSec: number | null;
}

/** 系统所在盘符的使用率与总容量，供一级菜单展示 */
export interface SystemDiskSnapshot {
  /** 使用率（0-100） */
  usage: number;
  /** 总容量（字节） */
  total: number;
}

/** 单个 GPU 控制器硬件信息 */
export interface GpuSnapshot {
  /** 型号，例如 Apple M3、GeForce RTX 4090 */
  model: string;
  /** 厂商，例如 Apple、NVIDIA */
  vendor: string;
  /** 显存容量（字节），未报告时为 null */
  vram: number | null;
  /** 显存是否为动态分配（集成显卡常见） */
  vramDynamic: boolean;
  /** 连接总线，例如 Built-In、PCIe */
  bus: string;
  /** GPU 核心数（Apple Silicon 等），无数据时为空字符串 */
  cores: string;
  /** 制程工艺，例如 5nm；不可用时为空字符串 */
  processTechnology: string;
  /** TDP / 功耗设计，例如 450 W；不可用时为空字符串 */
  tdp: string;
  /** GPU 使用率（0-100），不可用时为 null */
  usage: number | null;
}

/** 网络接口快照 */
export interface NetworkInterfaceSnapshot {
  iface: string;
  /** 每秒接收字节数 */
  rxSec: number;
  /** 每秒发送字节数 */
  txSec: number;
}

/** 主板硬件快照；采集失败或无数据时为 null */
export interface MotherboardSnapshot {
  /** 主板制造商，例如 Apple Inc.、ASUSTeK */
  manufacturer: string;
  /** 主板型号，例如 Mac15,3、ROG STRIX B550-F */
  model: string;
  /** 主板版本号；不可用时为空字符串 */
  version: string;
  /** 最大支持内存（字节），未知时为 null */
  maxMemory: number | null;
  /** 内存插槽数量，未知时为 null */
  memorySlots: number | null;
}

/** 静态系统信息，变化频率低，可以随快照一起发送 */
export interface SystemSnapshot {
  platform: string;
  distro: string;
  release: string;
  kernel: string;
  hostname: string;
  arch: string;
  cpuModel: string;
  /** CPU 制造商 */
  cpuManufacturer: string;
}

/** 蓝牙控制器硬件快照 */
export interface BluetoothControllerSnapshot {
  /** 控制器 MAC 地址 */
  address: string;
  /** 芯片型号，例如 BCM_4388 */
  chipset: string;
  /** 厂商 */
  vendor: string;
  /** 产品 ID */
  productId: string;
  /** 固件版本 */
  firmwareVersion: string;
  /** 连接方式，例如 PCIe、USB */
  transport: string;
  /** 蓝牙是否已开启 */
  poweredOn: boolean;
  /** 是否可被发现 */
  discoverable: boolean;
  /** 支持的服务列表 */
  supportedServices: string;
}

/** 单个蓝牙设备快照 */
export interface BluetoothDeviceSnapshot {
  /** 设备显示名称 */
  name: string;
  /** 设备类型，例如 Headset、Keyboard */
  type: string;
  /** 制造商 */
  manufacturer: string;
  /** 设备 MAC 地址 */
  macAddress: string;
  /** 是否已连接 */
  connected: boolean;
  /** 剩余电量（0-100），不支持时为 null */
  batteryPercent: number | null;
}

/** 单个显示器快照 */
export interface DisplaySnapshot {
  /** 型号，例如 Color LCD、27B1N3800 */
  model: string;
  /** 厂商，例如 Apple、AOC */
  vendor: string;
  /** 原生分辨率，例如 3840×2160 */
  nativeResolution: string;
  /** 当前分辨率，例如 1920×1080 */
  currentResolution: string;
  /** 当前刷新率（Hz），不可用时为 null */
  refreshRate: number | null;
  /** 色深（bit），不可用时为 null */
  pixelDepth: number | null;
  /** 物理尺寸，例如 60.96×34.29 cm；不可用时为空字符串 */
  physicalSize: string;
}

/** 单个摄像头快照 */
export interface CameraSnapshot {
  /** 型号，例如 FaceTime HD Camera */
  model: string;
  /** 厂商，例如 Apple、Logitech */
  vendor: string;
  /** 最大分辨率，例如 1920×1080；不可用时为空字符串 */
  maxResolution: string;
  /** 最大帧率（fps），不可用时为 null */
  frameRate: number | null;
}

/** 蓝牙控制器与配对设备的完整快照 */
export interface BluetoothSnapshot {
  /** 蓝牙控制器硬件信息，不可用时为 null */
  controller: BluetoothControllerSnapshot | null;
  /** 已配对/连接的设备列表 */
  devices: BluetoothDeviceSnapshot[];
}

/** 电池快照；台式机或未提供电池信息时为 null */
export interface BatterySnapshot {
  /** 剩余电量百分比（0-100），未知时为 null */
  percent: number | null;
  isCharging: boolean;
  pluggedIn: boolean;
}

/** 一轮采集后的完整硬件快照 */
export interface MonitorSnapshot {
  /** 采集完成时间戳（毫秒） */
  timestamp: number;
  cpu: CpuSnapshot;
  memory: MemorySnapshot;
  /** 按物理磁盘整理的存储信息 */
  storageDisks: StorageDiskSnapshot[];
  /** 系统盘使用率与总容量，不可用时为 null */
  systemDisk: SystemDiskSnapshot | null;
  network: NetworkInterfaceSnapshot[];
  /** GPU 控制器列表，无显卡或采集失败时为空数组 */
  gpus: GpuSnapshot[];
  /** 显示器列表，包含内置与外接屏幕 */
  displays: DisplaySnapshot[];
  /** 摄像头列表，包含内置与外接摄像头 */
  cameras: CameraSnapshot[];
  /** 蓝牙控制器与配对设备信息 */
  bluetooth: BluetoothSnapshot;
  /** 主板硬件信息，不可用时为 null */
  motherboard: MotherboardSnapshot | null;
  system: SystemSnapshot | null;
  battery: BatterySnapshot | null;
}

/** Webview 发给扩展宿主的消息 */
export type WebviewToHostMessage =
  | {
      /** Webview 已加载完成，宿主可以立即推送最新数据 */
      type: "ready";
    }
  | {
      /** 用户手动请求立即刷新 */
      type: "refresh";
    }
  | {
      /** 将硬件报告复制到系统剪贴板 */
      type: "copyReport";
      content: string;
    }
  | {
      /** 将硬件报告导出为 txt 文件 */
      type: "exportReport";
      content: string;
      fileName: string;
    }
  | {
      /** 在系统浏览器中打开外部链接 */
      type: "openExternal";
      url: string;
    };

/** 扩展宿主发给 Webview 的消息 */
export type HostToWebviewMessage =
  | {
      type: "snapshot";
      snapshot: MonitorSnapshot;
    }
  | {
      type: "error";
      message: string;
    }
  | {
      /** 复制/导出等操作的反馈 */
      type: "actionResult";
      success: boolean;
      message: string;
    };
