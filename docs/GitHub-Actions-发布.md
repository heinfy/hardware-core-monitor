# GitHub Actions 发布流程

## 1. 概述

项目使用两个 GitHub Actions Workflow 完成自动版本发布和 VS Code 扩展发布：

- `.github/workflows/CREATE_TAG.yml`：分析提交记录，生成新版本、Tag、CHANGELOG 和 GitHub Release。
- `.github/workflows/RELEASE_VSCODE_EXTENSION.yml`：在指定 Tag 上打包 VSIX，并发布到 GitHub Releases 和 VS Code Marketplace。

完整自动发布链路如下：

```text
推送或合并到 main
        ↓
CREATE_TAG.yml
        ↓
semantic-release 分析提交
        ↓
更新 package.json 和 CHANGELOG.md
        ↓
创建 vX.Y.Z Tag 和 GitHub Release
        ↓
以新 Tag 为 ref 自动调度 RELEASE_VSCODE_EXTENSION.yml
        ↓
构建 VSIX
        ↓
上传 GitHub Release + 发布 VS Code Marketplace + 保存 Artifact
```

## 2. 版本与 Tag 工作流

工作流文件：`.github/workflows/CREATE_TAG.yml`

### 2.1 触发条件

当有提交推送到 `main` 分支时触发，包括：

- 直接 push 到 `main`。
- Pull Request 合并到 `main`。

如果当前 head commit 的提交信息包含 `skip ci`，则不执行发布 Job。semantic-release 自动生成的版本提交会包含 `[skip ci]`，以避免再次进入发布流程。

### 2.2 `dev` 合并到 `main` 是否会自动增加版本号

将 `dev` 分支合并到 `main` 会产生一次针对 `main` 的 push，因此会触发 `CREATE_TAG.yml`。但是，触发工作流只代表系统会检查是否需要发布，并不代表每次合并都会增加版本号。

semantic-release 会分析上一个版本 Tag 之后进入 `main` 的提交信息，并根据 Conventional Commits 规则决定是否升版：

- `fix:` 或 `perf:`：增加 Patch 版本，例如 `1.0.0 → 1.0.1`。
- `feat:`：增加 Minor 版本，例如 `1.0.0 → 1.1.0`。
- 包含 `BREAKING CHANGE`，或使用 `feat!:`、`fix!:` 等破坏性变更标记：增加 Major 版本，例如 `1.0.0 → 2.0.0`。
- `docs:`、`style:`、`refactor:`、`test:`、`build:`、`ci:`、`chore:` 等提交默认通常不会产生新版本。
- `Change page title...`、`Update dependencies...` 等不符合 Conventional Commits 格式的普通提交，通常也不会产生新版本。

因此，发布行为可以概括为：

```text
dev 合并到 main
        ↓
触发 CREATE_TAG.yml
        ↓
分析上一个版本之后的提交
        ↓
存在 feat / fix / perf / BREAKING CHANGE？
        ├─ 是：自动更新版本号并发布
        └─ 否：工作流正常结束，版本号保持不变
```

合并方式也会影响提交信息：

- 使用普通 Merge Commit 时，semantic-release 会分析合并后进入 `main` 的相关提交，不能只依赖默认的 `Merge pull request ...` 合并信息。
- 使用 Squash Merge 时，应确保 PR 标题或最终 Squash Commit 使用 `feat: ...`、`fix: ...` 等规范格式。
- 推荐提交信息示例：`feat: add GPU monitoring`、`fix: correct memory usage calculation`。

截至 2026 年 9 月 18 日，本地仓库中 `package.json` 的版本为 `1.0.0`，最新 Git Tag 为 `v1.0.0`。最近一次 `dev` 合并到 `main` 后没有生成更高版本，是因为合并后的新增提交没有包含默认会触发发布的 `feat:`、`fix:`、`perf:` 或破坏性变更标记。

判断项目正式版本时，应以目标提交中的 `package.json` 版本和对应 Git Tag 为准。仓库目录中已有的 `.vsix` 文件名可能来自历史构建或手动打包；例如文件名包含 `1.0.6`，并不表示当前源码版本已经是 `1.0.6`。

### 2.3 执行环境与权限

