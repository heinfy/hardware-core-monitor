import type { MonitorSnapshot } from "../../../src/shared/protocol";
import { formatPercent } from "../utils/format";

interface CpuCardProps {
  snapshot: MonitorSnapshot;
}

/** CPU 使用率卡片 */
export function CpuCard({ snapshot }: CpuCardProps) {
  const { usage, cores } = snapshot.cpu;

  return (
    <section className="card span-2">
      <div className="card-header">
        <h2>CPU</h2>
        <span
          className={`badge ${usage >= 80 ? "badge-warning" : "badge-normal"}`}
        >
          {formatPercent(usage)}
        </span>
      </div>

      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${usage}%` }} />
      </div>

      <div className="core-grid">
        {cores.map((core) => (
          <div className="core" key={core.label}>
            <span className="core-label">{core.label}</span>
            <div className="progress-track small">
              <div
                className="progress-fill"
                style={{ width: `${core.usage}%` }}
              />
            </div>
            <span className="core-value">{formatPercent(core.usage)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
