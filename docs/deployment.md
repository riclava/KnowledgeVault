# 部署说明

KnowledgeVault V1 Alpha 推荐部署到 Vercel，数据库使用任意兼容 PostgreSQL 的托管服务。

## 必需环境变量

- `DATABASE_URL`：PostgreSQL 连接串，Prisma 和应用 API 都依赖它。
- `NEXT_PUBLIC_APP_URL`：生产站点 URL，例如 `https://knowledgevault.example.com`。
- `BETTER_AUTH_SECRET`：Better Auth 使用的签名密钥，生产环境必须使用高熵随机值。
- `BETTER_AUTH_URL`：Better Auth 对外可访问的完整站点地址，通常与 `NEXT_PUBLIC_APP_URL` 一致。

## Vercel 配置

仓库根目录已包含 `vercel.json`，指定：

- Framework：Next.js
- Install Command：`npm install`
- Build Command：`npm run build`

部署前在 Vercel Project Settings 中至少配置：

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`

## 数据库上线步骤

1. 创建生产 PostgreSQL 数据库。
2. 在 Vercel 配置 `DATABASE_URL`。
3. 本地或 CI 执行迁移：

```bash
npm run prisma:migrate
```

4. 写入 Alpha 种子内容：

```bash
npm run db:seed
```

`db:seed` 会重置并写入代码内维护的内置知识项种子数据。

## 发布前检查

```bash
npm run test:all
npm run test:e2e
```

`test:e2e` 需要先启动服务并设置：

```bash
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

如果没有设置 `E2E_BASE_URL`，端到端测试会自动跳过。

## 账号系统说明

- 账号系统使用邮箱 + 密码模式。
- 未登录用户可以在首页或账号页直接登录，也可以在同一表单内注册新账号。
- 密码认证由 Better Auth 处理，生产环境必须配置 `BETTER_AUTH_SECRET` 与 `BETTER_AUTH_URL`。

## 开发期数据库工作流

当前项目仍处在开发迭代期，推荐把数据库工作流区分成两类：

- 日常改 schema：`npm run db:push`
- 需要清空本地数据并重新 seed：`npm run db:reset`
- 想把历史 migration 重新压成一条开发基线：`npm run db:baseline`

说明：

- `db:push` 适合开发期频繁改字段、索引和关系，不会额外叠很多 migration 文件。
- `db:reset` 会清空本地开发数据库，然后重新应用当前基线 migration 并执行 seed。
- `db:baseline` 会删除现有 `prisma/migrations`，基于当前 `schema.prisma` 重新生成一条新的开发基线 migration，然后 reset 并 seed 本地数据库。

注意：

- `db:reset` 和 `db:baseline` 都会删除当前本地开发数据。
- 准备接入共享环境、staging 或 production 前，应停止依赖 `db:push`，恢复正式 migration 节奏。
