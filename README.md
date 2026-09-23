# 硬核监控 (Hardware Core Monitor)

一款 VSCode 扩展，在编辑器内实时监控硬件状态和系统性能，无需切换工具即可查看 CPU、内存、磁盘、网络等信息。

## 功能

- 实时监控：CPU 使用率、内存、磁盘读写速度、网络速度
- 硬件信息：处理器、内存、存储、显卡、电池状态
- 多种展示：状态栏指标、侧边栏树形视图、Webview 仪表盘
- 通知提醒：资源使用超过阈值时警告
- 跨平台：支持 Windows、macOS、Linux（x86 / ARM）

支持自定义刷新频率、状态栏显示项和警告阈值，并自动适配 VSCode 亮色/暗色主题。

## 打开 Webview 页面

扩展提供两个 Webview 仪表盘，可在编辑器内查看实时硬件数据：

| 页面 | 说明 |
| --- | --- |
| **硬件仪表盘** | 卡片式总览，展示 CPU、内存、磁盘、网络等核心指标 |
| **Webview2（路由页面）** | 带前端路由的多页界面，含首页、系统详情、设置等 |

### 日常使用

1. 按 `Cmd+Shift+P`（Windows / Linux：`Ctrl+Shift+P`）打开命令面板。
2. 输入并执行以下命令之一：
   - `硬件监控: 打开硬件仪表盘` — 打开主仪表盘
   - `硬件监控: 打开 Webview2（路由页面）` — 打开路由版页面
3. 也可点击右下角状态栏的 CPU / 内存指标，直接打开硬件仪表盘。

### 本地开发（热更新）

开发 Webview 前端时，可配合 Vite Dev Server 实现热更新：

```bash
# 终端 1：启动 webview 与 webview2 开发服务器
pnpm run dev:webview    # http://localhost:5173
pnpm run dev:webview2   # http://localhost:5174

# 终端 2：监听扩展宿主代码
pnpm run watch:extension
```

然后在 VS Code 中选择 **Run Extension (Webview HMR)** 启动调试，再通过命令面板打开对应 Webview 页面即可看到热更新效果。

## 开发

本仓库使用 pnpm workspace 管理依赖。

```bash
pnpm install
pnpm run compile
pnpm run watch
pnpm run package
```
