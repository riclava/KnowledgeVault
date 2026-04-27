import { notFound } from "next/navigation";

import { KnowledgeItemAdminForm } from "@/components/admin/knowledge-item-admin-form";
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
    <div className="grid max-w-5xl gap-5">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">编辑知识项</h1>
      </header>

      <KnowledgeItemAdminForm
        initialValue={toInitialValue(item)}
        endpoint={`/api/admin/knowledge-items/${item.id}`}
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
