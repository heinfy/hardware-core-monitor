/**
 * 扩展宿主（Extension Host）与 Webview 之间的共享消息协议。
 *
 * 这是整个项目的通信边界：
 * - 扩展宿主运行在 Node.js 环境，负责采集 systeminformation 数据；
 * - Webview 运行在浏览器沙箱，只负责渲染 React 页面；
 * - 两边只允许通过这个文件里定义的类型通信，避免把巨大的原始对象
 *   或者 Node 专属能力泄漏进 Webview。
 */

/** 单个 CPU 核心的使用率快照 */
export interface CpuCoreSnapshot {
  /** 核心显示名称，例如 "Core 0" */
  label: string;
  /** 使用率（0-100） */
  usage: number;
}

/** CPU 快照 */
export interface CpuSnapshot {
  usage: number;
  cores: CpuCoreSnapshot[];
}

/** 内存快照 */
export interface MemorySnapshot {
  /** 总内存（字节） */
  total: number;
  used: number;
  free: number;
  /** 使用率（0-100） */
  usage: number;
}

/** 磁盘快照 */
export interface DiskSnapshot {
  mount: string;
  total: number;
  used: number;
  usage: number;
}

/** 网络接口快照 */
export interface NetworkInterfaceSnapshot {
  iface: string;
  /** 每秒接收字节数 */
  rxSec: number;
  /** 每秒发送字节数 */
  txSec: number;
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
  disks: DiskSnapshot[];
  network: NetworkInterfaceSnapshot[];
  /** CPU 主温度（℃），部分平台无法获取时为 null */
  temperature: number | null;
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
    };
