import {
  completeStudySession,
  countUserKnowledgeItemStates,
  createQuestionAttempt,
  createStudySession,
  deferKnowledgeItemReview,
  ensureUnstartedKnowledgeItemStatesForReview,
  getActiveQuestionForKnowledgeItem,
  getReviewHintSource,
  getStudySessionById,
  getUserKnowledgeItemState,
  listDueKnowledgeItemStates,
  listWeakKnowledgeItemStatesForReview,
  updateUserKnowledgeItemState,
} from "@/server/repositories/review-repository";
import {
  calculateNextReviewState,
  mapQuestionAttemptToReviewGrade,
} from "@/server/services/review-rules";
import { normalizeKnowledgeItemRenderPayload } from "@/lib/knowledge-item-render-payload";
import { normalizeSubmittedAnswer } from "@/lib/question-validation";
import { chatText, type AiEnv } from "@/server/ai/openai-compatible";
import { gradeQuestionAnswer } from "@/server/services/question-grading-service";
import type {
  ReviewHint,
  ReviewMode,
  ReviewQueueItem,
  ReviewSessionPayload,
  ReviewSubmitInput,
  ReviewSubmitResult,
} from "@/types/review";

export async function getTodayReviewSession({
  userId,
  domain,
  mode = "today",
}: {
  userId: string;
  domain: string;
  mode?: ReviewMode;
}): Promise<ReviewSessionPayload> {
  const now = new Date();
  const knowledgeItemStateCount = await countUserKnowledgeItemStates({
    userId,
    domain,
  });

  if (mode === "today" && knowledgeItemStateCount > 0) {
    await ensureUnstartedKnowledgeItemStatesForReview({
      userId,
      domain,
      now,
    });
  }

  const states =
    mode === "weak"
      ? await listWeakKnowledgeItemStatesForReview({
          userId,
          domain,
        })
      : await listDueKnowledgeItemStates({
          userId,
          domain,
          now,
        });

  if (states.length === 0) {
    return {
      sessionId: null,
      domain: null,
      mode,
      items: [],
      estimatedMinutes: 0,
      emptyReason:
        knowledgeItemStateCount === 0 ? "needs_diagnostic" : "no_due_reviews",
    };
  }

  const eligibleStates = states.filter(
    (state) => state.knowledgeItem.questionBindings.length > 0,
  );

  if (eligibleStates.length === 0) {
    return {
      sessionId: null,
      domain: null,
      mode,
      items: [],
      estimatedMinutes: 0,
      emptyReason: "no_review_content",
    };
  }

  const items = eligibleStates.map((state) =>
    selectReviewQueueItem({
      mode,
      state,
    }),
  );
  const session = await createStudySession({
    userId,
    domain,
  });

  return {
    sessionId: session.id,
    domain: session.domain,
    mode,
    items,
    estimatedMinutes: estimateReviewMinutes(items, mode),
    emptyReason: null,
  };
}

export async function submitReview({
  userId,
  input,
}: {
  userId: string;
  input: ReviewSubmitInput;
}): Promise<ReviewSubmitResult> {
  const [state, session, question] = await Promise.all([
    getUserKnowledgeItemState(userId, input.knowledgeItemId),
    getStudySessionById({
      sessionId: input.sessionId,
      userId,
    }),
    getActiveQuestionForKnowledgeItem({
      questionId: input.questionId,
      knowledgeItemId: input.knowledgeItemId,
      userId,
    }),
  ]);

  if (!state || !session) {
    throw new Error("Review state or session not found");
  }

  if (!question) {
    throw new Error("Question is not active for this knowledge item");
  }

  const submittedAnswer = normalizeSubmittedAnswer(
    question.type,
    input.submittedAnswer,
  );
  const questionGrade = await gradeQuestionAnswer({
    question: {
      type: question.type,
      prompt: question.prompt,
      answer: question.answer as never,
      answerAliases: question.answerAliases,
      explanation: question.explanation,
    },
    submittedAnswer,
  });
  const reviewGrade = mapQuestionAttemptToReviewGrade(questionGrade);
  const now = new Date();
  const nextState = calculateNextReviewState({
    state,
    result: reviewGrade,
    now,
  });

  await Promise.all([
    createQuestionAttempt({
      userId,
      questionId: input.questionId,
      studySessionId: input.sessionId,
      result: questionGrade.result,
      score: questionGrade.score,
      feedback: questionGrade.feedback,
      submittedAnswer,
      responseTimeMs: input.responseTimeMs,
    }),
    updateUserKnowledgeItemState({
      userId,
      knowledgeItemId: input.knowledgeItemId,
      data: nextState,
    }),
  ]);

  if (input.completed && session.status !== "completed") {
    await completeStudySession(input.sessionId);
  }

  return {
    sessionId: input.sessionId,
    knowledgeItemId: input.knowledgeItemId,
    nextReviewAt: nextState.nextReviewAt.toISOString(),
    result: reviewGrade,
  };
}

