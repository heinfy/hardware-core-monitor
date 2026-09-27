import { NavLink, Outlet } from "react-router-dom";

/** 监控二级布局：顶部二级导航，下面切换概览 / 系统信息 / 设置 */
export function MonitorLayout() {
  return (
    <div>
      <nav className="sub-nav" aria-label="监控">
        <NavLink to="/monitor/overview">概览</NavLink>
        <NavLink to="/monitor/system">系统信息</NavLink>
        <NavLink to="/monitor/settings">设置</NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