- Runner：`ubuntu-24.04`
- Node.js：`22.x`
- pnpm：从根目录 `package.json` 的 `packageManager` 字段读取。
- `actions: write`：允许调度扩展发布工作流。
- `contents: write`：允许更新文件、创建 Tag 和 GitHub Release。
- `issues: write` 和 `pull-requests: write`：供 semantic-release 的 GitHub 插件使用。

### 2.4 执行步骤

1. 拉取完整 Git 历史和所有 Tag。

   semantic-release 需要根据历史 Tag 和提交记录计算下一个版本，因此 `fetch-depth` 设置为 `0`。

2. 安装 pnpm 并配置 Node.js 22。

3. 执行依赖安装：

   ```bash
   pnpm install --frozen-lockfile
   ```

4. 执行 semantic-release：

   ```bash
   pnpm exec semantic-release --debug
   ```

5. semantic-release 根据 Conventional Commits 判断是否发布新版本。默认规则为：

   - `fix:` 通常生成 Patch 版本，例如 `1.0.0 → 1.0.1`。
   - `feat:` 通常生成 Minor 版本，例如 `1.0.0 → 1.1.0`。
   - `BREAKING CHANGE` 或破坏性变更通常生成 Major 版本，例如 `1.0.0 → 2.0.0`。
   - 如果没有需要发布的提交类型，不会生成新版本。

6. 有新版本时，`.releaserc.json` 中的插件依次完成：

   - 分析提交记录。
   - 生成 Release Notes。
   - 更新 `CHANGELOG.md`。
   - 更新 `package.json` 版本，但不发布 npm 包，因为 `npmPublish` 为 `false`。
   - 创建格式为 `vX.Y.Z` 的 Git Tag。
   - 创建 GitHub Release。
   - 提交 `package.json` 和 `CHANGELOG.md`，提交信息为 `chore(release): X.Y.Z [skip ci]`。

7. 工作流从 semantic-release 输出中提取并记录：

   - `new_release_published`：是否生成了新版本。
   - `new_release_version`：新版本号，例如 `1.2.3`。
   - `current_tag`：新 Tag，例如 `v1.2.3`。
   - `previous_tag`：上一个版本 Tag。
   - `changelog_preview`：新版本 CHANGELOG 的前几行预览。

8. 如果 `new_release_published` 为 `true`，自动执行：

   ```bash
   gh workflow run RELEASE_VSCODE_EXTENSION.yml --ref "vX.Y.Z"
   ```

   该命令会以新创建的 Tag 作为 Git ref，通过 `workflow_dispatch` 调度 VS Code 扩展发布工作流。

### 2.5 为什么需要主动调度

semantic-release 使用 GitHub Actions 自动生成的 `GITHUB_TOKEN` 创建 Tag。该 Token 产生的 Tag push 事件默认不会再触发另一个 Workflow。

因此，新版本发布成功后，`CREATE_TAG.yml` 会显式调度 `RELEASE_VSCODE_EXTENSION.yml`，从而完成自动发布链路。

## 3. VS Code 扩展发布工作流

工作流文件：`.github/workflows/RELEASE_VSCODE_EXTENSION.yml`

### 3.1 触发方式

该工作流支持三种进入方式。

#### 方式一：版本工作流自动调度

`CREATE_TAG.yml` 创建新 Tag 后，会以该 Tag 为 ref 自动调度本工作流。这是正常发布时的主要入口。

#### 方式二：推送版本 Tag

当用户或其他凭证推送符合以下格式的 Tag 时触发：

```text
v*.*.*
```

例如：

```text
v1.0.0
v1.2.3
v2.0.0
```

#### 方式三：GitHub Actions 页面手动执行

1. 进入仓库的 **Actions** 页面。
2. 选择 **Release VScode Extension**。
3. 点击 **Run workflow**。
4. 在 **Use workflow from** 中选择需要发布的 Tag，例如 `v1.2.3`。
5. 确认执行。

手动执行时必须选择 Tag。如果选择 `main` 或其他分支，工作流会在 Tag 检查步骤中主动失败。

### 3.2 执行环境与权限

- Runner：`ubuntu-24.04`
- Node.js：`22.x`
- `contents: write`：允许向 GitHub Release 上传 VSIX 文件。
- Marketplace 发布使用仓库 Secret `VSCODE_MARKETPLACE_TOKEN`。

### 3.3 执行步骤

