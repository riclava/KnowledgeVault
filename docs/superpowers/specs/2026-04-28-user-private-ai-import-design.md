# User Private AI Import Design

## Goal

普通用户也可以使用类似后台管理的 AI 导入能力，把教材、笔记、文章或题目整理成结构化知识项。普通用户导入的知识只对创建者本人可见，并且确认导入后立即进入该用户自己的训练队列。

## Current Context

后台已经有 AI 导入主线：`/admin/import` 使用两步流程，先生成可检查预览，再确认写入知识库。导入服务会生成知识项、变量、复习题和关系，并记录 `AdminImportRun`。

学习端目前没有知识项所有权或可见性概念。`KnowledgeItem` 是全局知识库表，学习端列表、详情、诊断、今日复习和弱项重练都按领域读取知识项或用户状态。要实现私有导入，必须在数据模型和所有学习端读取路径上明确区分公共知识和用户私有知识。

## Data Model

`KnowledgeItem` 增加两个字段：

- `visibility`: `public` 或 `private`，默认 `public`
- `createdByUserId`: 可空外键，指向创建该知识项的 `User`

公共知识项使用 `visibility = public` 且 `createdByUserId = null`。普通用户导入的知识项使用 `visibility = private` 且 `createdByUserId = currentUser.id`。

本项目仍处于开发阶段，数据库结构改动直接修改 baseline migration，不新增 migrate。seed、后台导入和后台知识项表单默认继续创建公共知识项。

## Visibility Rules

学习端可见知识项定义为：

- 公共知识项：`visibility = public`
- 当前用户自己的私有知识项：`visibility = private AND createdByUserId = currentUser.id`

所有学习端读取路径都必须使用这个规则：

- 知识项列表和领域列表
- 知识项详情
- 知识项关系
- 记忆提示草稿来源
- 诊断题选择和诊断提交校验
- 今日复习和弱项重练队列
- review item 校验和提交

其他用户的私有知识项不能被详情页、API、诊断、复习或关系查询读到。

## User-Facing Flow

主训练 shell 增加一个普通用户入口，例如“AI 导入”，页面路径为 `/import`。页面复用后台导入表单的核心交互，但文案调整为“导入到我的知识库”，避免出现后台管理语义。

普通用户导入流程：

1. 用户粘贴来源材料，可选填写标题、领域、子领域和偏好内容类型。
2. 系统调用 AI 生成结构化预览。
3. 用户检查预览。
4. 用户确认导入。
5. 系统保存为该用户私有知识项，并立即加入今日复习。

## Import Service Design

复用现有 AI 生成、schema 校验和预览能力，提取一个可配置的导入保存路径：

- 后台导入保存为公共知识项，允许更新已有公共 slug。
- 普通用户导入保存为私有知识项，不允许覆盖公共知识项或其他用户私有知识项。

普通用户保存时需要保证 slug 全局唯一。若 AI 生成的 slug 已被占用，保存层为私有知识项生成稳定后缀，例如基于用户 ID 或 import run ID 的短后缀，避免让用户被内部 slug 冲突阻断。

普通用户导入关系只允许指向本批次知识项或当前用户可见知识项。保存关系前按可见性规则解析 slug 到 ID，不能解析的关系作为校验错误返回。

## Immediate Training Behavior

确认导入成功后，对本批次每个知识项 upsert 一条 `UserKnowledgeItemState`：

- `userId = currentUser.id`
- `knowledgeItemId = importedItem.id`
- `memoryStrength = 0.05`
- `stability = 0`
- `difficultyEstimate = importedItem.difficulty`
- `nextReviewAt = now`

这样导入完成后，知识项立即出现在该用户“今日复习”中；如果用户选择对应领域，也会进入诊断和补弱相关流程。

## Admin Behavior

后台管理继续管理公共知识库。管理员导入和后台知识项表单不混入普通用户的私有内容。本次不新增“管理员查看所有私有知识”的能力，避免扩大权限面。

如果将来需要管理员审查或转公共，可以单独设计一个“私有知识审核/发布”流程。

## API Surface

新增普通用户 API：

- `POST /api/import`：普通用户预览或确认导入

该 API 使用 `withAuthenticatedApi`，不要求 admin role。请求体沿用后台两步动作：

- `{ mode: "preview", ...input }`
- `{ mode: "save", importRunId }`

后台 API `/api/admin/import` 保持 admin role 校验。

## Error Handling

普通用户导入的错误表现应与后台导入一致：

- AI 调用失败：记录失败批次，返回可读错误。
- 结构校验失败：保留预览批次和错误列表。
- 保存前可见性校验失败：返回需要重新生成或调整的错误。
- 确认导入重复提交：只允许保存仍处于预览状态且未保存的批次。

## Tests

先补失败测试再实现：

- 普通用户导入保存后创建 `private` 知识项并记录 `createdByUserId`。
- 普通用户导入成功后为当前用户创建训练状态，且 `nextReviewAt <= now`。
- 当前用户可以在列表、详情、诊断和复习查询中看到自己的私有知识项。
- 其他用户不能看到或访问该私有知识项。
- 普通用户导入不能覆盖公共知识项或其他用户私有知识项。
- 后台导入仍创建公共知识项，并保持原有预览/保存行为。

## Out of Scope

- 私有知识发布到公共知识库。
- 管理员查看、编辑或审核所有用户私有知识。
- 多人共享同一个私有知识项。
- 为历史数据做兼容迁移脚本。
