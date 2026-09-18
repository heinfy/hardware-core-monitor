import { useCallback, useEffect, useState } from "react";
import type {
  HostToWebviewMessage,
  MonitorSnapshot,
} from "../../../src/shared/protocol";
import { postToHost } from "../vscodeApi";

/**
 * 订阅扩展宿主推送的硬件快照。
 *
 * 生命周期：
 * 1. 挂载后发送 ready，宿主会立即回传最新数据；
 * 2. 监听 window message 接收快照或错误；
 * 3. 卸载时移除监听。
 */
export function useMonitorSnapshot() {
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  /** 手动请求立即刷新 */
  const refresh = useCallback(() => {
    postToHost({ type: "refresh" });
  }, []);

  return { snapshot, error, refresh };
}
