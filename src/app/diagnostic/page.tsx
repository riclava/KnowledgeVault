import { DiagnosticQuiz } from "@/components/diagnostic/diagnostic-quiz";
import { PhaseShell } from "@/components/app/phase-shell";
import { requireCurrentLearner } from "@/server/auth/current-learner";
import { resolveLearningDomain } from "@/server/learning-domain";

export default async function DiagnosticPage({
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
      activePath="/diagnostic"
      eyebrow="首次诊断"
      title="开始诊断"
      learningDomain={learningDomain}
    >
      <DiagnosticQuiz domain={learningDomain.currentDomain} />
    </PhaseShell>
  );
}
