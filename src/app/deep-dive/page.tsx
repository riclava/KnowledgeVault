import { DeepDiveTrainer } from "@/components/deep-dive/deep-dive-trainer";
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
  ).filter((knowledgeItem) => knowledgeItem?.deepDive) as NonNullable<
    Awaited<ReturnType<typeof getKnowledgeItemDetail>>
  >[];

  return (
    <PhaseShell
      activePath="/deep-dive"
      eyebrow="理解训练"
      title="深入理解练习"
      learningDomain={learningDomain}
    >
      <DeepDiveTrainer domain={learningDomain.currentDomain} knowledgeItems={details} />
    </PhaseShell>
  );
}
