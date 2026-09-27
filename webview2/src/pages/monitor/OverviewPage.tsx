import MagicBento, { type BentoCardProps } from "../../components/MagicBento";
import { useMonitorSnapshot } from "../../hooks/useMonitorSnapshot";
import type { MonitorSnapshot } from "../../../../src/shared/protocol";

/** 把字节格式化成 GB，供磁卡片描述使用 */
function formatGigabytes(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

/** 概览页的六张 Magic Bento 卡片，顺序对应不规则网格 */
function buildOverviewCards(snapshot: MonitorSnapshot): BentoCardProps[] {
  const gpuTitle =
    snapshot.gpus.length === 0
      ? "不可用"
      : snapshot.gpus.map((gpu) => `${gpu.vendor} ${gpu.model}`).join(" / ");
  const connectedCount = snapshot.bluetooth.devices.filter(
    (device) => device.connected,
  ).length;
  const bluetoothTitle = snapshot.bluetooth.controller
    ? snapshot.bluetooth.controller.poweredOn
      ? "已开启"
      : "已关闭"
    : snapshot.bluetooth.devices.length === 0
      ? "不可用"
      : "无适配器";

  return [
    {
      label: "处理器",
      title: `${snapshot.cpu.usage.toFixed(1)}%`,
      description: snapshot.cpu.model || "CPU 使用率",
    },
    {
      label: "内存",
      title: `${snapshot.memory.usage.toFixed(1)}%`,
      description: `已用 ${formatGigabytes(snapshot.memory.used)} / ${formatGigabytes(snapshot.memory.total)}`,
    },
    {
      label: "显卡",
      title: gpuTitle,
      description:
        snapshot.gpus.length === 0
          ? "未检测到显卡"
          : `${snapshot.gpus.length} 块显卡`,
    },
    {
      label: "系统盘",
      title: snapshot.systemDisk
        ? `${snapshot.systemDisk.usage.toFixed(1)}%`
        : "不可用",
      description: snapshot.systemDisk
        ? `总容量 ${formatGigabytes(snapshot.systemDisk.total)}`
        : "未检测到系统盘",
    },
    {
      label: "蓝牙",
      title: bluetoothTitle,
      description:
        snapshot.bluetooth.devices.length > 0
          ? `${snapshot.bluetooth.devices.length} 台设备，${connectedCount} 台已连接`
          : snapshot.bluetooth.controller?.chipset || "没有已配对设备",
    },
    {
      label: "更新",
      title: new Date(snapshot.timestamp).toLocaleTimeString(),
      description: "最近一次采集时间",
    },
  ];
}

const loadingCards: BentoCardProps[] = [
  { label: "处理器", title: "…", description: "正在读取 CPU" },
  { label: "内存", title: "…", description: "正在读取内存" },
  { label: "显卡", title: "…", description: "正在读取显卡" },
  { label: "系统盘", title: "…", description: "正在读取磁盘" },
  { label: "蓝牙", title: "…", description: "正在读取蓝牙" },
  { label: "更新", title: "…", description: "等待采集结果" },
];

/** 监控 / 概览：用 Magic Bento 展示实时硬件数据 */
export function OverviewPage() {
  const { snapshot, error, refresh } = useMonitorSnapshot();
  const cards = error
    ? [{ label: "状态", title: "采集失败", description: error }]
    : snapshot
      ? buildOverviewCards(snapshot)
      : loadingCards;

  return (
    <section>
      <div className="card-header">
        <h2>概览</h2>
        <button type="button" onClick={refresh}>
          刷新
        </button>
      </div>
      <MagicBento cards={cards} textAutoHide={false} />
    </section>
  );
}
