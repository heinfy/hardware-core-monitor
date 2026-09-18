# Webview 消息通信技术文档

## 1. 概述

本项目中的 Webview 通信采用 VS Code 官方的 Webview 消息模型：

- 扩展宿主（Extension Host）运行在 Node.js 环境，负责调用 `systeminformation` 采集硬件数据。
- Webview 前端运行在 VS Code 提供的浏览器沙箱中，只负责 React 渲染。
- 两侧没有共享对象，也不能直接调用对方函数。
- 两侧仅通过 `postMessage` 互相发送可序列化消息。
- 消息协议类型集中在 `src/shared/protocol.ts`，由扩展宿主与前端共同引用。

这套机制不是 WebSocket，也不是 Electron 的 `ipcMain` / `ipcRenderer` 直连；消息由 VS Code Webview 宿主负责跨环境传递。

## 2. 架构边界

```text
┌────────────────────────────┐
│ React Webview             │
│ - Vite 构建产物            │
│ - 只负责渲染               │
└────────────┬───────────────┘
             │ acquireVsCodeApi().postMessage()
             │ window message 事件
             ▼
┌────────────────────────────┐
│ VS Code Webview 宿主桥     │
└────────────┬───────────────┘
             │ panel.webview.onDidReceiveMessage()
             │ panel.webview.postMessage()
             ▼
┌────────────────────────────┐
│ Extension Host / Node.js   │
│ - DashboardPanel           │
│ - Webview2Panel             │
│ - MonitorService           │
│ - systeminformation        │
└────────────────────────────┘
```

职责划分：

| 模块                    | 位置                                                    | 职责                                   |
| ----------------------- | ------------------------------------------------------- | -------------------------------------- |
| `MonitorService`        | `src/monitorService.ts`                                 | 唯一数据源，周期采集硬件数据并广播事件 |
| `DashboardPanel`        | `src/dashboardPanel.ts`                                 | 创建第一个 Webview 面板，转发消息      |
| `Webview2Panel`         | `src/webview2Panel.ts`                                  | 创建第二个 Webview 面板，转发消息      |
| `protocol.ts`           | `src/shared/protocol.ts`                                | 定义两侧共享的消息类型和快照结构       |
| `vscodeApi.ts`          | `webview/src/vscodeApi.ts`、`webview2/src/vscodeApi.ts` | 封装 `acquireVsCodeApi()`              |
| `useMonitorSnapshot.ts` | `webview/src/hooks/`、`webview2/src/hooks/`             | React 侧发送请求并接收快照             |

## 3. 消息协议

协议定义位于 `src/shared/protocol.ts`。

### 3.1 Webview → Extension Host

```ts
export type WebviewToHostMessage = { type: "ready" } | { type: "refresh" };
```

| 消息      | 触发时机         | 扩展宿主行为                                   |
| --------- | ---------------- | ---------------------------------------------- |
| `ready`   | React 组件挂载后 | 立即采集一次；如已有缓存快照，先补发给 Webview |
| `refresh` | 用户点击刷新按钮 | 立即采集一次；如已有缓存快照，先补发给 Webview |

`ready` 的意义是解决 Webview 加载时序问题：扩展宿主可能早已采集过数据，也可能面板创建早于前端脚本完成初始化。前端挂载后主动发送 `ready`，宿主收到后才补发 `latestSnapshot`，避免首屏空白等待。

### 3.2 Extension Host → Webview

```ts
export type HostToWebviewMessage =
  | { type: "snapshot"; snapshot: MonitorSnapshot }
  | { type: "error"; message: string };
```

| 消息       | 触发时机                      | Webview 行为                               |
| ---------- | ----------------------------- | ------------------------------------------ |
| `snapshot` | `MonitorService` 每轮采集成功 | 更新 React state，清空错误状态，触发重渲染 |
| `error`    | `MonitorService` 采集失败     | 更新错误 state，页面展示错误信息           |

### 3.3 `MonitorSnapshot`

`MonitorSnapshot` 是发送给 Webview 的完整硬件快照，包含：

- `timestamp`：采集完成时间戳，毫秒
- `cpu`：整体使用率和每个核心使用率
- `memory`：总内存、已用内存、空闲内存和使用率
- `disks`：磁盘挂载点、容量、已用空间和使用率
- `network`：网卡名称、每秒接收/发送字节数
- `temperature`：CPU 主温度，不可用时为 `null`
- `system`：平台、发行版、内核、主机名、架构、CPU 型号等静态信息
- `battery`：电池信息，无电池时为 `null`

