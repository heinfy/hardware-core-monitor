import ElectricLogo from "@/components/ElectricLogo";

/** 一级主页面：默认入口，用来放监控之外的内容 */
export function HomePage() {
  return (
    <section className="card home-page">
      {/* 舞台固定深色，电弧在亮色编辑器主题下也保持对比 */}
      <div className="home-logo">
        <ElectricLogo />
      </div>
    </section>
  );
}
