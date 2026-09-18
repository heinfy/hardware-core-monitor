import { useMonitorSnapshot } from "../hooks/useMonitorSnapshot";

/** 系统信息路由：展示快照中携带的静态系统信息 */
export function SystemPage() {
  const { snapshot, error } = useMonitorSnapshot();

  return (
    <section className="card">
      <h2>系统信息</h2>

      {error ? (
        <p className="error-text">采集失败：{error}</p>
      ) : snapshot?.system ? (
        <dl className="metric-list">
          <div className="metric-row">
            <dt>主机名</dt>
            <dd>{snapshot.system.hostname}</dd>
          </div>
          <div className="metric-row">
            <dt>系统</dt>
            <dd>
              {snapshot.system.distro} {snapshot.system.release}
            </dd>
          </div>
          <div className="metric-row">
            <dt>内核</dt>
            <dd>{snapshot.system.kernel}</dd>
          </div>
          <div className="metric-row">
            <dt>架构</dt>
            <dd>{snapshot.system.arch}</dd>
          </div>
          <div className="metric-row">
            <dt>CPU 型号</dt>
            <dd>{snapshot.system.cpuModel}</dd>
          </div>
        </dl>
      ) : (
        <p className="muted">正在读取系统信息…</p>
      )}
    </section>
  );
}
