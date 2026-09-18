import { NavLink, Route, Routes } from "react-router-dom";
import { HomePage } from "./routes/HomePage";
import { SystemPage } from "./routes/SystemPage";
import { SettingsPage } from "./routes/SettingsPage";

/** Webview2 根组件：顶部导航 + 前端路由 */
export function App() {
  return (
    <div className="page">
      <nav className="top-nav">
        <span className="brand">Webview2</span>
        <div className="nav-links">
          <NavLink to="/" end>
            概览
          </NavLink>
          <NavLink to="/system">系统信息</NavLink>
          <NavLink to="/settings">设置</NavLink>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/system" element={<SystemPage />} />
        <Route path="/settings" element={<SettingsPage />} />
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
