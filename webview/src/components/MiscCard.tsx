import type { MonitorSnapshot } from "../../../src/shared/protocol";

interface MiscCardProps {
  snapshot: MonitorSnapshot;
}

/** 电池信息 */
export function MiscCard({ snapshot }: MiscCardProps) {
  const battery = snapshot.battery;

  return (
    <section className="card">
      <h2>电池</h2>

      <dl className="kv-list">
        <div>
          <dt>状态</dt>
          <dd>
            {battery
              ? `${battery.percent === null ? "未知" : `${battery.percent.toFixed(0)}%`}（${
                  battery.isCharging
                    ? "充电中"
                    : battery.pluggedIn
                      ? "已接通电源"
                      : "使用电池"
                }）`
              : "不可用"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
