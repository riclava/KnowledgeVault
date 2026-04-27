import type { DiagnosticAssessment } from "@/types/diagnostic";

export type DiagnosticReviewItemResult = {
  id: string;
  knowledgeItemId: string;
};

export function getDiagnosticAssessmentPriority(
  assessment: DiagnosticAssessment,
) {
  if (assessment === "clear") {
    return 3;
  }

  if (assessment === "partial") {
    return 2;
  }

  return 1;
}

export function calculateDiagnosticWeakKnowledgeItemIds({
  reviewItems,
  answers,
}: {
  reviewItems: DiagnosticReviewItemResult[];
  answers: Array<{
    reviewItemId: string;
    assessment: DiagnosticAssessment;
  }>;
}) {
  const answersByReviewItemId = new Map(
    answers.map((answer) => [answer.reviewItemId, answer.assessment]),
  );

  return Array.from(
    new Set(
      reviewItems
        .filter((item) => {
          const assessment = answersByReviewItemId.get(item.id);
          return assessment === "none" || assessment === "partial";
        })
        .map((item) => item.knowledgeItemId),
    ),
  );
}

export function calculateBestDiagnosticAssessmentsByKnowledgeItem({
  reviewItems,
  answers,
}: {
  reviewItems: DiagnosticReviewItemResult[];
  answers: Array<{
    reviewItemId: string;
    assessment: DiagnosticAssessment;
  }>;
}) {
  const answersByReviewItemId = new Map(
    answers.map((answer) => [answer.reviewItemId, answer.assessment]),
  );
  const assessmentsByKnowledgeItemId = new Map<string, DiagnosticAssessment>();

  for (const item of reviewItems) {
    const assessment = answersByReviewItemId.get(item.id) ?? "none";
    const previous = assessmentsByKnowledgeItemId.get(item.knowledgeItemId);

    if (
      !previous ||
      getDiagnosticAssessmentPriority(assessment) >
        getDiagnosticAssessmentPriority(previous)
    ) {
      assessmentsByKnowledgeItemId.set(item.knowledgeItemId, assessment);
    }
  }

  return assessmentsByKnowledgeItemId;
}
