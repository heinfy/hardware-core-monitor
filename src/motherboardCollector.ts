import * as si from "systeminformation";
import type { MotherboardSnapshot } from "./shared/protocol";

/** 采集主板静态硬件信息；不可用时返回 null */
export async function collectMotherboard(): Promise<MotherboardSnapshot | null> {
  try {
    const baseboard = await si.baseboard();

    if (!hasMotherboardData(baseboard)) {
      return null;
    }

    return mapMotherboard(baseboard);
  } catch (error) {
    console.warn("[Hardware Monitor] motherboard info unavailable:", error);
    return null;
  }
}

/** 判断 baseboard 是否包含可用字段 */
function hasMotherboardData(
  baseboard: si.Systeminformation.BaseboardData,
): boolean {
  return Boolean(
    baseboard.manufacturer?.trim() ||
      baseboard.model?.trim() ||
      baseboard.version?.trim(),
  );
}

/** 将 systeminformation 主板数据转为轻量快照 */
function mapMotherboard(
  baseboard: si.Systeminformation.BaseboardData,
): MotherboardSnapshot {
  return {
    manufacturer: baseboard.manufacturer || "",
    model: baseboard.model || "",
    version: baseboard.version || "",
    maxMemory:
      typeof baseboard.memMax === "number" && baseboard.memMax > 0
        ? baseboard.memMax
        : null,
    memorySlots:
      typeof baseboard.memSlots === "number" && baseboard.memSlots > 0
        ? baseboard.memSlots
        : null,
  };
}
