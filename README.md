# 硬核监控 (Hardware Core Monitor)

一款 VSCode 扩展，在编辑器内实时监控硬件状态和系统性能，无需切换工具即可查看 CPU、内存、磁盘、网络等信息。

## 功能

- 实时监控：CPU 使用率、内存、磁盘读写速度、网络速度、CPU/GPU 温度
- 硬件信息：处理器、内存、存储、显卡、电池状态
- 多种展示：状态栏指标、侧边栏树形视图、Webview 仪表盘
- 通知提醒：资源使用超过阈值时警告
- 跨平台：支持 Windows、macOS、Linux（x86 / ARM）

支持自定义刷新频率、状态栏显示项和警告阈值，并自动适配 VSCode 亮色/暗色主题。

## 开发

本仓库使用 pnpm workspace 管理依赖。

```bash
pnpm install
pnpm run compile
pnpm run watch
pnpm run package
```