export async function deferReview({
  userId,
  knowledgeItemId,
  minutes = 10,
}: {
  userId: string;
  knowledgeItemId: string;
  minutes?: number;
}) {
  const nextReviewAt = new Date(Date.now() + minutes * 60 * 1000);
  const state = await deferKnowledgeItemReview({
    userId,
    knowledgeItemId,
    nextReviewAt,
  });

  return {
    knowledgeItemId: state.knowledgeItemId,
    nextReviewAt: state.nextReviewAt?.toISOString() ?? nextReviewAt.toISOString(),
  };
}

export async function getReviewHint({
  userId,
  knowledgeItemId,
}: {
  userId: string;
  knowledgeItemId: string;
}): Promise<ReviewHint> {
  const state = await getReviewHintSource({
    userId,
    knowledgeItemId,
  });

  if (!state) {
    throw new Error("KnowledgeItem not found");
  }

  const hook = state.knowledgeItem.memoryHooks[0];

  if (hook) {
    return {
      knowledgeItemId,
      content: hook.content,
      source: "memory_hook",
      memoryHookUsedId: hook.id,
    };
  }

  const aiHint = await generateAiReviewHint({
    knowledgeItem: state.knowledgeItem,
    question: state.knowledgeItem.questionBindings[0]?.question ?? null,
  });

  if (aiHint) {
    return {
      knowledgeItemId,
      content: aiHint,
      source: "ai",
      memoryHookUsedId: null,
    };
  }

  return {
    knowledgeItemId,
    content: state.knowledgeItem.summary,
    source: "one_line_use",
    memoryHookUsedId: null,
  };
}

export async function generateAiReviewHint({
  knowledgeItem,
  question,
  env,
  fetcher,
}: {
  knowledgeItem: {
    title: string;
    summary: string;
    body: string;
  };
  question: {
    prompt: string;
    answer: unknown;
    explanation: string | null;
  } | null;
  env?: AiEnv;
  fetcher?: typeof fetch;
}) {
  if (!question) {
    return null;
  }

  try {
    const hint = await chatText({
      env,
      fetcher,
      maxTokens: 120,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "你是 KnowledgeVault 的复习提示助手。主要使用中文，生成一句中文提示，帮助学习者回忆思路，但不要直接泄露答案、公式最终结果或完整解法。只输出提示本身。",
        },
        {
          role: "user",
          content: [
            `知识项：${knowledgeItem.title}`,
            `摘要：${knowledgeItem.summary}`,
            `正文：${knowledgeItem.body}`,
            `题目：${question.prompt}`,
            `答案（仅供你避开答案）：${formatQuestionAnswer(question.answer)}`,
            `解释：${question.explanation ?? ""}`,
            "请给一句不超过 40 个中文字符的提示。",
          ].join("\n"),
        },
      ],
    });

    return hint || null;
  } catch {
    return null;
  }
}

