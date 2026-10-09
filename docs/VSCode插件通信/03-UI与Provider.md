# 注册 UI 能力：插件告诉 VS Code「怎么画界面」

插件不能直接改 VS Code 的 HTML。做法是：在代码里 **注册** 树、状态栏等能力，VS Code 界面进程负责绘制；需要数据时 **来问** 你的 Provider（拉取），数据变了你再 **通知** VS Code 重画（推送）。

---

## 侧边栏树（TreeView）

### 在 package.json 里占一个侧栏位置

活动栏容器 + 视图 ID（和代码里的字符串必须一致）：

```28:44:package.json
    "viewsContainers": {
      "activitybar": [
        {
          "id": "hardware-core-monitor",
          ...
        }
      ]
    },
    "views": {
      "hardware-core-monitor": [
        {
          "id": "hardware-core-monitor.sidebarView",
          ...
        }
      ]
    },
```

### `vscode.window.createTreeView` 做什么

**作用**：把 `package.json` 里的 viewId 和一个 **TreeDataProvider** 实例连起来，返回 `TreeView` 对象（可监听 `onDidChangeVisibility` 等）。

**在哪里**：`src/extension.ts`

```27:34:src/extension.ts
  const treeProvider = new HardwareTreeProvider();
  ...
  const treeView = vscode.window.createTreeView(
    "hardware-core-monitor.sidebarView",
    { treeDataProvider: treeProvider },
  );
```

通信：注册完成后，VS Code 在需要显示树时会 **跨进程调用** `HardwareTreeProvider` 的方法。

---

### `TreeDataProvider` 里三个关键成员

**文件**：`src/hardwareTreeProvider.ts`

#### 1. `onDidChangeTreeData`（推送给 VS Code：请刷新树）

```20:24:src/hardwareTreeProvider.ts
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    HardwareTreeItem | undefined | null | void
  >();

  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
```

VS Code 订阅这个 event（注册 TreeView 时内部完成）。你在数据更新后 **fire**：

```28:39:src/hardwareTreeProvider.ts
  update(snapshot: MonitorSnapshot): void {
    this.snapshot = snapshot;
    ...
    this._onDidChangeTreeData.fire();
  }
```

通信方向：**Extension Host fire → VS Code 收到 → 再次调用 getChildren / getTreeItem**。

#### 2. `getTreeItem`（VS Code 拉取：这一行怎么显示）

```42:44:src/hardwareTreeProvider.ts
  getTreeItem(element: HardwareTreeItem): vscode.TreeItem {
    return element;
  }
```

每个节点是一个 `vscode.TreeItem`（标签、图标、tooltip 等）。

#### 3. `getChildren`（VS Code 拉取：子节点列表）

```46:57:src/hardwareTreeProvider.ts
  getChildren(
    element?: HardwareTreeItem,
  ): vscode.ProviderResult<HardwareTreeItem[]> {
    if (!this.snapshot) {
      return [HardwareTreeItem.createLoading()];
    }

    if (!element) {
      return this.createRootItems(this.snapshot);
    }

    return this.createDetailItems(element.id, this.snapshot);
  }
```

- 没有 `element`：要 **根节点**（CPU、内存等分类）。
- 有 `element`：要该节点下的 **子节点**（展开时 VS Code 才会问）。

`update(snapshot)` 的数据来自 `MonitorService`，不是在这里采集硬件；见 [06-内部事件总线.md](./06-内部事件总线.md)。

---

### 欢迎页 `viewsWelcome`

还没数据时显示欢迎文案，条件在 `package.json`：

```47:52:package.json
    "viewsWelcome": [
      {
        "view": "hardware-core-monitor.sidebarView",
        "contents": "%view.welcome%",
        "when": "!hardwareMonitorHasData"
      }
    ],
```

第一次有快照时，`hardwareTreeProvider.update` 里会 `setContext('hardwareMonitorHasData', true)`，欢迎页隐藏。见 [05-上下文键与when.md](./05-上下文键与when.md)。

---

## 状态栏（Status Bar）

### `vscode.window.createStatusBarItem` 做什么

**作用**：创建一个状态栏条目对象，改它的 `text`、`tooltip` 等，再 `show()`，VS Code 会在窗口底部渲染。

**在哪里**：`src/statusBarController.ts`

```14:24:src/statusBarController.ts
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );

    this.item.command = "hardware-core-monitor.showDashboard";
    this.item.name = text.statusBar.name();
    this.item.text = "$(pulse) CPU --% | RAM --%";
    this.item.tooltip = text.statusBar.tooltip();
```

### `update(snapshot)` 做什么

**在哪里**：被 `extension.ts` 里 `monitorService.onDidChangeSnapshot` 回调调用。

```26:37:src/statusBarController.ts
  update(snapshot: MonitorSnapshot): void {
    this.item.text = `$(pulse) CPU ${snapshot.cpu.usage.toFixed(0)}% | RAM ${snapshot.memory.usage.toFixed(0)}%`;
    this.item.tooltip = new vscode.MarkdownString(
      [
        text.statusBar.cpuUsage(snapshot.cpu.usage.toFixed(1)),
        ...
      ].join("\n"),
    );
    this.item.show();
  }
```

通信方向：**插件改 item 属性 → VS Code 更新底部状态栏**。点击走 `item.command`，见 [01-命令.md](./01-命令.md)。

---

## 通知消息（和命令常一起出现）

`vscode.window.showInformationMessage`：**插件发起**，VS Code 弹出 toast。

在 `startMonitoring` / `stopMonitoring` 的 command 回调里使用（`extension.ts`），用来告诉用户「已开始 / 已暂停」。

`thresholdAlerter.ts` 里在 CPU/内存超阈值时也会用 VS Code 的消息 API 提示用户（读取的配置来自 `getConfiguration`）。

---

## 树 + 状态栏在本项目中的串联

```
MonitorService 采集完成
    → fire onDidChangeSnapshot
    → extension.ts 回调
         ├─ treeProvider.update(snapshot)  → fire onDidChangeTreeData → VS Code 重绘树
         └─ statusBar.update(snapshot)     → 改 StatusBarItem → VS Code 重绘状态栏
```

TreeView 是 **拉取 + 推送**；StatusBar 是 **插件直接改对象属性**（没有 Provider 回调）。
