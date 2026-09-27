import { useState } from "react";
import MagicBento from "../../components/MagicBento";

/** 监控 / 设置：用 Magic Bento 承载示例设置项 */
export function SettingsPage() {
  const [compactMode, setCompactMode] = useState(false);

  return (
    <section>
      <h2>设置</h2>
      <MagicBento
        textAutoHide={false}
        cards={[
          {
            label: "显示",
            title: "紧凑模式",
            description: compactMode
              ? "已开启，仅用于演示路由页状态"
              : "已关闭，仅用于演示路由页状态",
            children: (
              <label className="setting-row mt-3 text-sm text-white">
                <input
                  type="checkbox"
                  checked={compactMode}
                  onChange={(event) => setCompactMode(event.target.checked)}
                />
                启用紧凑模式
              </label>
            ),
          },
          {
            label: "说明",
            title: "独立前端",
            description:
              "这是 webview2 的独立前端路由页面，与原有 webview 完全隔离。",
          },
        ]}
      />
    </section>
  );
}
