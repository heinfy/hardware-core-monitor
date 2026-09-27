import MagicBento, { type BentoCardProps } from "../../components/MagicBento";
import { useMonitorSnapshot } from "../../hooks/useMonitorSnapshot";
import type { MonitorSnapshot } from "../../../../src/shared/protocol";

/** 系统信息页的四张 Magic Bento 卡片 */
function buildSystemCards(snapshot: MonitorSnapshot): BentoCardProps[] {
  const system = snapshot.system;

  return [
    {
      label: "主机",
      title: system?.hostname || "不可用",
      description: "主机名",
    },
    {
      label: "系统",
      title: system ? `${system.distro} ${system.release}` : "不可用",
      description: system?.platform || "操作系统",
    },
    {
      label: "内核",
      title: system?.kernel || "不可用",
      description: "内核版本",
    },
    {
      label: "架构",
      title: system?.arch || "不可用",
      description: system?.cpuModel || "处理器架构",
    },
  ];
}

const loadingCards: BentoCardProps[] = [
  { label: "主机", title: "…", description: "正在读取主机名" },
  { label: "系统", title: "…", description: "正在读取系统" },
  { label: "内核", title: "…", description: "正在读取内核" },
  { label: "架构", title: "…", description: "正在读取架构" },
];

/** 监控 / 系统信息：用 Magic Bento 展示静态系统字段 */
export function SystemPage() {
  const { snapshot, error } = useMonitorSnapshot();
  const cards = error
    ? [{ label: "状态", title: "采集失败", description: error }]
    : snapshot
      ? buildSystemCards(snapshot)
      : loadingCards;

  return (
    <section>
      <h2>系统信息</h2>
      <MagicBento cards={cards} textAutoHide={false} />
    </section>
  );
}
