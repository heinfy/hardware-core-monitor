# `vscode.EventEmitter` 简单 Demo

下面是一个 **最小可理解** 的例子：在插件里定义「计数变化」事件，在 `activate` 里订阅，用命令让数字 +1 并 `fire`。

不依赖 TreeView / Webview，只演示 **创建 → 订阅 → 发送**。

---

## 1. 完整代码（可放进 `extension.ts` 里试）

```typescript
import * as vscode from "vscode";

/** 演示：用 EventEmitter 在插件内部传数字 */
class CounterService implements vscode.Disposable {
  // ① 私有：只有本类能 fire
  private readonly _onDidChangeCount = new vscode.EventEmitter<number>();

  // ② 对外：别人只能 .onDidChangeCount(回调) 订阅
  readonly onDidChangeCount = this._onDidChangeCount.event;

  private count = 0;

  /** 读当前值（可选，方便调试） */
  get value(): number {
    return this.count;
  }

  /** 加一，并通知所有订阅者 */
  increment(): void {
    this.count += 1;
    // ③ 发事件：把最新的 count 传给每一个 listener
    this._onDidChangeCount.fire(this.count);
  }

  dispose(): void {
    this._onDidChangeCount.dispose();
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const counter = new CounterService();

  // ④ 订阅：每次 fire 都会执行这个回调
  counter.onDidChangeCount(
    (newCount) => {
      vscode.window.setStatusBarMessage(`Demo count: ${newCount}`, 3000);
    },
    undefined,
    context.subscriptions,
  );

  // ⑤ 用命令触发 increment → 内部 fire → 上面回调运行
  const inc = vscode.commands.registerCommand("demo.incrementCount", () => {
    counter.increment();
  });

  context.subscriptions.push(counter, inc);
}
```

若要在本仓库里真跑，还需在 `package.json` 的 `contributes.commands` 里加一条 `demo.incrementCount`，并在命令面板执行一次。本文档只说明 EventEmitter 用法，不修改仓库配置。

---

## 2. 执行顺序（按一次「执行命令」）

```
用户执行 demo.incrementCount
    → counter.increment()
    → count 变成 1
    → _onDidChangeCount.fire(1)
    → 订阅回调 (newCount) => { setStatusBarMessage(...) } 被调用，newCount === 1
```

再执行一次命令，`newCount` 依次为 `2`、`3`…

---

## 3. 三个 API 对照

| 代码                                                       | 作用                                              |
| ---------------------------------------------------------- | ------------------------------------------------- |
| `new vscode.EventEmitter<number>()`                        | 创建事件源；`number` 表示每次 fire 携带的数字类型 |
| `readonly onDidChangeCount = this._onDidChangeCount.event` | 暴露「可订阅面」，外部不能 fire                   |
| `this._onDidChangeCount.fire(this.count)`                  | 通知所有订阅者，并把 `this.count` 作为参数传入    |
| `counter.onDidChangeCount((n) => { ... })`                 | 订阅；`n` 就是 fire 时传入的值                    |
| `this._onDidChangeCount.dispose()`                         | 扩展销毁时释放                                    |

---

## 4. 变体：不带数据的 `fire()`（只通知「变了」）

```typescript
private readonly _onDidTick = new vscode.EventEmitter<void>();
readonly onDidTick = this._onDidTick.event;

tick(): void {
  // 订阅方回调可以是 () => { ... }，不关心参数
  this._onDidTick.fire();
}
```

适用场景：**数据已经写在类的字段里**，订阅者被通知后 **自己再来读**（和本仓库 `HardwareTreeProvider` 里 `update` 存 `snapshot` 再 `onDidChangeTreeData.fire()` 一样）。

---

## 5. 和本仓库的对应关系

| Demo                             | 本仓库                                            |
| -------------------------------- | ------------------------------------------------- |
| `CounterService` + `fire(count)` | `MonitorService` + `fire(snapshot)`               |
| `onDidChangeCount` 订阅          | `extension.ts` 里 `onDidChangeSnapshot`           |
| 命令 `increment` 触发            | `start` / 采集完成触发 fire                       |
| `EventEmitter<void>` + `fire()`  | `HardwareTreeProvider.onDidChangeTreeData.fire()` |

更完整的项目内说明见 [06-内部事件总线.md](./06-内部事件总线.md)。
