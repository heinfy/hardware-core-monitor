import type { MonitorSnapshot } from "../../../src/shared/protocol";

interface MiscCardProps {
  snapshot: MonitorSnapshot;
}

/** 温度与电池信息 */
export function MiscCard({ snapshot }: MiscCardProps) {
  const temperature = snapshot.temperature;
  const battery = snapshot.battery;

  return (
    <section className="card">
      <h2>温度与电池</h2>

      <dl className="kv-list">
        <div>
          <dt>CPU 温度</dt>
          <dd>
            {temperature === null ? "不可用" : `${temperature.toFixed(1)}℃`}
          </dd>
        </div>

        <div>
          <dt>电池</dt>
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
