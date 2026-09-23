import type { MonitorSnapshot } from "../../../src/shared/protocol";
import { formatPercent } from "../utils/format";

interface CpuCardProps {
  snapshot: MonitorSnapshot;
}

/** 格式化可选硬件字段 */
function formatOptionalValue(value: string): string {
  return value || "不可用";
}

/** CPU 使用率与硬件信息卡片 */
export function CpuCard({ snapshot }: CpuCardProps) {
  const cpu = snapshot.cpu;

  // 仅展示指定的 CPU 硬件参数
  const hardwareRows = [
    { label: "制造商", value: formatOptionalValue(cpu.manufacturer) },
    { label: "型号/品牌", value: formatOptionalValue(cpu.model) },
    { label: "架构", value: formatOptionalValue(cpu.architecture) },
    {
      label: "CPU 核心数量",
      value: cpu.coreCount > 0 ? String(cpu.coreCount) : "不可用",
    },
    { label: "基础频率", value: formatOptionalValue(cpu.baseFrequency) },
    { label: "制程工艺", value: formatOptionalValue(cpu.processTechnology) },
    { label: "TDP / 功耗设计", value: formatOptionalValue(cpu.tdp) },
  ];

  return (
    <section className="card span-full">
      <div className="card-header">
        <h2>CPU</h2>
        <span
          className={`badge ${cpu.usage >= 80 ? "badge-warning" : "badge-normal"}`}
        >
          {formatPercent(cpu.usage)}
        </span>
      </div>

      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${cpu.usage}%` }} />
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
