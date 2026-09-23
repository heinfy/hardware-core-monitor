import type { MonitorSnapshot } from "../../../src/shared/protocol";

interface BluetoothCardProps {
  snapshot: MonitorSnapshot;
}

/** 从 vendorID 字符串中提取可读厂商名 */
function extractVendorName(vendor: string): string {
  const match = vendor.match(/\(([^)]+)\)/);
  return match?.[1]?.trim() || vendor.trim();
}

/** 蓝牙控制器与配对设备卡片 */
export function BluetoothCard({ snapshot }: BluetoothCardProps) {
  const { controller, devices } = snapshot.bluetooth;

  // 已连接设备优先展示
  const bluetoothDevices = [...devices].sort((left, right) => {
    if (left.connected !== right.connected) {
      return left.connected ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });

  const hasBluetoothInfo = controller !== null || bluetoothDevices.length > 0;

  return (
    <section className="card">
      <div className="card-header">
        <h2>蓝牙</h2>
        <span className="badge badge-normal">
          {bluetoothDevices.length > 0
            ? bluetoothDevices.length
            : controller
              ? 1
              : 0}
        </span>
      </div>

      {!hasBluetoothInfo ? (
        <p className="muted">当前系统无法提供蓝牙信息</p>
      ) : (
        <div className="stack-list">
          {controller ? (
            <div className="gpu-item">
              <div className="item-row">
                <span className="item-name">蓝牙适配器</span>
                <span className="muted">
                  {controller.poweredOn ? "已开启" : "已关闭"}
                </span>
              </div>

              <dl className="kv-list compact">
                {controller.vendor ? (
                  <div>
                    <dt>厂商</dt>
                    <dd>{extractVendorName(controller.vendor)}</dd>
                  </div>
                ) : null}
                {controller.chipset ? (
                  <div>
                    <dt>芯片型号</dt>
                    <dd>{controller.chipset}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>可被发现</dt>
                  <dd>{controller.discoverable ? "是" : "否"}</dd>
                </div>
              </dl>
            </div>
          ) : null}

          {bluetoothDevices.length === 0 ? (
            <p className="muted">无已配对设备</p>
          ) : (
            bluetoothDevices.map((device) => (
              <div
                className="gpu-item"
                key={device.macAddress || device.name}
              >
                <div className="item-row">
                  <span className="item-name">{device.name}</span>
                  <span
                    className={
                      device.connected ? "badge badge-normal" : "muted"
                    }
                  >
                    {device.connected ? "已连接" : "未连接"}
                  </span>
                </div>

                <dl className="kv-list compact">
                  <div>
                    <dt>类型</dt>
                    <dd>{device.type}</dd>
                  </div>
                  {device.manufacturer ? (
                    <div>
                      <dt>制造商</dt>
                      <dd>{device.manufacturer}</dd>
                    </div>
                  ) : null}
                  {device.macAddress ? (
                    <div>
                      <dt>MAC 地址</dt>
                      <dd>{device.macAddress}</dd>
                    </div>
                  ) : null}
                  {device.batteryPercent !== null ? (
                    <div>
                      <dt>电量</dt>
                      <dd>{device.batteryPercent.toFixed(0)}%</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