设计上只把 `systeminformation` 原始返回值转换成轻量、可序列化的快照，不把巨大的原始对象或 Node 专属能力泄漏进 Webview。

## 4. 完整数据流

以用户打开仪表盘并持续监控为例：

```text
1. 用户执行 showDashboard 命令
2. DashboardPanel.createOrShow 创建 WebviewPanel
3. Webview 加载 Vite 产物或 Dev Server 资源
4. React 组件挂载，useMonitorSnapshot 发送 ready
5. DashboardPanel.onDidReceiveMessage 收到 ready
6. MonitorService.requestNow() 立即采集
7. MonitorService 拉取 systeminformation 数据
8. collectSnapshot 转换为 MonitorSnapshot
9. MonitorService 保存 latest 并触发 onDidChangeSnapshot
10. DashboardPanel 订阅者调用 panel.webview.postMessage(snapshot)
11. Webview window 收到 message 事件
12. useMonitorSnapshot 调用 setSnapshot
13. React 重渲染仪表盘
14. MonitorService 继续按 intervalMs 周期采集并重复 7-13
```

手动刷新流程与上述步骤相同，只是入口消息从 `ready` 换成 `refresh`。

## 5. 关键实现

### 5.1 前端发送：`acquireVsCodeApi().postMessage`

前端发送消息的封装位于 `webview/src/vscodeApi.ts` 与 `webview2/src/vscodeApi.ts`：

```ts
declare function acquireVsCodeApi(): VsCodeApi;

let api: VsCodeApi | undefined;

export function getVsCodeApi(): VsCodeApi {
  api ??= acquireVsCodeApi();
  return api;
}

export function postToHost(message: WebviewToHostMessage): void {
  getVsCodeApi().postMessage(message);
}
```

要点：

- `acquireVsCodeApi()` 由 VS Code Webview 宿主注入。
- 每个页面只能成功调用一次，因此封装为单例。
- 当前只使用 `postMessage`；`getState` / `setState` 保留在接口定义中，供后续持久化 Webview 状态使用。

### 5.2 前端接收：`window` message 事件

React Hook 位于 `webview/src/hooks/useMonitorSnapshot.ts` 与 `webview2/src/hooks/useMonitorSnapshot.ts`：

```ts
useEffect(() => {
  postToHost({ type: "ready" });

  const handleMessage = (event: MessageEvent<HostToWebviewMessage>) => {
    const message = event.data;

    switch (message.type) {
      case "snapshot":
        setSnapshot(message.snapshot);
        setError(null);
        break;
      case "error":
        setError(message.message);
        break;
    }
  };

  window.addEventListener("message", handleMessage);

  return () => {
    window.removeEventListener("message", handleMessage);
  };
}, []);
```

生命周期：

1. 组件挂载后发送 `ready`。
2. 监听 `window` 的 `message` 事件。
3. 收到 `snapshot` 或 `error` 后更新 React state。
4. 组件卸载时移除监听器，避免泄漏。

### 5.3 扩展宿主接收：`onDidReceiveMessage`

以 `src/dashboardPanel.ts` 为例：

```ts
panel.webview.onDidReceiveMessage((message: WebviewToHostMessage) => {
  if (message.type === "ready" || message.type === "refresh") {
    this.monitorService.requestNow();

    if (this.monitorService.latestSnapshot) {
      void this.postSnapshot(this.monitorService.latestSnapshot);
    }
  }
});
```

这里做了两件事：

- `requestNow()` 触发立即采集，不影响原有周期调度。
- 如果 `MonitorService` 已有缓存快照，先补发一份，保证 Webview 不需要等待下一轮采集。

### 5.4 扩展宿主发送：`panel.webview.postMessage`

```ts
private async postSnapshot(snapshot: MonitorSnapshot): Promise<void> {
  await this.panel.webview.postMessage({
    type: "snapshot",
    snapshot,
  } satisfies HostToWebviewMessage);
}
```

`postMessage` 的参数必须是可结构化克隆的数据。当前协议中的对象都是普通 JSON-like 数据，满足该要求。

## 6. MonitorService 的事件模型

`MonitorService` 是插件中唯一的数据源，`TreeView`、`StatusBar`、阈值告警和 Webview 都只消费它发出的事件。

