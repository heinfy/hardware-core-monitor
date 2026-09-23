import type {
  MonitorSnapshot,
  StorageDiskSnapshot,
} from "../../../src/shared/protocol";
import { formatBytes, formatSpeed } from "../utils/format";

interface DiskCardProps {
  snapshot: MonitorSnapshot;
}

/** 格式化可选硬件字段 */
function formatOptionalValue(value: string): string {
  return value || "不可用";
}

/** 格式化磁盘读写速率 */
function formatReadWriteSpeed(disk: StorageDiskSnapshot): string {
  if (disk.readSec === null || disk.writeSec === null) {
    return "不可用";
  }

  return `↓ ${formatSpeed(disk.readSec)} · ↑ ${formatSpeed(disk.writeSec)}`;
}

/** 构建单块磁盘的展示字段 */
function buildDiskRows(disk: StorageDiskSnapshot) {
  return [
    { label: "制造商", value: formatOptionalValue(disk.vendor) },
    { label: "型号/品牌", value: formatOptionalValue(disk.name) },
    { label: "容量", value: formatBytes(disk.size) },
    { label: "类型", value: formatOptionalValue(disk.type) },
    { label: "接口类型", value: formatOptionalValue(disk.interfaceType) },
    { label: "总容量", value: formatBytes(disk.total) },
    { label: "已用", value: formatBytes(disk.used) },
    { label: "读写速率", value: formatReadWriteSpeed(disk) },
  ];
}

/** 磁盘信息卡片：按物理磁盘展示指定字段 */
export function DiskCard({ snapshot }: DiskCardProps) {
  const { storageDisks } = snapshot;

  return (
    <section className="card">
      <div className="card-header">
        <h2>磁盘</h2>
      </div>

      {storageDisks.length === 0 ? (
        <p className="muted">暂无存储信息</p>
      ) : (
        <div className="stack-list">
          {storageDisks.map((disk, index) => (
            <div className="disk-item" key={`${disk.name}-${index}`}>
              {storageDisks.length > 1 ? (
                <div className="item-row">
                  <span className="item-name">
                    {disk.name || disk.vendor || `磁盘 ${index + 1}`}
                  </span>
                </div>
              ) : null}

              <dl className="kv-list compact">
                {buildDiskRows(disk).map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
