import type { MonitorSnapshot } from "../../../src/shared/protocol";
import { CpuCard } from "./CpuCard";
import { DiskCard } from "./DiskCard";
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
  // 数据更新时间展示
  const updatedAt = new Date(snapshot.timestamp).toLocaleTimeString("zh-CN");

  return (
    <div className="page">
      <header className="toolbar">
        <div>
          <h1>硬件监控</h1>
          <span className="updated-at">更新于 {updatedAt}</span>
        </div>
        <button type="button" onClick={onRefresh}>
          立即刷新
        </button>
      </header>

      <main className="dashboard-grid">
        <CpuCard snapshot={snapshot} />
        <MemoryCard snapshot={snapshot} />
        <DiskCard snapshot={snapshot} />
        <NetworkCard snapshot={snapshot} />
        <MiscCard snapshot={snapshot} />
        <SystemCard snapshot={snapshot} />
      </main>
    </div>
  );
}
