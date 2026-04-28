import { notFound } from "next/navigation";
import Link from "next/link";

import { KnowledgeItemAdminForm } from "@/components/admin/knowledge-item-admin-form";
import { buttonVariants } from "@/components/ui/button";
import { normalizeRouteParam } from "@/lib/route-params";
import { getAdminKnowledgeItem } from "@/server/admin/admin-knowledge-item-service";

type EditAdminKnowledgeItemPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditAdminKnowledgeItemPage({
  params,
}: EditAdminKnowledgeItemPageProps) {
  const { id: rawId } = await params;
  const item = await getAdminKnowledgeItem(normalizeRouteParam(rawId));

  if (!item) {
    notFound();
  }

  return (
    <div className="grid max-w-7xl gap-4">
      <header className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-xl font-semibold tracking-tight">编辑知识项</h1>
          <p className="max-w-2xl text-sm leading-5 text-muted-foreground">
            {item.title} · {item.slug}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/knowledge-items"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            返回知识项
          </Link>
          <Link
            href={`/knowledge-items/${item.id}`}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            查看详情
          </Link>
        </div>
      </header>

      <KnowledgeItemAdminForm
        initialValue={toInitialValue(item)}
        endpoint={`/api/admin/knowledge-items/${item.id}`}
        deleteEndpoint={`/api/admin/knowledge-items/${item.id}`}
        method="PUT"
      />
    </div>
  );
}

function toInitialValue(
  item: NonNullable<Awaited<ReturnType<typeof getAdminKnowledgeItem>>>,
) {
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    contentType: item.contentType,
    renderPayload: item.renderPayload,
    domain: item.domain,
    subdomain: item.subdomain ?? "",
    summary: item.summary,
    body: item.body,
    intuition: item.intuition ?? "",
    deepDive: item.deepDive ?? "",
    useConditions: item.useConditions,
    nonUseConditions: item.nonUseConditions,
    antiPatterns: item.antiPatterns,
    typicalProblems: item.typicalProblems,
    examples: item.examples,
    tags: item.tags,
    difficulty: item.difficulty,
    variables: item.variables.map((variable) => ({
      symbol: variable.symbol,
      name: variable.name,
      description: variable.description,
      unit: variable.unit ?? "",
      sortOrder: variable.sortOrder,
    })),
    reviewItems: item.reviewItems.map((reviewItem) => ({
      type: reviewItem.type,
      prompt: reviewItem.prompt,
      answer: reviewItem.answer,
      explanation: reviewItem.explanation ?? "",
      difficulty: reviewItem.difficulty,
    })),
    relations: item.outgoingRelations.map((relation) => ({
      fromSlug: item.slug,
      toSlug: relation.toKnowledgeItem.slug,
      relationType: relation.relationType,
      note: relation.note ?? "",
    })),
  };
}
