import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as si from "systeminformation";
import type {
  BluetoothControllerSnapshot,
  BluetoothDeviceSnapshot,
  BluetoothSnapshot,
} from "./shared/protocol";

const execFileAsync = promisify(execFile);

/** macOS system_profiler 较慢，降低刷新频率避免拖慢主采集循环 */
const REFRESH_INTERVAL_MS = 10_000;

let cachedSnapshot: BluetoothSnapshot = { controller: null, devices: [] };
let lastFetchedAt = 0;
let collectPromise: Promise<BluetoothSnapshot> | null = null;

/**
 * 采集蓝牙控制器硬件信息与配对设备列表。
 *
 * macOS 上通过一次 system_profiler 同时读取控制器与设备；
 * 其他平台回退到 systeminformation 的设备枚举。
 */
export async function collectBluetooth(): Promise<BluetoothSnapshot> {
  const now = Date.now();

  if (now - lastFetchedAt < REFRESH_INTERVAL_MS) {
    return cachedSnapshot;
  }

  if (collectPromise) {
    return collectPromise;
  }

  collectPromise = (async () => {
    try {
      cachedSnapshot =
        process.platform === "darwin"
          ? await collectDarwinBluetooth()
          : await collectFallbackBluetooth();
      lastFetchedAt = Date.now();
    } catch (error) {
      console.warn("[Hardware Monitor] bluetooth unavailable:", error);
    } finally {
      collectPromise = null;
    }

    return cachedSnapshot;
  })();

  return collectPromise;
}

/** 非 macOS 平台：仅采集配对设备 */
async function collectFallbackBluetooth(): Promise<BluetoothSnapshot> {
  const devices = await si.bluetoothDevices().catch(() => []);
  return {
    controller: null,
    devices: devices.map(mapSystemInformationDevice),
  };
}

/** macOS：解析 system_profiler JSON，同时提取控制器与设备 */
async function collectDarwinBluetooth(): Promise<BluetoothSnapshot> {
  const { stdout } = await execFileAsync(
    "system_profiler",
    ["SPBluetoothDataType", "-json"],
    { maxBuffer: 10 * 1024 * 1024 },
  );

  const payload = JSON.parse(stdout.toString()) as DarwinBluetoothPayload;
  const entry = payload.SPBluetoothDataType?.[0];

  if (!entry) {
    return { controller: null, devices: [] };
  }

  return {
    controller: mapDarwinController(entry.controller_properties),
    devices: collectDarwinDevices(entry),
  };
}

/** 从 macOS JSON 中提取已连接/未连接/历史配对设备 */
function collectDarwinDevices(
  entry: DarwinBluetoothEntry,
): BluetoothDeviceSnapshot[] {
  const hostAddress =
    entry.controller_properties?.controller_address
      ?.toLowerCase()
      .replace(/-/g, ":") ??
    entry.local_device_title?.general_address?.toLowerCase().replace(/-/g, ":") ??
    "";

  const devices: BluetoothDeviceSnapshot[] = [];
  const seen = new Set<string>();

  appendDarwinDevices(devices, seen, entry.device_connected, hostAddress, true);
  appendDarwinDevices(
    devices,
    seen,
    entry.device_not_connected,
    hostAddress,
    false,
  );
  appendDarwinDevices(devices, seen, entry.device_title, hostAddress, false);

  return devices;
}