1. 检查当前 Git ref 是否以 `refs/tags/` 开头。

   - Tag ref：继续执行。
   - Branch ref：输出错误并终止工作流。

2. 拉取 Tag 对应的代码。

   - `fetch-depth: 1`，打包时不需要完整 Git 历史。
   - `persist-credentials: false`，拉取后不在本地 Git 配置中保留 `GITHUB_TOKEN`。

3. 安装 pnpm 并配置 Node.js 22。

4. 从 Tag 中的根目录 `package.json` 读取：

   - 扩展包名。
   - 扩展版本号。
   - 当前 Tag 名。

5. 安装依赖：

   ```bash
   pnpm install --frozen-lockfile
   ```

6. 打包 VSIX：

   ```bash
   pnpm dlx @vscode/vsce package
   ```

   `vsce package` 会自动调用 `package.json` 中的 `vscode:prepublish`，然后执行 `pnpm run package`，具体包括：

   ```text
   TypeScript 类型检查
   → webview 类型检查
   → webview2 类型检查
   → 构建 webview
   → 构建 webview2
   → esbuild 生产模式打包扩展主进程
   ```

7. 检查 VSIX 文件是否存在。预期文件名格式为：

   ```text
   <package-name>-<package-version>.vsix
   ```

8. 将 VSIX 上传到当前 Tag 对应的 GitHub Release。如果已有同名资产，则覆盖它。

9. 使用 `VSCODE_MARKETPLACE_TOKEN` 将 VSIX 发布到 VS Code Marketplace。

10. 将 VSIX 作为 GitHub Actions Artifact 保存，Artifact 名称格式为：

    ```text
    <package-name>-<package-version>
    ```

## 4. 发布产物

一次完整的新版本发布会产生：

- 更新后的 `package.json`。
- 更新后的 `CHANGELOG.md`。
- 一个 `chore(release): X.Y.Z [skip ci]` Git 提交。
- 一个 `vX.Y.Z` Git Tag。
- 一个 GitHub Release。
- 一个上传到 GitHub Release 的 VSIX 文件。
- 一个发布到 VS Code Marketplace 的扩展版本。
- 一个可从 GitHub Actions 下载的 VSIX Artifact。

## 5. 必要配置

### 5.1 GitHub Actions 权限

`CREATE_TAG.yml` 需要以下写权限：

```yaml
permissions:
  actions: write
  contents: write
  issues: write
  pull-requests: write
```

`RELEASE_VSCODE_EXTENSION.yml` 需要：

```yaml
permissions:
  contents: write
```

### 5.2 VS Code Marketplace Token

仓库需要配置以下 Actions Secret：

```text
VSCODE_MARKETPLACE_TOKEN
```

该 Secret 用于将 VSIX 发布到 VS Code Marketplace。如果 Token 缺失、失效或权限不足，GitHub Release 资产可能已上传，但 Marketplace 发布步骤会失败。

## 6. 不会发布新版本的情况

- push 的目标分支不是 `main`。
- head commit 信息包含 `skip ci`。
- semantic-release 没有找到会触发新版本的提交。
- 手动运行扩展发布 Workflow 时选择了分支而不是 Tag。
- 直接推送的 Tag 不匹配 `v*.*.*`。

## 7. 失败处理

- 依赖安装、semantic-release 或认证失败时，版本工作流会直接失败。
- semantic-release 成功执行但没有需要发布的提交时，工作流正常结束，不会调度扩展发布。
- 无法从 semantic-release 日志中提取版本号时，版本工作流会失败。
- 手动运行时选择了 Branch，扩展发布工作流会在第一阶段失败。
- VSIX 打包完成后找不到预期文件时，发布会终止。
- GitHub Release 上传或 Marketplace 发布任一步失败，工作流会标记为失败。

## 8. 注意事项

- 手动推送 Tag 前，应确保 Tag 中 `package.json` 的 `version` 与 Tag 版本一致。当前 Workflow 会检查引用是否为 Tag，但不会比较 Tag 名与 `package.json` 版本。
- 重复手动发布相同版本时，GitHub Release 中的 VSIX 会被覆盖，但 VS Code Marketplace 可能拒绝已存在的版本号。
- 为保证自动版本升级符合预期，建议所有合并到 `main` 的提交遵循 Conventional Commits 规范。
