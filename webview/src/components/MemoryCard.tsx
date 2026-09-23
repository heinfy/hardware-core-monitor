import type { MonitorSnapshot } from "../../../src/shared/protocol";
import { formatBytes, formatPercent } from "../utils/format";

interface MemoryCardProps {
  snapshot: MonitorSnapshot;
}

/** 格式化可选硬件字段 */
function formatOptionalValue(value: string): string {
  return value || "不可用";
}

/** 内存使用率与硬件信息卡片 */
export function MemoryCard({ snapshot }: MemoryCardProps) {
  const memory = snapshot.memory;

  // 仅展示指定的内存硬件参数
  const hardwareRows = [
    { label: "型号", value: formatOptionalValue(memory.model) },
    { label: "厂商", value: formatOptionalValue(memory.manufacturer) },
    { label: "物理内存", value: formatBytes(memory.total) },
    { label: "已使用内存", value: formatBytes(memory.used) },
    { label: "已缓存文件", value: formatBytes(memory.cached) },
    { label: "已使用的交换", value: formatBytes(memory.swapUsed) },
    { label: "TDP / 功耗设计", value: formatOptionalValue(memory.tdp) },
    {
      label: "单条容量",
      value: formatOptionalValue(memory.moduleCapacity),
    },
  ];

  return (
    <section className="card">
      <div className="card-header">
        <h2>内存</h2>
        <span
          className={`badge ${memory.usage >= 85 ? "badge-warning" : "badge-normal"}`}
        >
          {formatPercent(memory.usage)}
        </span>
      </div>

      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${memory.usage}%` }} />
      </div>

      <dl className="kv-list">
        {hardwareRows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
