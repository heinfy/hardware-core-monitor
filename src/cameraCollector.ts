import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { getRefreshIntervalMs } from "./refreshIntervalConfig";
import type { CameraSnapshot } from "./shared/protocol";

const execFileAsync = promisify(execFile);

let cachedCameras: CameraSnapshot[] = [];
let lastFetchedAt = 0;
let collectPromise: Promise<CameraSnapshot[]> | null = null;

/**
 * 采集摄像头硬件信息，包含内置与外接设备。
 *
 * macOS 使用 system_profiler；Linux 优先 v4l2-ctl；Windows 使用 WMI。
 */
export async function collectCameras(): Promise<CameraSnapshot[]> {
  const now = Date.now();

  if (now - lastFetchedAt < getRefreshIntervalMs()) {
    return cachedCameras;
  }

  if (collectPromise) {
    return collectPromise;
  }

  collectPromise = (async () => {
    try {
      if (process.platform === "darwin") {
        cachedCameras = await collectDarwinCameras();
      } else if (process.platform === "linux") {
        cachedCameras = await collectLinuxCameras();
      } else if (process.platform === "win32") {
        cachedCameras = await collectWindowsCameras();
      } else {
        cachedCameras = [];
      }

      cachedCameras = sortCameras(cachedCameras);
      lastFetchedAt = Date.now();
    } catch (error) {
      console.warn("[Hardware Monitor] camera unavailable:", error);
    } finally {
      collectPromise = null;
    }

    return cachedCameras;
  })();

  return collectPromise;
}

