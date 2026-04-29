import { notFound } from "next/navigation";
import Link from "next/link";

import { KnowledgeItemRenderer } from "@/components/knowledge-item/renderers/knowledge-item-renderer";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { normalizeRouteParam } from "@/lib/route-params";
import { getAdminKnowledgeItem } from "@/server/admin/admin-knowledge-item-service";
import type {
  KnowledgeItemRenderPayloadByType,
  KnowledgeItemType,
} from "@/types/knowledge-item";

type AdminKnowledgeItemDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminKnowledgeItemDetailPage({
  params,
}: AdminKnowledgeItemDetailPageProps) {
  const { id: rawId } = await params;
  const item = await getAdminKnowledgeItem(normalizeRouteParam(rawId));

  if (!item) {
    notFound();
  }

  return (
    <div className="grid max-w-7xl gap-5">
      <header className="flex flex-col gap-3 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{item.domain}</Badge>
            {item.subdomain ? <Badge variant="secondary">{item.subdomain}</Badge> : null}
            <Badge variant="outline">{contentTypeLabel(item.contentType)}</Badge>
            <Badge variant={item.visibility === "private" ? "secondary" : "outline"}>
              {item.visibility === "private" ? "私有" : "公共"}
            </Badge>
          </div>
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">知识项详情</h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {item.title} · {item.slug}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/knowledge-items"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            返回知识项
          </Link>
          <Link
            href={`/admin/knowledge-items/${item.id}/edit`}
            className={buttonVariants({ size: "sm" })}
          >
            编辑
          </Link>
        </div>
      </header>

      <section className="grid gap-4 rounded-lg border bg-background p-5">
        <div className="grid gap-2">
          <h2 className="text-lg font-semibold">内容预览</h2>
          <p className="text-sm leading-6 text-muted-foreground">{item.summary}</p>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-muted/20 p-4">
          <KnowledgeItemRenderer
            contentType={item.contentType}
            payload={item.renderPayload as KnowledgeItemRenderPayloadByType[KnowledgeItemType]}
            block
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 gap-5">
          <AdminDetailSection title="知识项含义">
            <div className="grid gap-3 text-sm leading-7 text-muted-foreground">
              <p>{item.body}</p>
              {item.intuition ? <p>{item.intuition}</p> : null}
              {item.deepDive ? <p>{item.deepDive}</p> : null}
            </div>
          </AdminDetailSection>

          <AdminDetailSection title="适用边界">
            <div className="grid gap-4 md:grid-cols-2">
              <TextList title="什么时候用" items={item.useConditions} />
              <TextList title="什么时候不能用" items={item.nonUseConditions} />
              <TextList title="常见误用" items={item.antiPatterns} />
              <TextList title="典型场景" items={item.typicalProblems} />
            </div>
          </AdminDetailSection>

          <AdminDetailSection title="例子">
            <TextList items={item.examples} />
          </AdminDetailSection>

          <AdminDetailSection title="复习题">
            <div className="grid gap-3">
              {item.reviewItems.length > 0 ? (
                item.reviewItems.map((reviewItem) => (
                  <article key={reviewItem.id} className="grid gap-2 rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{reviewTypeLabel(reviewItem.type)}</Badge>
                      <Badge variant="outline">难度 {reviewItem.difficulty}</Badge>
                    </div>
                    <p className="text-sm font-medium leading-6">{reviewItem.prompt}</p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {reviewItem.answer}
                    </p>
                    {reviewItem.explanation ? (
                      <p className="text-xs leading-5 text-muted-foreground">
                        {reviewItem.explanation}
                      </p>
                    ) : null}
                  </article>
                ))
              ) : (
                <EmptyState>当前没有启用中的复习题。</EmptyState>
              )}
            </div>
          </AdminDetailSection>
        </div>

        <aside className="grid content-start gap-5">
          <AdminDetailSection title="元信息">
            <dl className="grid gap-3 text-sm">
              <MetaRow label="ID" value={item.id} />
              <MetaRow label="难度" value={String(item.difficulty)} />
              <MetaRow label="创建者" value={ownerLabel(item)} />
              <MetaRow label="创建时间" value={formatDate(item.createdAt)} />
              <MetaRow label="更新时间" value={formatDate(item.updatedAt)} />
            </dl>
            {item.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
            ) : null}
          </AdminDetailSection>

          <AdminDetailSection title="变量">
            <div className="grid gap-3">
              {item.variables.length > 0 ? (
                item.variables.map((variable) => (
                  <div key={variable.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-muted px-2 py-1 text-xs">
                        {variable.symbol}
                      </code>
                      <span className="text-sm font-medium">{variable.name}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {variable.description}
                    </p>
                    {variable.unit ? (
                      <p className="mt-1 text-xs text-muted-foreground">单位：{variable.unit}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <EmptyState>当前没有变量。</EmptyState>
              )}
            </div>
          </AdminDetailSection>

          <AdminDetailSection title="关联知识项">
            <div className="grid gap-3">
              {item.outgoingRelations.length > 0 ? (
                item.outgoingRelations.map((relation) => (
                  <div key={relation.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {relationTypeLabel(relation.relationType)}
                      </Badge>
                      <Link
                        href={`/admin/knowledge-items/${relation.toKnowledgeItem.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {relation.toKnowledgeItem.title}
                      </Link>
                    </div>
                    {relation.note ? (
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {relation.note}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <EmptyState>当前没有关联知识项。</EmptyState>
              )}
            </div>
          </AdminDetailSection>
        </aside>
      </div>
    </div>
  );
}

function AdminDetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-background p-5">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function TextList({
  title,
  items,
}: {
  title?: string;
  items: string[];
}) {
  return (
    <div className="grid gap-2">
      {title ? <h3 className="text-sm font-medium">{title}</h3> : null}
      {items.length > 0 ? (
        <ul className="grid gap-2">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-md border bg-muted/20 px-3 py-2 text-sm leading-6 text-muted-foreground"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>当前没有内容。</EmptyState>
      )}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-all font-medium">{value}</dd>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function contentTypeLabel(contentType: KnowledgeItemType) {
  switch (contentType) {
    case "math_formula":
      return "数学公式";
    case "vocabulary":
      return "词汇";
    case "concept_card":
      return "概念卡";
    case "comparison_table":
      return "对比表";
    case "procedure":
      return "流程";
    default:
      return "纯文本";
  }
}

function reviewTypeLabel(type: string) {
  if (type === "recognition") {
    return "识别";
  }

  if (type === "application") {
    return "应用";
  }

  return "回忆";
}

function relationTypeLabel(type: string) {
  if (type === "prerequisite") {
    return "前置";
  }

  if (type === "confusable") {
    return "易混淆";
  }

  if (type === "application_of") {
    return "应用";
  }

  return "相关";
}

function ownerLabel(
  item: NonNullable<Awaited<ReturnType<typeof getAdminKnowledgeItem>>>,
) {
  return (
    item.createdByUser?.displayName ||
    item.createdByUser?.email ||
    item.createdByUserId ||
    "系统公共知识库"
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
