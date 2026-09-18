import { useState } from "react";

/** 设置路由：前端路由示例页面，可替换为实际业务设置 */
export function SettingsPage() {
  const [compactMode, setCompactMode] = useState(false);

  return (
    <section className="card">
      <h2>设置</h2>

      <label className="setting-row">
        <input
          type="checkbox"
          checked={compactMode}
          onChange={(event) => setCompactMode(event.target.checked)}
        />
        紧凑模式（示例状态，仅用于演示路由页）
      </label>

      <p className="muted">
        这是 webview2 的独立前端路由页面，与原有 webview 完全隔离。
      </p>
    </section>
  );
}
