import type { DiagnosticAssessment } from "@/types/diagnostic";

export type DiagnosticQuestionResult = {
  id: string;
  knowledgeItemIds: string[];
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
  questions,
  answers,
}: {
  questions: DiagnosticQuestionResult[];
  answers: Array<{
    questionId: string;
    assessment: DiagnosticAssessment;
  }>;
}) {
  const answersByQuestionId = new Map(
    answers.map((answer) => [answer.questionId, answer.assessment]),
  );

  return Array.from(
    new Set(
      questions
        .flatMap((question) => {
          const assessment = answersByQuestionId.get(question.id);
          return assessment === "none" || assessment === "partial"
            ? question.knowledgeItemIds
            : [];
        }),
    ),
  );
}

export function calculateBestDiagnosticAssessmentsByKnowledgeItem({
  questions,
  answers,
}: {
  questions: DiagnosticQuestionResult[];
  answers: Array<{
    questionId: string;
    assessment: DiagnosticAssessment;
  }>;
}) {
  const answersByQuestionId = new Map(
    answers.map((answer) => [answer.questionId, answer.assessment]),
  );
  const assessmentsByKnowledgeItemId = new Map<string, DiagnosticAssessment>();

  for (const question of questions) {
    const assessment = answersByQuestionId.get(question.id) ?? "none";

    for (const knowledgeItemId of question.knowledgeItemIds) {
      const previous = assessmentsByKnowledgeItemId.get(knowledgeItemId);

      if (
        !previous ||
        getDiagnosticAssessmentPriority(assessment) >
          getDiagnosticAssessmentPriority(previous)
      ) {
        assessmentsByKnowledgeItemId.set(knowledgeItemId, assessment);
      }
    }
  }

  return assessmentsByKnowledgeItemId;
}
