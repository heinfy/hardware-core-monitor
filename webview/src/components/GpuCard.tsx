import type { MonitorSnapshot } from "../../../src/shared/protocol";
import { formatBytes } from "../utils/format";

interface GpuCardProps {
  snapshot: MonitorSnapshot;
}

/** 格式化可选硬件字段 */
function formatOptionalValue(value: string): string {
  return value || "不可用";
}

/** 格式化显存容量展示 */
function formatVram(gpu: MonitorSnapshot["gpus"][number]): string {
  if (gpu.vram !== null) {
    return formatBytes(gpu.vram);
  }

  if (gpu.vramDynamic) {
    return "共享内存";
  }

  return "不可用";
}

/** 构建单块 GPU 的硬件信息行 */
function buildGpuHardwareRows(gpu: MonitorSnapshot["gpus"][number]) {
  return [
    { label: "型号", value: formatOptionalValue(gpu.model) },
    { label: "厂商", value: formatOptionalValue(gpu.vendor) },
    { label: "显存", value: formatVram(gpu) },
    { label: "总线", value: formatOptionalValue(gpu.bus) },
    { label: "核心数", value: formatOptionalValue(gpu.cores) },
    {
      label: "制程工艺",
      value: formatOptionalValue(gpu.processTechnology),
    },
    { label: "TDP / 功耗设计", value: formatOptionalValue(gpu.tdp) },
  ];
}

/** GPU 硬件信息卡片 */
export function GpuCard({ snapshot }: GpuCardProps) {
  const { gpus } = snapshot;

  return (
    <section className="card">
      <div className="card-header">
        <h2>显卡</h2>
      </div>

      {gpus.length === 0 ? (
        <p className="muted">当前系统无法提供 GPU 信息</p>
      ) : (
        <div className="stack-list">
          {gpus.map((gpu, index) => (
            <div className="gpu-item" key={`${gpu.model}-${index}`}>
              {gpus.length > 1 ? (
                <div className="item-row">
                  <span className="item-name">
                    {gpu.model || `显卡 #${index + 1}`}
                  </span>
                </div>
              ) : null}

              <dl className="kv-list compact">
                {buildGpuHardwareRows(gpu).map((row) => (
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
