import * as si from "systeminformation";
import * as vscode from "vscode";
import { collectMemoryMetrics } from "./memoryCollector";
import type {
  MonitorSnapshot,
  MotherboardSnapshot,
  StorageDiskSnapshot,
  SystemDiskSnapshot,
  SystemSnapshot,
} from "./shared/protocol";

/** 内部使用的挂载点容量快照 */
interface MountVolumeSnapshot {
  mount: string;
  total: number;
  used: number;
  usage: number;
}

/** 内部使用的物理硬盘记录（含设备名，用于关联分区） */
interface PhysicalDiskRecord {
  device: string;
  name: string;
  vendor: string;
  type: string;
  size: number;
  interfaceType: string;
}

/** 内部使用的磁盘 I/O 速率 */
interface DiskIoRates {
  readSec: number;
  writeSec: number;
}
import { collectBluetooth } from "./bluetoothCollector";
import { collectCameras } from "./cameraCollector";
import { collectGraphics } from "./graphicsCollector";
import { collectMotherboard } from "./motherboardCollector";

/** macOS 系统卷挂载点，不应作为用户可见磁盘列出 */
const MACOS_SYSTEM_VOLUMES = new Set([
  "/System/Volumes/VM",
  "/System/Volumes/Preboot",
  "/System/Volumes/Update",
  "/System/Volumes/xarts",
  "/System/Volumes/iSCPreboot",
  "/System/Volumes/Hardware",
]);

/**
 * 硬件监控服务：整个插件里唯一的数据源。
 *
 * 设计要点：
 * 1. 只有这个类允许调用 systeminformation，TreeView / StatusBar / Webview
 *    都只消费它发出的事件，避免多处轮询造成重复采集。
 * 2. 使用“递归 setTimeout”而不是 setInterval，保证上一轮采集完成后
 *    才安排下一轮，避免慢机器上请求堆积。
 * 3. systeminformation 的原始对象会被转换成轻量、可序列化的
 *    MonitorSnapshot，再发送给 Webview。
 */
export class MonitorService implements vscode.Disposable {
  private readonly _onDidChangeSnapshot =
    new vscode.EventEmitter<MonitorSnapshot>();

  private readonly _onDidError = new vscode.EventEmitter<string>();

  /** 快照更新事件，所有 UI 组件都订阅它 */
  readonly onDidChangeSnapshot = this._onDidChangeSnapshot.event;

  /** 采集失败事件，用于把错误传递给 Webview 或日志 */
  readonly onDidError = this._onDidError.event;

  private timer: NodeJS.Timeout | undefined;
  private isRunning = false;
  private isCollecting = false;
  private intervalMs: number;

  /** 静态系统信息只需要采集一次，之后缓存复用 */
  private cachedSystemInfo: SystemSnapshot | null = null;

  /** 物理硬盘信息只需采集一次，之后缓存复用 */
  private cachedPhysicalDisks: PhysicalDiskRecord[] | null = null;

  /** 内存硬件信息只需采集一次，之后缓存复用 */
  private cachedMemoryHardware: MemoryHardwareInfo | null = null;

  /** CPU 静态硬件信息只需采集一次，之后缓存复用 */
  private cachedCpuHardware: CpuHardwareInfo | null = null;

  /** 主板硬件信息只需采集一次，之后缓存复用 */
  private cachedMotherboard: MotherboardSnapshot | null = null;

  /** 最近一次成功采集的快照，用于 Webview 打开后立即补发 */
  private latest: MonitorSnapshot | null = null;

  constructor(intervalMs = 10_000) {
    this.intervalMs = Math.max(500, intervalMs);
  }

  get latestSnapshot(): MonitorSnapshot | null {
    return this.latest;
  }