/** 合并一组 macOS 设备记录，按 MAC 地址去重 */
function appendDarwinDevices(
  devices: BluetoothDeviceSnapshot[],
  seen: Set<string>,
  entries: DarwinDeviceEntry[] | undefined,
  hostAddress: string,
  connected: boolean,
): void {
  for (const entry of entries ?? []) {
    const device = mapDarwinDevice(entry, hostAddress, connected);
    const dedupeKey = device.macAddress || device.name;

    if (!dedupeKey || seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    devices.push(device);
  }
}

/** 映射 macOS 控制器属性 */
function mapDarwinController(
  properties: DarwinControllerProperties | undefined,
): BluetoothControllerSnapshot | null {
  if (!properties) {
    return null;
  }

  return {
    address: normalizeMacAddress(properties.controller_address),
    chipset: properties.controller_chipset ?? "",
    vendor: properties.controller_vendorID ?? "",
    productId: properties.controller_productID ?? "",
    firmwareVersion: properties.controller_firmwareVersion ?? "",
    transport: properties.controller_transport ?? "",
    poweredOn: parseDarwinAttrib(properties.controller_state),
    discoverable: parseDarwinAttrib(properties.controller_discoverable),
    supportedServices: properties.controller_supportedServices ?? "",
  };
}

/** 映射 macOS 单个设备条目 */
function mapDarwinDevice(
  entry: DarwinDeviceEntry,
  hostAddress: string,
  defaultConnected: boolean,
): BluetoothDeviceSnapshot {
  const deviceName = Object.keys(entry)[0] ?? "Unknown Device";
  const details = entry[deviceName] ?? {};
  const typeHint = (
    details.device_minorClassOfDevice_string ??
    details.device_majorClassOfDevice_string ??
    details.device_minorType ??
    deviceName
  ).toLowerCase();

  const connected =
    details.device_isconnected === "attrib_Yes"
      ? true
      : details.device_isconnected === "attrib_No"
        ? false
        : defaultConnected;

  return {
    name: deviceName,
    type: parseBluetoothType(typeHint),
    manufacturer:
      details.device_manufacturer ??
      parseBluetoothManufacturer(deviceName) ??
      "",
    macAddress: normalizeMacAddress(
      details.device_addr ?? details.device_address,
    ),
    connected,
    batteryPercent:
      typeof details.device_batteryPercent === "number" &&
      details.device_batteryPercent >= 0
        ? details.device_batteryPercent
        : null,
  };
}

/** 将 systeminformation 原始数据映射为轻量快照 */
function mapSystemInformationDevice(
  device: si.Systeminformation.BluetoothDeviceData,
): BluetoothDeviceSnapshot {
  return {
    name: device.name || "Unknown Device",
    type: device.type || "Unknown",
    manufacturer: device.manufacturer || "",
    macAddress: device.macDevice || "",
    connected: Boolean(device.connected),
    batteryPercent:
      typeof device.batteryPercent === "number" && device.batteryPercent >= 0
        ? device.batteryPercent
        : null,
  };
}

/** 解析 macOS attrib_on / attrib_off 等布尔标记 */
function parseDarwinAttrib(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.replace(/^attrib_/i, "").toLowerCase();
  return normalized === "on" || normalized === "yes";
}

/** 统一 MAC 地址格式 */
function normalizeMacAddress(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/-/g, ":");
}

/** 根据设备名称推断类型 */
function parseBluetoothType(value: string): string {
  if (value.includes("keyboard")) {
    return "Keyboard";
  }
  if (value.includes("mouse")) {
    return "Mouse";
  }
  if (value.includes("trackpad")) {
    return "Trackpad";
  }
  if (value.includes("headset") || value.includes("headphone")) {
    return "Headset";
  }
  if (value.includes("speaker")) {
    return "Speaker";
  }
  if (value.includes("phone")) {
    return "Phone";
  }
  if (value.includes("watch")) {
    return "Watch";
  }

  return "Unknown";
}

/** 根据设备名称推断厂商 */
function parseBluetoothManufacturer(value: string): string {
  const normalized = value.toLowerCase();

  if (
    normalized.includes("apple") ||
    normalized.includes("iphone") ||
    normalized.includes("ipad") ||
    normalized.includes("macbook") ||
    normalized.includes("imac") ||
    normalized.includes("magic mouse") ||
    normalized.includes("magic track")
  ) {
    return "Apple";
  }

  return "";
}

interface DarwinBluetoothPayload {
  SPBluetoothDataType?: DarwinBluetoothEntry[];
}

interface DarwinBluetoothEntry {
  controller_properties?: DarwinControllerProperties;
  local_device_title?: {
    general_address?: string;
  };
  device_connected?: DarwinDeviceEntry[];
  device_not_connected?: DarwinDeviceEntry[];
  device_title?: DarwinDeviceEntry[];
}

interface DarwinControllerProperties {
  controller_address?: string;
  controller_chipset?: string;
  controller_vendorID?: string;
  controller_productID?: string;
  controller_firmwareVersion?: string;
  controller_transport?: string;
  controller_state?: string;
  controller_discoverable?: string;
  controller_supportedServices?: string;
}

type DarwinDeviceEntry = Record<
  string,
  {
    device_minorClassOfDevice_string?: string;
    device_majorClassOfDevice_string?: string;
    device_minorType?: string;
    device_manufacturer?: string;
    device_addr?: string;
    device_address?: string;
    device_batteryPercent?: number;
    device_isconnected?: string;
  }
>;
