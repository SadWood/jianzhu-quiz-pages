# 建筑题库答题站

基于 Vue 3 + Pinia + Vite + Bun 的静态题库练习站点，支持章节刷题、关键词检索、错题重练和进度持久化。

## 功能特性

- 学科/章节筛选
- 题干与选项关键词搜索
- 顺序练习与随机练习
- 错题本模式（只刷错题）
- 提交判题、正确率与进度统计
- 本地持久化（`localStorage`）

## 技术栈

- Vue 3（`<script setup>`）
- Pinia
- Vite
- Tailwind CSS v4
- Bun（脚本与包管理）

## 目录说明

```text
.
├─ src/                    # 前端源码
├─ public/
│  ├─ data/                # 题库构建结果（JSON）
│  └─ output/              # 题图静态资源（构建时生成/复制）
├─ scripts/
│  └─ build-bank.mjs       # 题库数据构建脚本
└─ .github/workflows/
   └─ deploy-pages.yml     # GitHub Pages 部署流程
```

## 环境要求

- Bun >= 1.3.6

## 本地开发

```bash
bun install
bun run dev
```

## 构建命令

```bash
# 仅构建题库数据
bun run build:data

# 构建完整站点（题库 + 前端）
bun run build
```

### 指定 output 路径

```bash
bun scripts/build-bank.mjs ../output
# 或
bun scripts/build-bank.mjs --output ../output
```

## 关于 output 目录与 CI

项目默认从仓库根目录 `output/` 读取 OCR 结果。由于该目录体积较大，通常不会提交到 Git。

当前构建脚本行为如下：

- 默认 `output/` 存在：重建 `public/data/*.json`，并按需复制题图到 `public/output/`
- 默认 `output/` 不存在但 `public/data` 已存在：跳过重建，直接继续前端构建（适合 CI）
- 手动传入 `--output` 但路径不存在：构建失败并提示正确用法

这保证了在 GitHub Actions 中即使没有 `output/`，只要仓库内已有 `public/data`，也能正常发布站点。

## GitHub Pages 部署

已配置工作流文件：`.github/workflows/deploy-pages.yml`

- 触发条件：推送到 `main` 或 `master`
- 流程：安装 Bun -> `bun install --frozen-lockfile` -> `bun run build` -> 上传 `dist` -> 发布 Pages

## 常见问题

### 1) CI 报错“未找到可用 output 目录”

请确认仓库中已提交以下文件：

- `public/data/question-bank.json`
- `public/data/chapter-index.json`

若需要在 CI 中实时重建题库，则需额外提供可访问的 `output` 数据来源，并在构建时传入 `--output` 路径。

### 2) 某些题目没有“查看题图”

题图按钮只在题目命中图题关键词或选项为空时显示；且源图片存在时才可展示。