  /** 开始周期性采集；重复调用是安全的 */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    // 预热 disksIO，下一轮采集即可得到每秒读写速率
    void si.disksIO().catch(() => undefined);
    void this.collectAndSchedule();
  }

  /** 停止周期性采集 */
  stop(): void {
    this.isRunning = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  /** 响应配置变化：更新刷新间隔并在运行中时重启调度 */
  updateInterval(intervalMs: number): void {
    this.intervalMs = Math.max(500, intervalMs);

    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * 立即采集一次数据，不影响原有周期调度。
   * 典型场景是 Webview 加载完成或用户点击刷新按钮。
   */
  requestNow(): void {
    void this.collectOnce();
  }

  dispose(): void {
    this.stop();
    this._onDidChangeSnapshot.dispose();
    this._onDidError.dispose();
  }

  /** 采集一轮数据，然后按配置间隔安排下一轮 */
  private async collectAndSchedule(): Promise<void> {
    await this.collectOnce();

    if (!this.isRunning) {
      return;
    }

    // 采集完成后才安排下一次，避免任务堆积
    this.timer = setTimeout(() => {
      void this.collectAndSchedule();
    }, this.intervalMs);
  }

  /** 执行一次采集；并发调用时只保留一次实际执行 */
  private async collectOnce(): Promise<void> {
    if (this.isCollecting) {
      return;
    }

    this.isCollecting = true;

    try {
      const snapshot = await collectSnapshot(
        async () => {
          // 第一次调用时缓存静态系统信息，减少后续轮询开销
          this.cachedSystemInfo ??= await collectSystemInfo();
          return this.cachedSystemInfo;
        },
        async () => {
          this.cachedPhysicalDisks ??= await collectPhysicalDisks();
          return this.cachedPhysicalDisks;
        },
        async () => {
          this.cachedMemoryHardware ??= await collectMemoryHardware();
          return this.cachedMemoryHardware;
        },
        async () => {
          this.cachedCpuHardware ??= await collectCpuHardware();
          return this.cachedCpuHardware;
        },
        async () => {
          this.cachedMotherboard ??= await collectMotherboard();
          return this.cachedMotherboard;
        },
      );

      this.latest = snapshot;
      this._onDidChangeSnapshot.fire(snapshot);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown monitor error";

      console.error("[Hardware Monitor] collect failed:", error);
      this._onDidError.fire(message);
    } finally {
      this.isCollecting = false;
    }
  }
}

/** 内存模组硬件摘要 */
interface MemoryHardwareInfo {
  model: string;
  manufacturer: string;
  type: string;
  tdp: string;
  moduleCapacity: string;
}

/** CPU 静态硬件摘要 */
interface CpuHardwareInfo {
  manufacturer: string;
  model: string;
  architecture: string;
  coreCount: number;
  baseFrequency: string;
  processTechnology: string;
  tdp: string;
}

/** 汇总非空字符串并去重 */
function summarizeUnique(values: string[]): string {
  const unique = [
    ...new Set(values.map((value) => value.trim()).filter(Boolean)),
  ];

  return unique.join(", ");
}

/** 采集静态系统信息；失败时返回 null，不影响主流程 */
async function collectSystemInfo(): Promise<SystemSnapshot | null> {
  try {
    const [osInfo, cpuInfo] = await Promise.all([si.osInfo(), si.cpu()]);

    return {
      platform: osInfo.platform,
      distro: osInfo.distro,
      release: osInfo.release,
      kernel: osInfo.kernel,
      hostname: osInfo.hostname,
      arch: osInfo.arch,
      cpuModel: cpuInfo.brand,
      cpuManufacturer: cpuInfo.manufacturer,
    };
  } catch (error) {
    console.warn("[Hardware Monitor] system info unavailable:", error);
    return null;
  }
}

/** 采集物理硬盘列表；失败时返回空数组 */
async function collectPhysicalDisks(): Promise<PhysicalDiskRecord[]> {
  try {
    const layout = await si.diskLayout();

    return layout
      .filter((disk) => disk.size > 0)
      .map((disk) => ({
        device: disk.device || "",
        name: disk.name || "",
        vendor: disk.vendor || "",
        type: disk.type || "",
        size: disk.size,
        interfaceType: disk.interfaceType || "",
      }));
  } catch (error) {
    console.warn("[Hardware Monitor] disk layout unavailable:", error);
    return [];
  }
}

/** 格式化 CPU 基础频率（GHz） */
function formatCpuBaseFrequency(speedGhz: number): string {
  if (!Number.isFinite(speedGhz) || speedGhz <= 0) {
    return "";
  }

  return `${speedGhz.toFixed(2)} GHz`;
}

/** 采集 CPU 静态硬件信息；失败时返回空字段 */
async function collectCpuHardware(): Promise<CpuHardwareInfo> {
  try {
    const [cpuInfo, osInfo] = await Promise.all([si.cpu(), si.osInfo()]);
    const baseSpeed =
      cpuInfo.speedMin > 0 ? cpuInfo.speedMin : cpuInfo.speed > 0 ? cpuInfo.speed : 0;

    return {
      manufacturer: cpuInfo.manufacturer || "",
      model: cpuInfo.brand || "",
      architecture: osInfo.arch || "",
      coreCount: cpuInfo.physicalCores || cpuInfo.cores || 0,
      baseFrequency: formatCpuBaseFrequency(baseSpeed),
      // systeminformation 暂不提供制程工艺与 TDP，保留字段供后续扩展
      processTechnology: "",
      tdp: "",
    };
  } catch (error) {
    console.warn("[Hardware Monitor] CPU hardware unavailable:", error);
    return {
      manufacturer: "",
      model: "",
      architecture: "",
      coreCount: 0,
      baseFrequency: "",
      processTechnology: "",
      tdp: "",
    };
  }
}

/** 字节数转人类可读文本 */
function formatMemoryBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );

  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
}