核心机制：

- 使用递归 `setTimeout`，不是 `setInterval`，保证上一轮采集完成后才安排下一轮，避免慢机器上请求堆积。
- 静态系统信息只采集一次并缓存。
- `isCollecting` 保证并发请求时只保留一次实际执行。
- 最近一次成功快照保存在 `latest`，供 Webview 打开后立即补发。
- 数据事件：
  - `onDidChangeSnapshot`：采集成功
  - `onDidError`：采集失败

## 7. 两个 Webview 的关系

`Webview2Panel` 不是 Microsoft Edge WebView2，而是第二个 VS Code WebviewPanel。

它与 `DashboardPanel` 的通信原理完全一致，区别只在：

- 独立的 `viewType`
- 资源目录使用 `dist/webview2`
- 开发服务器使用 `WEBVIEW2_DEV_SERVER_URL`，默认端口 `5174`
- 前端路由使用 HashRouter，`retainContextWhenHidden` 保证隐藏时路由状态不丢失

两个 Webview 同时打开时，都会订阅同一个 `MonitorService`。每轮采集成功后，`MonitorService` 触发一次快照事件，两个面板各自调用 `postMessage`，分别向自己的 Webview 推送同一份快照。

## 8. 安全与资源加载

### 8.1 Webview 选项

面板创建时启用了：

```ts
enableScripts: true,
retainContextWhenHidden: true,
localResourceRoots: [
  vscode.Uri.joinPath(context.extensionUri, "dist/webview"),
],
```

- `enableScripts` 是运行 React 前端和消息通信的必要条件。
- `retainContextWhenHidden` 让面板隐藏时保留 React 状态和路由状态。
- `localResourceRoots` 限制 Webview 可访问的本地资源目录，两个面板分别只允许访问自己的产物目录。

### 8.2 CSP

生产环境 CSP 形如：

```text
default-src 'none';
script-src ${webview.cspSource};
style-src ${webview.cspSource};
img-src ${webview.cspSource} data:;
font-src ${webview.cspSource};
```

`webview.cspSource` 是 VS Code 为该 Webview 生成的受信资源源。生产环境只允许加载 Webview 内部资源，不放开外部网络请求。

开发环境会根据 `WEBVIEW_DEV_SERVER_URL` / `WEBVIEW2_DEV_SERVER_URL` 放行 Vite Dev Server 与 WebSocket，以支持热更新。

## 9. 设计限制与注意事项

当前实现是单向通知式消息，没有以下机制：

- 请求/响应关联 ID
- 消息确认
- 超时重试
- 消息队列
- 运行时协议校验

因此需要注意：

1. `postMessage` 成功不代表 React 已经完成渲染，只代表消息已提交给 Webview 宿主。
2. 如果 Webview 尚未加载完成，宿主发送的消息可能无法被前端监听到；这就是前端挂载后发送 `ready`，宿主再补发 `latestSnapshot` 的原因。
3. `retainContextWhenHidden: true` 时隐藏面板仍保留状态；如果未来改为 `false`，隐藏时 Webview 可能被销毁，需要重新设计消息补发和状态恢复逻辑。
4. TypeScript 类型只保证编译期约束。当前消息结构简单且来源可信；如果未来加入复杂消息或来自不可信输入的字段，应在扩展宿主侧增加运行时校验。
5. 频繁推送大快照可能影响性能。当前实现每轮只发送一个轻量 `MonitorSnapshot`，默认间隔为 2 秒，且最小间隔被限制为 500 毫秒。

## 10. 常见排查方式

| 现象                   | 优先检查                                                             |
| ---------------------- | -------------------------------------------------------------------- |
| Webview 打开后一直空白 | 前端是否执行到 `postToHost({ type: "ready" })`；宿主是否收到 `ready` |
| 页面没有新数据         | `MonitorService.start()` 是否已调用；`onDidChangeSnapshot` 是否触发  |
| 页面显示 error         | 扩展宿主控制台中 `[Hardware Monitor] collect failed` 日志            |
| React 状态丢失         | 面板是否被销毁；`retainContextWhenHidden` 是否仍为 `true`            |
| 资源加载失败           | 生产构建产物是否存在；CSP 是否包含 `webview.cspSource`               |
| Dev Server 不生效      | 对应环境变量是否配置；端口是否与 `5173` / `5174` 匹配                |
