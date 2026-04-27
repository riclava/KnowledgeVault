# KnowledgeVault

KnowledgeVault 是一个通用知识学习的 Review First Web 训练工具。V1 支持数学公式、词汇和纯文本知识项，优先验证用户是否能每天完成复习、补弱薄弱知识项，并用个人下次提示提升回忆效果。

核心学习闭环：

```text
内置知识项 -> 首次诊断 -> 今日复习 -> 反馈 -> 下次提示 -> 简单调度 -> 长期保持
```

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Prisma
- PostgreSQL
- KaTeX

## 本地启动

安装依赖：

```bash
npm install
```

复制环境变量示例，并确认 `DATABASE_URL` 指向本地 PostgreSQL：

```bash
cp .env.example .env
```

启动 PostgreSQL：

```bash
docker compose up -d postgres
```

生成 Prisma Client：

```bash
npm run prisma:generate
```

数据库启动后，执行迁移并写入通用知识项种子数据：

```bash
npm run prisma:migrate
npm run db:seed
```

启动开发服务器：

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。根路由会跳转到 `/review`，以保持 Review First 的产品结构。

## 常用命令

```bash
npm run lint
npm run test
npm run test:e2e
npm run test:all
npm run build
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
npm run db:seed
```

## 内部内容辅助

Phase 8 新增了一个内部工作台：

- 页面入口：`/content-assist`
- 草稿目录：`content-assist/drafts`
- 已审核目录：`content-assist/approved`

工作流如下：

1. 在 `/content-assist` 打开某条知识项的内容工作台。
2. 生成或刷新解释草稿、Review 题目和关系候选。
3. 人工编辑并保存草稿。
4. 点击“审核通过并写入 seed 包”。
5. 下一次执行 `npm run db:seed` 时，`content-assist/approved` 下的已审核 JSON 会自动合并进种子数据。

这条能力只用于内部内容生产，不会出现在用户侧主流程导航里。

## 项目文档

- `AGENTS.md`：给 Codex 和其他 coding agent 的项目工作说明。
- `docs/draft.md`：产品方案、V1 范围、核心流程、领域模型和 API 草案。
- `docs/tasks.md`：多阶段开发计划和验收标准。
- `docs/qa-checklist.md`：V1 Alpha 关键路径、响应式和可访问性检查清单。
- `docs/deployment.md`：Vercel 部署、生产数据库和环境变量说明。
- `docs/alpha-release.md`：V1 Alpha 发布说明和验收指标。
- `docs/demo.tsx`：交互原型参考，不作为生产代码或最终视觉规范直接照搬。

## Git 提交格式

- `feat` 添加了新特性
- `fix` 修复问题
- `style` 无逻辑改动的代码风格调整
- `perf` 性能/优化
- `refactor` 重构
- `revert` 回滚提交
- `test` 测试
- `docs` 文档
- `chore` 依赖或者脚手架调整
- `workflow` 工作流优化
- `ci` 持续集成
- `types` 类型定义
- `wip` 开发中
