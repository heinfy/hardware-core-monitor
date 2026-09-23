import type { MonitorSnapshot } from "../../../src/shared/protocol";
import { formatBytes } from "./format";

/** 项目 GitHub 地址 */
export const PROJECT_GITHUB_URL =
  "https://github.com/heinfy/hardware-core-monitor";

/** 格式化可选硬件字段 */
function formatOptionalValue(value: string): string {
  return value || "不可用";
}

/** 从 vendorID 字符串中提取可读厂商名 */
function extractVendorName(vendor: string): string {
  const match = vendor.match(/\(([^)]+)\)/);
  return match?.[1]?.trim() || vendor.trim();
}

/** 追加带标题的分段内容 */
function appendSection(
  lines: string[],
  title: string,
  rows: Array<[string, string]>,
): void {
  lines.push(`[ ${title} ]`);
  lines.push("-".repeat(40));

  for (const [label, value] of rows) {
    lines.push(`${label}: ${value}`);
  }

  lines.push("");
}

/** 格式化显存容量展示 */
function formatVram(gpu: MonitorSnapshot["gpus"][number]): string {
  if (gpu.vram !== null) {
    return formatBytes(gpu.vram);
  }

  if (gpu.vramDynamic) {
    return "共享内存";
  }

  return "不可用";
}

/** 将硬件快照格式化为可导出的纯文本报告（仅主要硬件信息） */
export function formatSnapshotReport(snapshot: MonitorSnapshot): string {
  const lines: string[] = [];
  const timestamp = new Date(snapshot.timestamp).toLocaleString("zh-CN");

  lines.push("Hardware Core Monitor - 硬件监控报告");
  lines.push(`采集时间: ${timestamp}`);
  lines.push("=".repeat(48));
  lines.push("");

  const cpu = snapshot.cpu;
  appendSection(lines, "CPU", [
    ["制造商", formatOptionalValue(cpu.manufacturer)],
    ["型号/品牌", formatOptionalValue(cpu.model)],
    [
      "CPU 核心数量",
      cpu.coreCount > 0 ? String(cpu.coreCount) : "不可用",
    ],
  ]);

  const memory = snapshot.memory;
  appendSection(lines, "内存", [
    ["型号", formatOptionalValue(memory.model)],
    ["厂商", formatOptionalValue(memory.manufacturer)],
    ["物理内存", formatBytes(memory.total)],
    ["单条容量", formatOptionalValue(memory.moduleCapacity)],
  ]);

  if (snapshot.gpus.length === 0) {
    appendSection(lines, "显卡", [["状态", "当前系统无法提供 GPU 信息"]]);
  } else {
    snapshot.gpus.forEach((gpu, index) => {
      appendSection(
        lines,
        snapshot.gpus.length > 1 ? `显卡 #${index + 1}` : "显卡",
        [
          ["型号", formatOptionalValue(gpu.model)],
          ["厂商", formatOptionalValue(gpu.vendor)],
          ["显存", formatVram(gpu)],
        ],
      );
    });
  }

  if (snapshot.storageDisks.length === 0) {
    appendSection(lines, "磁盘", [["状态", "暂无存储信息"]]);
  } else {
    snapshot.storageDisks.forEach((disk, index) => {
      appendSection(
        lines,
        snapshot.storageDisks.length > 1 ? `磁盘 #${index + 1}` : "磁盘",
        [
          ["制造商", formatOptionalValue(disk.vendor)],
          ["型号/品牌", formatOptionalValue(disk.name)],
          ["容量", formatBytes(disk.size)],
          ["类型", formatOptionalValue(disk.type)],
        ],
      );
    });
  }

  const { controller, devices } = snapshot.bluetooth;
  const bluetoothRows: Array<[string, string]> = [];

  if (controller) {
    if (controller.vendor) {
      bluetoothRows.push(["厂商", extractVendorName(controller.vendor)]);
    }
    if (controller.chipset) {
      bluetoothRows.push(["芯片型号", controller.chipset]);
    }
  }

  if (devices.length > 0) {
    devices.forEach((device, index) => {
      bluetoothRows.push([`设备 #${index + 1}`, device.name]);
      if (device.manufacturer) {
        bluetoothRows.push(["制造商", device.manufacturer]);
      }
    });
  }

  if (bluetoothRows.length === 0) {
    bluetoothRows.push(["状态", "当前系统无法提供蓝牙信息"]);
  }

  appendSection(lines, "蓝牙", bluetoothRows);

  return lines.join("\n");
}

/** 生成默认导出文件名 */
export function buildReportFileName(snapshot: MonitorSnapshot): string {
  const hostname = snapshot.system?.hostname ?? "hardware";
  const stamp = new Date(snapshot.timestamp)
    .toISOString()
    .replace(/[:.]/g, "-");

  return `hardware-report-${hostname}-${stamp}.txt`;
}