/** 汇总各内存模组的单条容量 */
function summarizeModuleCapacity(
  layout: Awaited<ReturnType<typeof si.memLayout>>,
): string {
  const uniqueSizes = [
    ...new Set(layout.map((module) => module.size).filter((size) => size > 0)),
  ];

  return uniqueSizes.map((size) => formatMemoryBytes(size)).join(", ");
}

/** 采集内存模组硬件信息；失败时返回空字段 */
async function collectMemoryHardware(): Promise<MemoryHardwareInfo> {
  try {
    const layout = await si.memLayout();

    return {
      model: summarizeUnique(layout.map((module) => module.partNum ?? "")),
      manufacturer: summarizeUnique(
        layout.map((module) => module.manufacturer ?? ""),
      ),
      type: summarizeUnique(layout.map((module) => module.type ?? "")),
      // systeminformation 暂不提供内存 TDP，保留字段供后续扩展
      tdp: "",
      moduleCapacity: summarizeModuleCapacity(layout),
    };
  } catch (error) {
    console.warn("[Hardware Monitor] memory layout unavailable:", error);
    return {
      model: "",
      manufacturer: "",
      type: "",
      tdp: "",
      moduleCapacity: "",
    };
  }
}

/** 把 systeminformation 的原始返回值转换成轻量快照 */
async function collectSnapshot(
  getSystemInfo: () => Promise<SystemSnapshot | null>,
  getPhysicalDisks: () => Promise<PhysicalDiskRecord[]>,
  getMemoryHardware: () => Promise<MemoryHardwareInfo>,
  getCpuHardware: () => Promise<CpuHardwareInfo>,
  getMotherboard: () => Promise<MotherboardSnapshot | null>,
): Promise<MonitorSnapshot> {
  // 电池在部分平台/虚拟机中不可用，失败时返回 null 而不是中断整个快照
  const [cpu, memory, fsSize, diskIo, blockDevices, network, graphics, cameras, bluetooth, battery, system, physicalDisks, memoryHardware, cpuHardware, motherboard] =
    await Promise.all([
      si.currentLoad(),
      collectMemoryMetrics(),
      si.fsSize(),
      si.disksIO().catch(() => null),
      si.blockDevices().catch(() => [] as si.Systeminformation.BlockDevicesData[]),
      si.networkStats(),
      collectGraphics(),
      collectCameras(),
      collectBluetooth(),
      si.battery().catch(() => null),
      getSystemInfo(),
      getPhysicalDisks(),
      getMemoryHardware(),
      getCpuHardware(),
      getMotherboard(),
    ]);

  const platform = system?.platform ?? process.platform;
  const displayMounts = filterDisplayDisks(fsSize, platform);
  const ioRates = mapDiskIo(diskIo);
  const storageDisks = buildStorageDisks(
    physicalDisks,
    blockDevices,
    fsSize,
    displayMounts,
    platform,
    ioRates,
  );
  const systemDisk = mapSystemDisk(displayMounts, platform);

  return {
    timestamp: Date.now(),
    cpu: {
      usage: cpu.currentLoad,
      manufacturer: cpuHardware.manufacturer || system?.cpuManufacturer || "",
      model: cpuHardware.model || system?.cpuModel || "",
      architecture: cpuHardware.architecture,
      coreCount: cpuHardware.coreCount,
      baseFrequency: cpuHardware.baseFrequency,
      processTechnology: cpuHardware.processTechnology,
      tdp: cpuHardware.tdp,
    },
    memory: {
      usage: memory.usage,
      total: memory.total,
      used: memory.used,
      cached: memory.cached,
      swapUsed: memory.swapUsed,
      model: memoryHardware.model,
      manufacturer: memoryHardware.manufacturer,
      type: memoryHardware.type,
      tdp: memoryHardware.tdp,
      moduleCapacity: memoryHardware.moduleCapacity,
    },
    storageDisks,
    systemDisk,
    network: network.map((item) => ({
      iface: item.iface,
      rxSec: item.rx_sec ?? 0,
      txSec: item.tx_sec ?? 0,
    })),
    gpus: graphics.gpus,
    displays: graphics.displays,
    cameras,
    bluetooth,
    motherboard,
    system,
    battery:
      battery && battery.hasBattery
        ? {
            percent:
              typeof battery.percent === "number" ? battery.percent : null,
            isCharging: battery.isCharging,
            pluggedIn: battery.acConnected,
          }
        : null,
  };
}

