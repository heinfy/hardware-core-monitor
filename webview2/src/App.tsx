import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { MonitorLayout } from "./layouts/MonitorLayout";
import { HomePage } from "./pages/home/HomePage";
import { OverviewPage } from "./pages/monitor/OverviewPage";
import { SettingsPage } from "./pages/monitor/SettingsPage";
import { SystemPage } from "./pages/monitor/SystemPage";

/** Webview2 根组件：一级导航 + 路由 */
export function App() {
  return (
    <div className="page">
      <nav className="top-nav">
        <span className="brand">Webview2</span>
        <div className="nav-links">
          <NavLink to="/" end>
            首页
          </NavLink>
          <NavLink to="/monitor">监控</NavLink>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/monitor" element={<MonitorLayout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="system" element={<SystemPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route
          path="*"
          element={
            <section className="card">
              <h2>页面不存在</h2>
              <p>当前路由没有匹配的页面，请检查导航链接。</p>
            </section>
          }
        />
      </Routes>
    </div>
  );
}
