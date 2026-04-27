import { DerivationTrainer } from "@/components/derivation/derivation-trainer";
import { PhaseShell } from "@/components/app/phase-shell";
import { requireCurrentLearner } from "@/server/auth/current-learner";
import { resolveLearningDomain } from "@/server/learning-domain";
import { getKnowledgeItemDetail, getKnowledgeItemSummaries } from "@/server/services/knowledge-item-service";

export const dynamic = "force-dynamic";

export default async function DerivationPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  await requireCurrentLearner();
  const params = await searchParams;
  const learningDomain = await resolveLearningDomain(params.domain);
  const summaries = await getKnowledgeItemSummaries({
    domain: learningDomain.currentDomain,
  });
  const details = (
    await Promise.all(summaries.map((knowledgeItem) => getKnowledgeItemDetail(knowledgeItem.slug)))
  ).filter((knowledgeItem) => knowledgeItem?.derivation) as NonNullable<
    Awaited<ReturnType<typeof getKnowledgeItemDetail>>
  >[];

  return (
    <PhaseShell
      activePath="/derivation"
      eyebrow="推导训练"
      title="推导练习"
      learningDomain={learningDomain}
    >
      <DerivationTrainer domain={learningDomain.currentDomain} knowledgeItems={details} />
    </PhaseShell>
  );
}
