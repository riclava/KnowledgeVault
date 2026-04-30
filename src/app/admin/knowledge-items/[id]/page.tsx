import Link from "next/link";
import { notFound } from "next/navigation";

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
            {item.subdomain ? (
              <Badge variant="secondary">{item.subdomain}</Badge>
            ) : null}
            <Badge variant="outline">{item.contentType}</Badge>
            <Badge variant={item.visibility === "private" ? "secondary" : "outline"}>
              {item.visibility === "private" ? "私有" : "公共"}
            </Badge>
          </div>
          <div className="grid gap-1">
            <p className="text-sm font-medium text-muted-foreground">
              知识项详情
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {item.title}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {item.summary}
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
        <h2 className="text-lg font-semibold">内容预览</h2>
        <div className="overflow-x-auto rounded-lg border bg-muted/20 p-4">
          <KnowledgeItemRenderer
            contentType={item.contentType}
            payload={
              item.renderPayload as KnowledgeItemRenderPayloadByType[KnowledgeItemType]
            }
            block
          />
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <AdminDetailSection title="复习题 / 绑定题目">
          <p className="mb-3 text-xs text-muted-foreground">
            变量信息已并入各内容类型的结构化载荷。
          </p>
          <div className="grid gap-3">
            {item.questionBindings.length > 0 ? (
              item.questionBindings.map((binding) => (
                <article key={binding.id} className="grid gap-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{binding.question.type}</Badge>
                    <Badge variant="outline">难度 {binding.question.difficulty}</Badge>
                  </div>
                  <p className="text-sm font-medium leading-6">
                    {binding.question.prompt}
                  </p>
                  {binding.question.explanation ? (
                    <p className="text-xs leading-5 text-muted-foreground">
                      {binding.question.explanation}
                    </p>
                  ) : null}
                </article>
              ))
            ) : (
              <EmptyState>当前没有启用中的题目。</EmptyState>
            )}
          </div>
        </AdminDetailSection>

        <aside className="grid content-start gap-5">
          <AdminDetailSection title="元信息">
            <dl className="grid gap-3 text-sm">
              <MetaRow label="ID" value={item.id} />
              <MetaRow label="Slug" value={item.slug} />
              <MetaRow label="难度" value={String(item.difficulty)} />
              <MetaRow label="创建者" value={ownerLabel(item)} />
              <MetaRow label="创建时间" value={formatDate(item.createdAt)} />
              <MetaRow label="更新时间" value={formatDate(item.updatedAt)} />
            </dl>
            {item.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </AdminDetailSection>

          <AdminDetailSection title="关联知识项">
            <div className="grid gap-3">
              {item.outgoingRelations.length > 0 ? (
                item.outgoingRelations.map((relation) => (
                  <div key={relation.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{relation.relationType}</Badge>
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
