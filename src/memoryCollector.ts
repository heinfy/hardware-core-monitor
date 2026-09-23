import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as si from "systeminformation";

const execFileAsync = promisify(execFile);

/** 内存运行时指标（不含硬件模组信息） */
export interface MemoryRuntimeMetrics {
  /** 使用率（0-100） */
  usage: number;
  /** 物理内存总容量（字节） */
  total: number;
  /** 已使用内存（字节） */
  used: number;
  /** 已缓存文件（字节） */
  cached: number;
  /** 已使用的交换空间（字节） */
  swapUsed: number;
}

/** 从 vm_stat 输出中解析页面计数 */
function parseVmStatPageCount(output: string, key: string): number {
  const match = output.match(new RegExp(`${key}:\\s+(\\d+)`));
  return match ? Number.parseInt(match[1], 10) : 0;
}

/** 读取 macOS 页面大小（Apple Silicon 通常为 16384） */
async function getMacPageSize(): Promise<number> {
  try {
    const { stdout } = await execFileAsync("sysctl", ["-n", "vm.pagesize"]);
    const pageSize = Number.parseInt(stdout.trim(), 10);
    return Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 4096;
  } catch {
    return 4096;
  }
}

/** 读取 macOS 缓存文件占用，与活动监视器“已缓存文件”口径一致 */
async function getMacCachedBytes(): Promise<number> {
  try {
    const [pageSize, { stdout }] = await Promise.all([
      getMacPageSize(),
      execFileAsync("vm_stat", [], { timeout: 3000 }),
    ]);

    const fileBacked = parseVmStatPageCount(stdout, "File-backed pages");
    const purgeable = parseVmStatPageCount(stdout, "Pages purgeable");
    return (fileBacked + purgeable) * pageSize;
  } catch (error) {
    console.warn("[Hardware Monitor] vm_stat unavailable:", error);
    return 0;
  }
}

/** 将 systeminformation 的 mem 数据转换为各平台统一的运行时指标 */
function mapMemoryMetrics(mem: si.Systeminformation.MemData): MemoryRuntimeMetrics {
  if (process.platform === "darwin") {
    // macOS 活动监视器“已使用内存”≈ App + Wired + Compressed，对应 si.mem().active
    const used = mem.active;
    return {
      total: mem.total,
      used,
      cached: 0,
      swapUsed: mem.swapused,
      usage: mem.total > 0 ? (used / mem.total) * 100 : 0,
    };
  }

  return {
    total: mem.total,
    used: mem.used,
    cached: mem.buffcache,
    swapUsed: mem.swapused,
    usage: mem.total > 0 ? (mem.used / mem.total) * 100 : 0,
  };
}

/** 采集内存运行时指标；macOS 按活动监视器口径计算 */
export async function collectMemoryMetrics(): Promise<MemoryRuntimeMetrics> {
  const mem = await si.mem();
  const metrics = mapMemoryMetrics(mem);

  if (process.platform === "darwin") {
    metrics.cached = await getMacCachedBytes();
  }

  return metrics;
}
