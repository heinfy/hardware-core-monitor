# 上下文键（Context Keys）与 `when`：控制按钮/欢迎页显不显示

## 是什么

`package.json` 里菜单、欢迎页可以写 **`when: "某个表达式"`**。表达式里可以用：

- VS Code **内置** 变量（如 `view == '...'`）
- 插件自己设置的 **自定义键**（布尔或字符串）

插件 **不能** 直接隐藏某个按钮 DOM，而是通过 **`vscode.commands.executeCommand('setContext', 键名, 值)`** 更新键值，VS Code 重新计算 `when`，界面上的 Play/Pause、欢迎页等随之变化。

通信方向：**Extension Host 执行 setContext → VS Code UI 更新菜单/欢迎页可见性**。

---

## 本项目的自定义上下文键

| 键名                       | 含义                                  | 设为 true 的典型时机                | 设为 false 的典型时机  |
| -------------------------- | ------------------------------------- | ----------------------------------- | ---------------------- |
| `hardwareMonitorIsRunning` | 监控是否在跑（用于标题栏 Play/Pause） | 开始监控、侧栏可见且启动            | 停止监控、侧栏隐藏     |
| `hardwareMonitorHasData`   | 是否已有至少一次快照（用于欢迎页）    | 第一次 `treeProvider.update` 有数据 | （本项目不设回 false） |

常量 `hardwareMonitorIsRunning` 在代码里叫 `MONITORING_CONTEXT`：

```11:12:src/extension.ts
/** 控制活动栏标题按钮显示状态的上下文键 */
const MONITORING_CONTEXT = "hardwareMonitorIsRunning";
```

---

## `setContext` 在哪里调用

### 1. 侧栏可见性同步（开始/停止 + 改键）

`src/extension.ts` → `syncMonitoringWithSidebarVisibility`：

可见时：

```49:56:src/extension.ts
    if (visible) {
      monitorService.updateInterval(getRefreshIntervalMs());
      monitorService.start();
      void vscode.commands.executeCommand(
        "setContext",
        MONITORING_CONTEXT,
        true,
      );
```

不可见时：

```60:64:src/extension.ts
    monitorService.stop();
    void vscode.commands.executeCommand(
      "setContext",
      MONITORING_CONTEXT,
      false,
    );
```

### 2. 用户点标题栏 Play / Pause（命令回调里改键）

开始：

```84:87:src/extension.ts
      void vscode.commands.executeCommand(
        "setContext",
        MONITORING_CONTEXT,
        true,
      );
```

停止：

```109:112:src/extension.ts
      void vscode.commands.executeCommand(
        "setContext",
        MONITORING_CONTEXT,
        false,
      );
```

注意：改键和 `monitorService.start/stop` 是一起的；键只负责 **UI 显示哪个按钮**，不负责采集本身。

### 3. 第一次有树数据（隐藏欢迎页）

`src/hardwareTreeProvider.ts` → `update`：

```32:37:src/hardwareTreeProvider.ts
    void vscode.commands.executeCommand(
      "setContext",
      "hardwareMonitorHasData",
      true,
    );
```

---

## package.json 里 `when` 怎么用这些键

### 侧栏标题：Refresh 始终在该视图显示；Play / Pause 互斥

```84:100:package.json
      "view/title": [
        {
          "command": "hardware-core-monitor.refreshMonitoring",
          "when": "view == hardware-core-monitor.sidebarView",
          ...
        },
        {
          "command": "hardware-core-monitor.startMonitoring",
          "when": "view == hardware-core-monitor.sidebarView && !hardwareMonitorIsRunning",
          ...
        },
        {
          "command": "hardware-core-monitor.stopMonitoring",
          "when": "view == hardware-core-monitor.sidebarView && hardwareMonitorIsRunning",
          ...
        }
      ]
```

读法：

- `view == hardware-core-monitor.sidebarView`：只有在本插件侧栏树视图时显示这些按钮。
- `!hardwareMonitorIsRunning`：上下文为 false 或未设时显示 **开始**。
- `hardwareMonitorIsRunning`：为 true 时显示 **暂停**。

用户点 Play → 命令里 `setContext(..., true)` → VS Code 隐藏 Play、显示 Pause。

### 欢迎页：还没数据时显示

```47:52:package.json
    "viewsWelcome": [
      {
        "view": "hardware-core-monitor.sidebarView",
        "contents": "%view.welcome%",
        "when": "!hardwareMonitorHasData"
      }
    ],
```

第一次 `hardwareMonitorHasData` 设为 true 后，欢迎文案不再显示，树由 `TreeDataProvider` 提供内容（见 [03-UI与Provider.md](./03-UI与Provider.md)）。

---

## 和 TreeItem 的 `contextValue`（本项目）

有些扩展用 `treeItem.contextValue = 'xxx'`，在 `menus` 的 `view/item/context` 里写 `when: "viewItem == xxx"` 控制 **右键菜单**。本插件当前 **没有** 用节点级 context 菜单，只有视图标题栏和欢迎页用到上下文键。

---

## 小结：谁写键、谁读键

| 写键（插件）                                                   | 读键（VS Code UI）                                  |
| -------------------------------------------------------------- | --------------------------------------------------- |
| `executeCommand('setContext', 'hardwareMonitorIsRunning', …)`  | `menus.view/title` 里 Play/Pause 的 `when`          |
| `executeCommand('setContext', 'hardwareMonitorHasData', true)` | `viewsWelcome` 的 `when: "!hardwareMonitorHasData"` |

命令 ID 与 `setContext` 的关系见 [01-命令.md](./01-命令.md)。