/** 判断是否为 Windows 盘符挂载点（C:、D: 等） */
function isWindowsDriveLetter(mount: string): boolean {
  return /^[A-Za-z]:\\?$/.test(mount);
}

/** 统一 Windows 盘符显示格式，例如 C: */
function normalizeWindowsDrive(mount: string): string {
  const match = /^([A-Za-z]):/.exec(mount);

  return match ? `${match[1].toUpperCase()}:` : mount;
}

/** 按平台过滤应展示的用户磁盘，避免 APFS 系统卷等重复统计 */
function filterDisplayDisks(
  mounts: si.Systeminformation.FsSizeData[],
  platform: string,
): MountVolumeSnapshot[] {
  const valid = mounts.filter((mount) => mount.size > 0);
  let filtered: si.Systeminformation.FsSizeData[];

  if (platform === "win32") {
    filtered = valid.filter((mount) => isWindowsDriveLetter(mount.mount));
    filtered.sort((left, right) =>
      normalizeWindowsDrive(left.mount).localeCompare(
        normalizeWindowsDrive(right.mount),
      ),
    );
  } else if (platform === "darwin") {
    const hasDataVolume = valid.some(
      (mount) => mount.mount === "/System/Volumes/Data",
    );

    filtered = valid.filter((mount) => {
      if (MACOS_SYSTEM_VOLUMES.has(mount.mount)) {
        return false;
      }

      // 有 Data 卷时跳过只读系统根挂载，避免与 Data 重复
      if (hasDataVolume && mount.mount === "/") {
        return false;
      }

      return true;
    });
    filtered.sort((left, right) =>
      compareDarwinMountOrder(left.mount, right.mount),
    );
  } else {
    filtered = valid.filter((mount) => shouldShowLinuxMount(mount));
    filtered.sort((left, right) =>
      compareLinuxMountOrder(left.mount, right.mount),
    );
  }

  return filtered.map((mount) => ({
    mount:
      platform === "win32" ? normalizeWindowsDrive(mount.mount) : mount.mount,
    total: mount.size,
    used: mount.used,
    usage: mount.size > 0 ? (mount.used / mount.size) * 100 : 0,
  }));
}

