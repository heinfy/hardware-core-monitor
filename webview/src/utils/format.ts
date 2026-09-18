/** 字节数转人类可读文本 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );

  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
}

/** 每秒字节数转网速文本 */
export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) {
    return `${bytesPerSecond.toFixed(0)} B/s`;
  }

  if (bytesPerSecond < 1024 * 1024) {
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  }

  return `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`;
}

/** 0-100 数值的安全显示 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
