import { useMonitorSnapshot } from "../hooks/useMonitorSnapshot";

/** 概览路由：展示实时 CPU / 内存数据，验证与扩展宿主的通信链路 */
export function HomePage() {
  const { snapshot, error, refresh } = useMonitorSnapshot();

  return (
    <section className="card">
      <div className="card-header">
        <h2>概览</h2>
        <button type="button" onClick={refresh}>
          刷新
        </button>
      </div>

      {error ? (
        <p className="error-text">采集失败：{error}</p>
      ) : snapshot ? (
        <dl className="metric-list">
          <div className="metric-row">
            <dt>CPU 使用率</dt>
            <dd>{snapshot.cpu.usage.toFixed(1)}%</dd>
          </div>
          <div className="metric-row">
            <dt>内存使用率</dt>
            <dd>{snapshot.memory.usage.toFixed(1)}%</dd>
          </div>
          <div className="metric-row">
            <dt>CPU 温度</dt>
            <dd>
              {snapshot.temperature === null
                ? "不支持"
                : `${snapshot.temperature} ℃`}
            </dd>
          </div>
          <div className="metric-row">
            <dt>更新时间</dt>
            <dd>{new Date(snapshot.timestamp).toLocaleTimeString()}</dd>
          </div>
        </dl>
      ) : (
        <p className="muted">正在读取硬件数据…</p>
      )}
    </section>
  );
}
