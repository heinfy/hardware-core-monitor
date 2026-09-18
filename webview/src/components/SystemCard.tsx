import type { MonitorSnapshot } from "../../../src/shared/protocol";

interface SystemCardProps {
  snapshot: MonitorSnapshot;
}

/** 静态系统信息卡片 */
export function SystemCard({ snapshot }: SystemCardProps) {
  const system = snapshot.system;

  return (
    <section className="card">
      <h2>系统</h2>

      {system ? (
        <dl className="kv-list">
          <div>
            <dt>主机名</dt>
            <dd>{system.hostname}</dd>
          </div>
          <div>
            <dt>发行版</dt>
            <dd>
              {system.distro} {system.release}
            </dd>
          </div>
          <div>
            <dt>架构</dt>
            <dd>
              {system.platform} / {system.arch}
            </dd>
          </div>
          <div>
            <dt>内核</dt>
            <dd>{system.kernel}</dd>
          </div>
          <div>
            <dt>CPU</dt>
            <dd>{system.cpuModel}</dd>
          </div>
        </dl>
      ) : (
        <p className="muted">系统信息不可用</p>
      )}
    </section>
  );
}
