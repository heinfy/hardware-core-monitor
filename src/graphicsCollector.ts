import * as si from "systeminformation";
import type { DisplaySnapshot, GpuSnapshot } from "./shared/protocol";

/** 一次 graphics 调用同时采集 GPU 与显示器信息，避免重复请求 */
export async function collectGraphics(): Promise<{
  gpus: GpuSnapshot[];
  displays: DisplaySnapshot[];
}> {
  const graphics = await si.graphics().catch(() => ({
    controllers: [] as si.Systeminformation.GraphicsControllerData[],
    displays: [] as si.Systeminformation.GraphicsDisplayData[],
  }));

  return {
    gpus: graphics.controllers.map(mapGpuController),
    // 主屏排在前面，便于根节点摘要展示
    displays: [...graphics.displays]
      .sort((left, right) => Number(right.main) - Number(left.main))
      .map(mapDisplay),
  };
}

/** 将 graphics 控制器转为轻量 GPU 快照 */
function mapGpuController(
  controller: si.Systeminformation.GraphicsControllerData,
): GpuSnapshot {
  return {
    model: controller.model || controller.name || "Unknown GPU",
    vendor: controller.vendor,
    vram:
      typeof controller.vram === "number"
        ? megabytesToBytes(controller.vram)
        : null,
    vramDynamic: controller.vramDynamic,
    bus: controller.bus || "",
    cores: controller.cores ? String(controller.cores) : "",
    // systeminformation 暂不提供制程工艺与 TDP，保留字段供后续扩展
    processTechnology: "",
    tdp: "",
    usage:
      typeof controller.utilizationGpu === "number"
        ? controller.utilizationGpu
        : null,
  };
}

/** 将 graphics 显示器条目转为轻量显示器快照 */
function mapDisplay(
  display: si.Systeminformation.GraphicsDisplayData,
): DisplaySnapshot {
  return {
    model: display.model || "",
    vendor: display.vendor || "",
    nativeResolution: formatResolution(
      display.resolutionX ?? 0,
      display.resolutionY ?? 0,
    ),
    currentResolution: formatResolution(
      display.currentResX ?? 0,
      display.currentResY ?? 0,
    ),
    refreshRate:
      typeof display.currentRefreshRate === "number" &&
      display.currentRefreshRate > 0
        ? display.currentRefreshRate
        : null,
    pixelDepth:
      typeof display.pixelDepth === "number" && display.pixelDepth > 0
        ? display.pixelDepth
        : null,
    physicalSize: formatPhysicalSize(display.sizeX, display.sizeY),
  };
}

/** 拼接分辨率文本，例如 1920×1080 */
function formatResolution(width: number, height: number): string {
  if (width > 0 && height > 0) {
    return `${width}×${height}`;
  }

  return "";
}

/** 拼接物理尺寸，例如 60.96×34.29 cm */
function formatPhysicalSize(sizeX: number | null, sizeY: number | null): string {
  if (
    typeof sizeX === "number" &&
    sizeX > 0 &&
    typeof sizeY === "number" &&
    sizeY > 0
  ) {
    return `${sizeX.toFixed(2)}×${sizeY.toFixed(2)} cm`;
  }

  return "";
}

/** systeminformation 返回的显存单位为 MB，统一转为字节 */
function megabytesToBytes(megabytes: number): number {
  return Math.round(megabytes * 1024 * 1024);
}
