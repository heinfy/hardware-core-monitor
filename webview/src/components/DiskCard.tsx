import type { MonitorSnapshot } from "../../../src/shared/protocol";
import { formatBytes, formatPercent } from "../utils/format";

interface DiskCardProps {
  snapshot: MonitorSnapshot;
}

/** 磁盘挂载点卡片 */
export function DiskCard({ snapshot }: DiskCardProps) {
  return (
    <section className="card">
      <div className="card-header">
        <h2>磁盘</h2>
        <span className="badge badge-normal">{snapshot.disks.length}</span>
      </div>

      <div className="stack-list">
        {snapshot.disks.map((disk) => (
          <div className="disk-item" key={disk.mount}>
            <div className="item-row">
              <span className="item-name">{disk.mount}</span>
              <span>
                {formatBytes(disk.used)} / {formatBytes(disk.total)}
              </span>
            </div>
            <div className="progress-track small">
              <div
                className={`progress-fill ${disk.usage >= 90 ? "warning" : ""}`}
                style={{ width: `${disk.usage}%` }}
              />
            </div>
            <span className="muted">{formatPercent(disk.usage)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
