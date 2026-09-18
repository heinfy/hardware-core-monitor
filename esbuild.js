const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/**
 * esbuild 问题匹配器：把构建错误格式化成 VSCode Problem Matcher 可识别的输出。
 * @type {import("esbuild").Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",

  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });

    build.onEnd((result) => {
      for (const { text, location } of result.errors) {
        console.error(`✘ [ERROR] ${text}`);
        console.error(`${location.file}:${location.line}:${location.column}:`);
      }
      console.log("[watch] build finished");
    });
  },
};

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ["src/extension.ts"],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    target: "ES2022",
    outfile: "out/extension.js",

    // vscode 由扩展宿主提供；systeminformation 含平台相关动态加载，作为外部依赖打进 VSIX
    external: ["vscode", "systeminformation"],
    logLevel: "silent",
    plugins: [esbuildProblemMatcherPlugin],
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
