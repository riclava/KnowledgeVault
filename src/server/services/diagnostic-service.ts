import {
  createDiagnosticAttempt,
  listDiagnosticQuestions,
  listQuestionsByIds,
  upsertDiagnosticKnowledgeItemStates,
} from "@/server/repositories/diagnostic-repository";
import {
  calculateBestDiagnosticAssessmentsByKnowledgeItem,
  calculateDiagnosticWeakKnowledgeItemIds,
} from "@/server/services/diagnostic-rules";
import { normalizeKnowledgeItemRenderPayload } from "@/lib/knowledge-item-render-payload";
import { getKnowledgeItemSummaries } from "@/server/services/knowledge-item-service";
import type {
  DiagnosticResult,
  DiagnosticStart,
  DiagnosticSubmission,
} from "@/types/diagnostic";
import type {
  KnowledgeItemSummary,
  KnowledgeItemType,
} from "@/types/knowledge-item";
import type {
  QuestionAnswer,
  QuestionOption,
} from "@/types/question";

const DIAGNOSTIC_QUESTION_COUNT = 5;

export async function startDiagnostic({
  domain,
  userId,
}: {
  domain?: string;
  userId?: string;
} = {}): Promise<DiagnosticStart> {
  const currentDomain =
    domain ??
    (await getKnowledgeItemSummaries({ userId }))[0]?.domain ??
    "默认知识域";
  const questions = await listDiagnosticQuestions({
    domain: currentDomain,
    userId,
    take: DIAGNOSTIC_QUESTION_COUNT,
  });

  return {
    domain: currentDomain,
    questions: questions.map((question) => {
      const primaryBinding = question.knowledgeItems[0]!;

      return {
        id: question.id,
        knowledgeItemIds: question.knowledgeItems.map(
          (binding) => binding.knowledgeItemId,
        ),
        type: question.type,
        prompt: question.prompt,
        options: question.options as QuestionOption[] | null,
        answer: question.answer as QuestionAnswer,
        answerAliases: question.answerAliases,
        explanation: question.explanation,
        difficulty: question.difficulty,
        knowledgeItem: toKnowledgeItemSummary(primaryBinding.knowledgeItem),
      };
    }),
  };
}

export async function submitDiagnostic({
  userId,
  submission,
}: {
  userId: string;
  submission: DiagnosticSubmission;
}): Promise<DiagnosticResult> {
  const questionIds = submission.answers.map((answer) => answer.questionId);
  const questions = await listQuestionsByIds({
    domain: submission.domain,
    questionIds,
    userId,
  });
  const knowledgeItemIds = Array.from(
    new Set(
      questions.flatMap((question) =>
        question.knowledgeItems.map((binding) => binding.knowledgeItemId),
      ),
    ),
  );
  const diagnosticQuestions = questions.map((question) => ({
    id: question.id,
    knowledgeItemIds: question.knowledgeItems.map(
      (binding) => binding.knowledgeItemId,
    ),
  }));
  const weakKnowledgeItemIds = calculateDiagnosticWeakKnowledgeItemIds({
    questions: diagnosticQuestions,
    answers: submission.answers,
  });
  const assessmentsByKnowledgeItemId =
    calculateBestDiagnosticAssessmentsByKnowledgeItem({
      questions: diagnosticQuestions,
      answers: submission.answers,
    });

  await upsertDiagnosticKnowledgeItemStates({
    userId,
    knowledgeItemIds,
    weakKnowledgeItemIds,
    assessmentsByKnowledgeItemId,
  });

  const attempt = await createDiagnosticAttempt({
    userId,
    domain: submission.domain,
    questionIds,
    weakKnowledgeItemIds,
  });

  const weakKnowledgeItems = await getWeakKnowledgeItemSummaries({
    knowledgeItemIds: weakKnowledgeItemIds,
    userId,
  });

  return {
    id: attempt.id,
    domain: attempt.domain,
    questionIds: attempt.questionIds,
    weakKnowledgeItemIds: attempt.weakKnowledgeItemIds,
    completedAt: attempt.completedAt.toISOString(),
    weakKnowledgeItems,
    reviewQueueKnowledgeItemIds:
      weakKnowledgeItemIds.length > 0 ? weakKnowledgeItemIds : knowledgeItemIds,
  };
}

async function getWeakKnowledgeItemSummaries({
  knowledgeItemIds,
  userId,
}: {
  knowledgeItemIds: string[];
  userId: string;
}) {
  if (knowledgeItemIds.length === 0) {
    return [];
  }

  const summaries = await getKnowledgeItemSummaries({ userId });
  const knowledgeItemIdSet = new Set(knowledgeItemIds);

  return summaries.filter((knowledgeItem) =>
    knowledgeItemIdSet.has(knowledgeItem.id),
  );
}

function toKnowledgeItemSummary(knowledgeItem: {
  id: string;
  slug: string;
  title: string;
  contentType: KnowledgeItemType;
  renderPayload: unknown;
  domain: string;
  subdomain: string | null;
  summary: string;
  difficulty: number;
  tags: string[];
  _count: {
    questionBindings: number;
    memoryHooks: number;
  };
}): KnowledgeItemSummary {
  return {
    id: knowledgeItem.id,
    slug: knowledgeItem.slug,
    title: knowledgeItem.title,
    contentType: knowledgeItem.contentType,
    renderPayload: normalizeKnowledgeItemRenderPayload(
      knowledgeItem.contentType,
      knowledgeItem.renderPayload,
    ),
    domain: knowledgeItem.domain,
    subdomain: knowledgeItem.subdomain,
    summary: knowledgeItem.summary,
    difficulty: knowledgeItem.difficulty,
    tags: knowledgeItem.tags,
    reviewItemCount: knowledgeItem._count.questionBindings,
    memoryHookCount: knowledgeItem._count.memoryHooks,
    trainingStatus: "not_started",
    trainingStatusLabel: "尚未进入训练",
    nextReviewAt: null,
    isWeak: false,
    isDueNow: false,
    hasPersonalMemoryHook: false,
    totalReviews: 0,
    correctReviews: 0,
  };
}
