import { notFound } from "next/navigation";

import { PhaseShell } from "@/components/app/phase-shell";
import { ContentAssistEditor } from "@/components/content-assist/content-assist-editor";
import { requireCurrentLearner } from "@/server/auth/current-learner";
import { getContentAssistDraft } from "@/server/services/content-assist-service";

export const dynamic = "force-dynamic";

export default async function ContentAssistDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireCurrentLearner();
  const payload = await getContentAssistDraft({
    knowledgeItemIdOrSlug: slug,
  });

  if (!payload) {
    notFound();
  }

  return (
    <PhaseShell
      activePath=""
      eyebrow="Phase 8 / Draft Review"
      title="审核内容草稿"
    >
      <ContentAssistEditor
        knowledgeItem={payload.knowledgeItem}
        initialDraft={payload.draft}
      />
    </PhaseShell>
  );
}
