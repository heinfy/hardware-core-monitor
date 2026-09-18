module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // 新功能（feature）
        "fix", // 修复 bug
        "perf", // 性能优化
        "docs", // 文档更新
        "style", // 代码风格调整（不影响代码运行）
        "refactor", // 代码重构
        "test", // 测试相关
        "build", // 构建
        "ci", // 工程化
        "chore", // 构建过程或辅助工具变动
        "revert", // 回滚 commit
      ],
    ],
    "subject-case": [0], // 例如：禁用主题大小写检查
  },
};
