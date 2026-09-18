import type { MonitorSnapshot } from "../../../src/shared/protocol";
import { formatSpeed } from "../utils/format";

interface NetworkCardProps {
  snapshot: MonitorSnapshot;
}

/** 网络接口卡片 */
export function NetworkCard({ snapshot }: NetworkCardProps) {
  return (
    <section className="card">
      <div className="card-header">
        <h2>网络</h2>
        <span className="badge badge-normal">{snapshot.network.length}</span>
      </div>

      <div className="stack-list">
        {snapshot.network.map((item) => (
          <div className="item-row" key={item.iface}>
            <span className="item-name">{item.iface}</span>
            <span className="network-speed">
              <span>↓ {formatSpeed(item.rxSec)}</span>
              <span>↑ {formatSpeed(item.txSec)}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
