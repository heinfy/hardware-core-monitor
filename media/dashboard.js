// 基本的仪表盘更新逻辑
window.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type === "update") {
    updateDashboard(message.data);
  }
});

function updateDashboard(data) {
  if (!data) {
    return;
  }

  // 更新 CPU
  const cpuProgress = document.getElementById("cpu-progress");
  const cpuText = document.getElementById("cpu-text");
  if (cpuProgress && cpuText) {
    const usage = data.cpu.usage;
    cpuProgress.style.width = `${usage}%`;
    cpuText.textContent = `${usage.toFixed(1)}%`;
  }

  // 更新内存
  const memoryProgress = document.getElementById("memory-progress");
  const memoryText = document.getElementById("memory-text");
  if (memoryProgress && memoryText) {
    const usage = (data.memory.used / data.memory.total) * 100;
    memoryProgress.style.width = `${usage}%`;
    memoryText.textContent = `${usage.toFixed(1)}%`;
  }

  // 更新温度
  const temperature = document.getElementById("temperature");
  if (temperature) {
    temperature.textContent = `${data.temperature}°C`;
  }
}