function selectReviewQueueItem({
  mode,
  state,
}: {
  mode: ReviewMode;
  state: Awaited<ReturnType<typeof listDueKnowledgeItemStates>>[number];
}): ReviewQueueItem {
  const questionBinding = [...state.knowledgeItem.questionBindings].sort(
    (left, right) =>
      left.question.difficulty - right.question.difficulty ||
      left.question.createdAt.getTime() - right.question.createdAt.getTime(),
  )[0];
  const question = questionBinding.question;
  const isWeak = state.memoryStrength < 0.4 || state.lapseCount > 0;
  const isStable = state.memoryStrength >= 0.7 && state.consecutiveCorrect >= 3;
  const trainingStatus = isWeak
    ? "weak"
    : isStable
      ? "stable"
      : "due_now";

  return {
    questionId: question.id,
    knowledgeItemId: state.knowledgeItemId,
    type: question.type,
    prompt: question.prompt,
    options: question.options as never,
    answer: question.answer as never,
    answerAliases: question.answerAliases,
    explanation: question.explanation,
    difficulty: question.difficulty,
    reviewReason: buildReviewReason({
      mode,
      state,
    }),
    knowledgeItem: {
      id: state.knowledgeItem.id,
      slug: state.knowledgeItem.slug,
      title: state.knowledgeItem.title,
      contentType: state.knowledgeItem.contentType,
      renderPayload: normalizeKnowledgeItemRenderPayload(
        state.knowledgeItem.contentType,
        state.knowledgeItem.renderPayload,
      ),
      domain: state.knowledgeItem.domain,
      subdomain: state.knowledgeItem.subdomain,
      summary: state.knowledgeItem.summary,
      difficulty: state.knowledgeItem.difficulty,
      tags: state.knowledgeItem.tags,
      reviewItemCount: state.knowledgeItem.questionBindings.length,
      memoryHookCount: state.knowledgeItem.memoryHooks.length,
      trainingStatus,
      trainingStatusLabel:
        trainingStatus === "weak"
          ? "需要补弱"
          : trainingStatus === "stable"
            ? "稳定中"
            : "今天该复习",
      nextReviewAt: state.nextReviewAt?.toISOString() ?? null,
      isWeak,
      isDueNow: true,
      hasPersonalMemoryHook: state.knowledgeItem.memoryHooks.some(
        (hook) => hook.userId !== null,
      ),
      totalReviews: state.totalReviews,
      correctReviews: state.correctReviews,
      body: state.knowledgeItem.body,
    },
  };
}

function buildReviewReason({
  mode,
  state,
}: {
  mode: ReviewMode;
  state: Awaited<ReturnType<typeof listDueKnowledgeItemStates>>[number];
}) {
  if (mode === "weak") {
    if (state.lapseCount > 0) {
      return {
        label: "Again 回收",
        detail: "最近出现过遗忘，先把这条知识项捞回来。",
      };
    }

    if (state.memoryStrength < 0.55) {
      return {
        label: "记忆偏弱",
        detail: "当前记忆强度偏低，适合单独补一轮。",
      };
    }

    return {
      label: "高难先练",
      detail: "这条知识项难度更高，先处理能减少后续卡顿。",
    };
  }

  if (state.totalReviews === 0) {
    return {
      label: "新进队列",
      detail: "这条知识项已经进入你的复习队列，先建立第一轮记忆。",
    };
  }

  if (state.lapseCount > 0) {
    return {
      label: "需要回收",
      detail: "它近期出现过 Again，今天优先把记忆拉回来。",
    };
  }

  if (state.nextReviewAt) {
    return {
      label: "今天到期",
      detail: `该在 ${new Intl.DateTimeFormat("zh-CN", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(state.nextReviewAt)} 再练一次。`,
    };
  }

  return {
    label: "继续建立",
    detail: "这条知识项还在形成期，今天顺手再巩固一次。",
  };
}

function estimateReviewMinutes(
  items: ReviewQueueItem[],
  mode: ReviewMode,
) {
  if (items.length === 0) {
    return 0;
  }

  const estimatedSeconds = items.reduce((total, item) => {
    const base =
      item.type === "short_answer" ? 70 : item.type === "single_choice" ? 35 : 50;

    return total + (mode === "weak" ? base + 15 : base);
  }, 0);

  return Math.max(1, Math.ceil(estimatedSeconds / 60));
}

function formatQuestionAnswer(answer: unknown) {
  if (!answer || typeof answer !== "object") {
    return "";
  }

  return JSON.stringify(answer);
}