/** macOS：解析 system_profiler 摄像头 JSON */
async function collectDarwinCameras(): Promise<CameraSnapshot[]> {
  const { stdout } = await execFileAsync(
    "system_profiler",
    ["SPCameraDataType", "-json"],
    {
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  const payload = JSON.parse(stdout.toString()) as DarwinCameraPayload;
  const entries = payload.SPCameraDataType ?? [];

  return entries.map((entry) => {
    const model = entry["spcamera_model-id"] || entry._name || "";
    const name = entry._name || model;

    return {
      model,
      vendor: inferCameraVendor(name, model),
      maxResolution: "",
      frameRate: null,
    };
  });
}

/** Linux：优先 v4l2-ctl，回退到 sysfs 设备名 */
async function collectLinuxCameras(): Promise<CameraSnapshot[]> {
  try {
    return await collectLinuxCamerasFromV4l2();
  } catch {
    return collectLinuxCamerasFromSysfs();
  }
}

/** Linux：通过 v4l2-ctl 读取摄像头名称、分辨率与帧率 */
async function collectLinuxCamerasFromV4l2(): Promise<CameraSnapshot[]> {
  const { stdout: listOutput } = await execFileAsync(
    "v4l2-ctl",
    ["--list-devices"],
    { maxBuffer: 10 * 1024 * 1024 },
  );

  const groups = parseV4l2DeviceGroups(listOutput.toString());
  const cameras: CameraSnapshot[] = [];

  for (const group of groups) {
    const devicePath = group.devicePaths[0];

    if (!devicePath) {
      continue;
    }

    const { stdout: formatOutput } = await execFileAsync(
      "v4l2-ctl",
      ["-d", devicePath, "--list-formats-ext"],
      {
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    const { maxResolution, frameRate } = parseV4l2Formats(
      formatOutput.toString(),
    );

    cameras.push({
      model: group.name,
      vendor: inferCameraVendor(group.name, group.busInfo),
      maxResolution,
      frameRate,
    });
  }

  return cameras;
}

/** Linux：从 /sys/class/video4linux 读取设备名 */
async function collectLinuxCamerasFromSysfs(): Promise<CameraSnapshot[]> {
  const basePath = "/sys/class/video4linux";
  let entries: string[];

  try {
    entries = await readdir(basePath);
  } catch {
    return [];
  }

  const cameras: CameraSnapshot[] = [];

  for (const entry of entries.sort()) {
    if (!entry.startsWith("video")) {
      continue;
    }

    let name = entry;

    try {
      name = (await readFile(`${basePath}/${entry}/name`, "utf8")).trim();
    } catch {
      // 读取失败时保留 video 节点名
    }

    cameras.push({
      model: name,
      vendor: inferCameraVendor(name, ""),
      maxResolution: "",
      frameRate: null,
    });
  }

  return dedupeCameras(cameras);
}

/** Windows：通过 WMI 枚举 Camera 类设备 */
async function collectWindowsCameras(): Promise<CameraSnapshot[]> {
  const script =
    "Get-CimInstance Win32_PnPEntity | Where-Object { $_.PNPClass -eq 'Camera' } | Select-Object Name, Manufacturer, DeviceID | ConvertTo-Json -Compress";

  const { stdout } = await execFileAsync(
    "powershell",
    ["-NoProfile", "-Command", script],
    {
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  const payload = stdout.toString().trim();

  if (!payload) {
    return [];
  }

  const parsed = JSON.parse(payload) as
    WindowsCameraRecord | WindowsCameraRecord[];
  const records = Array.isArray(parsed) ? parsed : [parsed];

  return records.map((record) => ({
    model: record.Name || "",
    vendor: record.Manufacturer || "",
    maxResolution: "",
    frameRate: null,
  }));
}

/** 解析 v4l2-ctl --list-devices 输出 */
function parseV4l2DeviceGroups(output: string): V4l2DeviceGroup[] {
  const groups: V4l2DeviceGroup[] = [];
  let current: V4l2DeviceGroup | null = null;

  for (const rawLine of output.split("\n")) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      current = null;
      continue;
    }

    if (!line.startsWith("\t") && !line.startsWith(" ")) {
      const match = /^(.+?)(?:\s+\((.+)\))?:?$/.exec(line.trim());

      current = {
        name: match?.[1]?.trim() || line.trim(),
        busInfo: match?.[2]?.trim() || "",
        devicePaths: [],
      };
      groups.push(current);
      continue;
    }

    const devicePath = line.trim();

    if (current && devicePath.startsWith("/dev/video")) {
      current.devicePaths.push(devicePath);
    }
  }

  return groups;
}

/** 从 v4l2 格式列表中提取最大分辨率与对应帧率 */
function parseV4l2Formats(output: string): {
  maxResolution: string;
  frameRate: number | null;
} {
  let maxPixels = 0;
  let maxResolution = "";
  let frameRate: number | null = null;

  for (const line of output.split("\n")) {
    const sizeMatch = /Size:\s*Discrete\s+(\d+)x(\d+)/i.exec(line);

    if (sizeMatch) {
      const width = Number.parseInt(sizeMatch[1] ?? "0", 10);
      const height = Number.parseInt(sizeMatch[2] ?? "0", 10);
      const pixels = width * height;

      if (pixels > maxPixels) {
        maxPixels = pixels;
        maxResolution = `${width}×${height}`;
      }

      continue;
    }

    const fpsMatch =
      /Interval:\s*Discrete\s+[\d.]+s\s+\(([\d.]+)\s*fps\)/i.exec(line);

    if (fpsMatch && maxPixels > 0) {
      const fps = Number.parseFloat(fpsMatch[1] ?? "0");

      if (fps > 0) {
        frameRate = frameRate === null ? fps : Math.max(frameRate, fps);
      }
    }
  }

  return { maxResolution, frameRate };
}

/** 内置摄像头排在前面 */
function sortCameras(cameras: CameraSnapshot[]): CameraSnapshot[] {
  return [...cameras].sort((left, right) => {
    const leftBuiltin = isBuiltinCamera(left) ? 0 : 1;
    const rightBuiltin = isBuiltinCamera(right) ? 0 : 1;

    return leftBuiltin - rightBuiltin;
  });
}

/** 按型号 + 厂商去重 */
function dedupeCameras(cameras: CameraSnapshot[]): CameraSnapshot[] {
  const seen = new Set<string>();

  return cameras.filter((camera) => {
    const key = `${camera.model}|${camera.vendor}`;

    if (!key.trim() || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

/** 根据名称推断摄像头厂商 */
function inferCameraVendor(name: string, hint: string): string {
  const combined = `${name} ${hint}`.toLowerCase();

  if (
    combined.includes("apple") ||
    combined.includes("facetime") ||
    combined.includes("iphone")
  ) {
    return "Apple";
  }

  if (combined.includes("logitech")) {
    return "Logitech";
  }

  if (combined.includes("microsoft")) {
    return "Microsoft";
  }

  if (combined.includes("razer")) {
    return "Razer";
  }

  if (combined.includes("hp") || combined.includes("hewlett")) {
    return "HP";
  }

  if (combined.includes("dell")) {
    return "Dell";
  }

  if (combined.includes("lenovo")) {
    return "Lenovo";
  }

  return "";
}

/** 是否为内置摄像头，用于排序 */
function isBuiltinCamera(camera: CameraSnapshot): boolean {
  const combined = `${camera.model} ${camera.vendor}`.toLowerCase();

  return (
    combined.includes("facetime") ||
    combined.includes("built-in") ||
    combined.includes("builtin") ||
    combined.includes("integrated") ||
    combined.includes("internal")
  );
}

interface DarwinCameraPayload {
  SPCameraDataType?: DarwinCameraEntry[];
}

interface DarwinCameraEntry {
  _name?: string;
  "spcamera_model-id"?: string;
  "spcamera_unique-id"?: string;
}

interface V4l2DeviceGroup {
  name: string;
  busInfo: string;
  devicePaths: string[];
}

interface WindowsCameraRecord {
  Name?: string;
  Manufacturer?: string;
  DeviceID?: string;
}