/** Linux 下排除 tmpfs、容器与系统伪挂载点 */
function shouldShowLinuxMount(
  mount: si.Systeminformation.FsSizeData,
): boolean {
  if (mount.type === "tmpfs") {
    return false;
  }

  const excludedPrefixes = [
    "/dev",
    "/proc",
    "/sys",
    "/run",
    "/snap",
    "/var/lib/docker",
  ];

  return !excludedPrefixes.some(
    (prefix) => mount.mount === prefix || mount.mount.startsWith(`${prefix}/`),
  );
}

/** macOS 磁盘排序：系统 Data 卷优先，其余按路径 */
function compareDarwinMountOrder(left: string, right: string): number {
  const priority = (mount: string): number => {
    if (mount === "/System/Volumes/Data") {
      return 0;
    }

    if (mount.startsWith("/Volumes/")) {
      return 1;
    }

    return 2;
  };

  const leftPriority = priority(left);
  const rightPriority = priority(right);

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return left.localeCompare(right);
}

/** Linux 磁盘排序：根分区优先，其余按路径 */
function compareLinuxMountOrder(left: string, right: string): number {
  if (left === "/") {
    return -1;
  }

  if (right === "/") {
    return 1;
  }

  return left.localeCompare(right);
}

/** 获取各平台的系统盘挂载点 */
function getSystemMountPoint(platform: string): string {
  if (platform === "win32") {
    return "C:";
  }

  if (platform === "darwin") {
    return "/System/Volumes/Data";
  }

  return "/";
}

/** 判断挂载点是否为系统盘 */
function isSystemMount(mount: string, platform: string): boolean {
  const systemMount = getSystemMountPoint(platform);

  if (mount === systemMount) {
    return true;
  }

  // macOS 无 Data 卷时，根分区视为系统盘
  return platform === "darwin" && mount === "/";
}

/** 提取系统盘使用率与总容量 */
function mapSystemDisk(
  displayMounts: MountVolumeSnapshot[],
  platform: string,
): SystemDiskSnapshot | null {
  const systemMount = getSystemMountPoint(platform);
  const systemVolume =
    displayMounts.find((mount) => mount.mount === systemMount) ??
    (platform === "darwin"
      ? displayMounts.find((mount) => mount.mount === "/")
      : undefined) ??
    displayMounts[0];

  if (!systemVolume || systemVolume.total <= 0) {
    return null;
  }

  return {
    usage: systemVolume.usage,
    total: systemVolume.total,
  };
}

/** 将 fsSize 条目转为挂载点容量快照 */
function mapMountVolume(
  mount: si.Systeminformation.FsSizeData,
  platform: string,
): MountVolumeSnapshot {
  const normalizedMount =
    platform === "win32" ? normalizeWindowsDrive(mount.mount) : mount.mount;

  return {
    mount: normalizedMount,
    total: mount.size,
    used: mount.used,
    usage: mount.size > 0 ? (mount.used / mount.size) * 100 : 0,
  };
}

/** 判断 fs 设备是否属于指定物理磁盘 */
function belongsToPhysicalDisk(
  fsPath: string,
  device: string,
): boolean {
  if (!device) {
    return false;
  }

  const normalized = fsPath.replace("/dev/", "");

  return normalized === device || normalized.startsWith(`${device}s`);
}

