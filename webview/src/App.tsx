import { Dashboard } from "./components/Dashboard";
import { useMonitorSnapshot } from "./hooks/useMonitorSnapshot";

/** Webview 根组件：负责加载/错误/内容三种状态 */
export function App() {
  const { snapshot, error, refresh } = useMonitorSnapshot();

  if (error) {
    return (
      <div className="page">
        <section className="error-box">
          <h2>数据采集失败</h2>
          <p>{error}</p>
          <button type="button" onClick={refresh}>
            重试
          </button>
        </section>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="page">
        <div className="loading">正在读取硬件数据…</div>
      </div>
    );
  }

  return <Dashboard snapshot={snapshot} onRefresh={refresh} />;
}
