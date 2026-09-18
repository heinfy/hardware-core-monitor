import type { MonitorSnapshot } from "../../../src/shared/protocol";
import { formatBytes, formatPercent } from "../utils/format";

interface MemoryCardProps {
  snapshot: MonitorSnapshot;
}

/** 内存卡片 */
export function MemoryCard({ snapshot }: MemoryCardProps) {
  const memory = snapshot.memory;

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
        <div>
          <dt>已使用</dt>
          <dd>{formatBytes(memory.used)}</dd>
        </div>
        <div>
          <dt>可用</dt>
          <dd>{formatBytes(memory.free)}</dd>
        </div>
        <div>
          <dt>总量</dt>
          <dd>{formatBytes(memory.total)}</dd>
        </div>
      </dl>
    </section>
  );
}