/** 为物理磁盘挑选主数据卷 */
function pickPrimaryMount(
  physicalDisk: PhysicalDiskRecord,
  blockDevices: si.Systeminformation.BlockDevicesData[],
  fsSizeMounts: si.Systeminformation.FsSizeData[],
  displayMounts: MountVolumeSnapshot[],
  platform: string,
): MountVolumeSnapshot | null {
  const devicePath = physicalDisk.device
    ? `/dev/${physicalDisk.device}`
    : "";
  const blockMounts = new Set(
    blockDevices
      .filter((block) => block.device === devicePath && block.mount)
      .map((block) =>
        platform === "win32"
          ? normalizeWindowsDrive(block.mount)
          : block.mount,
      ),
  );
  const relatedFsEntries = fsSizeMounts.filter(
    (mount) =>
      mount.size > 0 &&
      (blockMounts.has(mount.mount) ||
        belongsToPhysicalDisk(mount.fs, physicalDisk.device)),
  );
  const candidates = displayMounts.filter(
    (mount) =>
      blockMounts.has(mount.mount) ||
      relatedFsEntries.some((entry) => entry.mount === mount.mount),
  );

  if (candidates.length === 0) {
    if (relatedFsEntries.length === 0) {
      return null;
    }

    const [primary] = [...relatedFsEntries].sort(
      (left, right) => right.used - left.used,
    );

    return mapMountVolume(primary, platform);
  }

  const systemMount = getSystemMountPoint(platform);
  const systemCandidate = candidates.find(
    (mount) => mount.mount === systemMount,
  );

  if (systemCandidate) {
    return systemCandidate;
  }

  return [...candidates].sort((left, right) => right.used - left.used)[0];
}

/** 分配磁盘读写速率：单盘或系统盘使用系统级 I/O */
function assignDiskIoRates(
  ioRates: DiskIoRates | null,
  physicalDiskCount: number,
  servesSystemDisk: boolean,
): { readSec: number | null; writeSec: number | null } {
  if (!ioRates) {
    return { readSec: null, writeSec: null };
  }

  if (physicalDiskCount === 1 || servesSystemDisk) {
    return {
      readSec: ioRates.readSec,
      writeSec: ioRates.writeSec,
    };
  }

  return { readSec: null, writeSec: null };
}

/** 按物理磁盘合并硬件信息、容量与 I/O 速率 */
function buildStorageDisks(
  physicalDisks: PhysicalDiskRecord[],
  blockDevices: si.Systeminformation.BlockDevicesData[],
  fsSizeMounts: si.Systeminformation.FsSizeData[],
  displayMounts: MountVolumeSnapshot[],
  platform: string,
  ioRates: DiskIoRates | null,
): StorageDiskSnapshot[] {
  if (physicalDisks.length === 0) {
    return displayMounts.map((mount) => {
      const servesSystemDisk = isSystemMount(mount.mount, platform);

      return {
        vendor: "",
        name: "",
        size: mount.total,
        type: "",
        interfaceType: "",
        total: mount.total,
        used: mount.used,
        ...assignDiskIoRates(ioRates, 1, servesSystemDisk),
      };
    });
  }

  return physicalDisks.map((disk) => {
    const primaryMount = pickPrimaryMount(
      disk,
      blockDevices,
      fsSizeMounts,
      displayMounts,
      platform,
    );
    const servesSystemDisk =
      primaryMount !== null &&
      isSystemMount(primaryMount.mount, platform);

    return {
      vendor: disk.vendor,
      name: disk.name,
      size: disk.size,
      type: disk.type,
      interfaceType: disk.interfaceType,
      total: primaryMount?.total ?? 0,
      used: primaryMount?.used ?? 0,
      ...assignDiskIoRates(
        ioRates,
        physicalDisks.length,
        servesSystemDisk,
      ),
    };
  });
}

/** 将 disksIO 原始数据转为内部 I/O 速率 */
function mapDiskIo(
  data: si.Systeminformation.DisksIoData | null,
): DiskIoRates | null {
  if (!data) {
    return null;
  }

  // 首次调用时 _sec 字段可能为 null，此时视为尚无有效速率
  if (data.rIO_sec === null && data.wIO_sec === null && data.tIO_sec === null) {
    return null;
  }

  return {
    readSec: data.rIO_sec ?? 0,
    writeSec: data.wIO_sec ?? 0,
  };
}

