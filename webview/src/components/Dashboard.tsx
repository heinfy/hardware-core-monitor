import { useCallback, useEffect, useState } from "react";
import type {
  HostToWebviewMessage,
  MonitorSnapshot,
} from "../../../src/shared/protocol";
import {
  buildReportFileName,
  formatSnapshotReport,
  PROJECT_GITHUB_URL,
} from "../utils/snapshotReport";
import { postToHost } from "../vscodeApi";
import { BluetoothCard } from "./BluetoothCard";
import { CpuCard } from "./CpuCard";
import { DiskCard } from "./DiskCard";
import { GpuCard } from "./GpuCard";
import { MemoryCard } from "./MemoryCard";
import { MiscCard } from "./MiscCard";
import { NetworkCard } from "./NetworkCard";
import { SystemCard } from "./SystemCard";

interface DashboardProps {
  snapshot: MonitorSnapshot;
  onRefresh: () => void;
}

/** 仪表盘主布局 */
export function Dashboard({ snapshot, onRefresh }: DashboardProps) {
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState(true);

  // 数据更新时间展示
  const updatedAt = new Date(snapshot.timestamp).toLocaleTimeString("zh-CN");

  /** 监听复制/导出操作的宿主反馈 */
  useEffect(() => {
    const handleMessage = (event: MessageEvent<HostToWebviewMessage>) => {
      if (event.data.type !== "actionResult") {
        return;
      }

      setActionSuccess(event.data.success);
      setActionMessage(event.data.message);
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  /** 操作反馈自动消失 */
  useEffect(() => {
    if (!actionMessage) {
      return;
    }

    const timer = window.setTimeout(() => {
      setActionMessage(null);
    }, 2600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [actionMessage]);

  /** 复制当前硬件报告 */
  const handleCopy = useCallback(() => {
    postToHost({
      type: "copyReport",
      content: formatSnapshotReport(snapshot),
    });
  }, [snapshot]);

  /** 导出当前硬件报告 */
  const handleExport = useCallback(() => {
    postToHost({
      type: "exportReport",
      content: formatSnapshotReport(snapshot),
      fileName: buildReportFileName(snapshot),
    });
  }, [snapshot]);

  return (
    <div className="page">
      <header className="toolbar">
        <div className="toolbar-title">
          <p className="toolbar-kicker">HARDWARE CORE MONITOR</p>
          <h1>硬件监控</h1>
          <span className="updated-at">更新于 {updatedAt}</span>
        </div>

        <div className="toolbar-actions">
          <button type="button" className="btn-secondary" onClick={handleCopy}>
            复制报告
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleExport}
          >
            导出 TXT
          </button>
          <button type="button" onClick={onRefresh}>
            立即刷新
          </button>
        </div>
      </header>

      {actionMessage ? (
        <div
          className={`action-toast ${actionSuccess ? "toast-success" : "toast-error"}`}
          role="status"
        >
          {actionMessage}
        </div>
      ) : null}

      <main className="dashboard-grid">
        <CpuCard snapshot={snapshot} />
        <MemoryCard snapshot={snapshot} />
        <GpuCard snapshot={snapshot} />
        <DiskCard snapshot={snapshot} />
        <NetworkCard snapshot={snapshot} />
        <BluetoothCard snapshot={snapshot} />
        <MiscCard snapshot={snapshot} />
        <SystemCard snapshot={snapshot} />
      </main>

      <footer className="page-footer">
        <span className="footer-label">开源项目</span>
        <button
          type="button"
          className="footer-link"
          onClick={() => {
            postToHost({ type: "openExternal", url: PROJECT_GITHUB_URL });
          }}
        >
          {PROJECT_GITHUB_URL}
        </button>
      </footer>
    </div>
  );
}
