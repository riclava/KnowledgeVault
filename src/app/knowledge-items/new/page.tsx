import { PhaseShell } from "@/components/app/phase-shell";
import { CustomKnowledgeItemForm } from "@/components/knowledge-item/custom-knowledge-item-form";
import { requireCurrentLearner } from "@/server/auth/current-learner";

export default async function NewKnowledgeItemPage() {
  await requireCurrentLearner();

  return (
    <PhaseShell
      activePath="/knowledge-items"
      eyebrow="自定义知识项"
      title="添加自定义知识项"
      density="compact"
    >
      <CustomKnowledgeItemForm />
    </PhaseShell>
  );
}
