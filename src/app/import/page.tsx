import { AdminImportForm } from "@/components/admin/admin-import-form";
import { PhaseShell } from "@/components/app/phase-shell";
import { requireCurrentLearner } from "@/server/auth/current-learner";
import { resolveLearningDomain } from "@/server/learning-domain";

export default async function LearnerImportPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const current = await requireCurrentLearner();
  const params = await searchParams;
  const learningDomain = await resolveLearningDomain(
    params.domain,
    current.learner.id,
  );

  return (
    <PhaseShell
      activePath="/import"
      eyebrow="AI 导入"
      title="导入到我的知识库"
      description="把材料整理成只对你可见的知识项，确认导入后会进入今日复习。"
      learningDomain={learningDomain}
    >
      <div className="grid max-w-4xl gap-5">
        <AdminImportForm
          endpoint="/api/import"
          sourceMaterialDescription="粘贴教材、笔记、文章或题目，AI 先生成可检查的预览，确认后导入到我的知识库。"
          confirmHint="确认预览内容没问题后，导入为只对你可见的知识项，并立即进入今日复习。"
          successTitle="已导入到我的知识库"
        />
      </div>
    </PhaseShell>
  );
}
