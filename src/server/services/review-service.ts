import {
  completeStudySession,
  countUserKnowledgeItemStates,
  createReviewLog,
  createStudySession,
  deferKnowledgeItemReview,
  getReviewHintSource,
  getStudySessionById,
  getUserKnowledgeItemState,
  listDueKnowledgeItemStates,
  listWeakKnowledgeItemStatesForReview,
  updateUserKnowledgeItemState,
} from "@/server/repositories/review-repository";
import {
  calculateNextReviewState,
  chooseReviewItemType,
  REVIEW_TYPE_CYCLE,
} from "@/server/services/review-rules";
import { normalizeKnowledgeItemRenderPayload } from "@/lib/knowledge-item-render-payload";
import type {
  ReviewGrade,
  ReviewHint,
  ReviewMode,
  ReviewQueueItem,
  ReviewSessionPayload,
  ReviewSessionSnapshot,
  ReviewSubmitInput,
  ReviewSubmitResult,
} from "@/types/review";

const REVIEW_QUEUE_LIMIT = 8;

export async function getTodayReviewSession({
  userId,
  domain,
  mode = "today",
}: {
  userId: string;
  domain: string;
  mode?: ReviewMode;
}): Promise<ReviewSessionPayload> {
  const [knowledgeItemStateCount, states] = await Promise.all([
    countUserKnowledgeItemStates({
      userId,
      domain,
    }),
    mode === "weak"
      ? listWeakKnowledgeItemStatesForReview({
          userId,
          domain,
          take: REVIEW_QUEUE_LIMIT,
        })
      : listDueKnowledgeItemStates({
          userId,
          domain,
          now: new Date(),
          take: REVIEW_QUEUE_LIMIT,
        }),
  ]);

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

  const eligibleStates = states.filter((state) => state.knowledgeItem.reviewItems.length > 0);

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

  const items = eligibleStates.map((state, index) =>
    selectReviewQueueItem({
      mode,
      state,
      preferredType: REVIEW_TYPE_CYCLE[index % REVIEW_TYPE_CYCLE.length],
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
  const [state, session] = await Promise.all([
    getUserKnowledgeItemState(userId, input.knowledgeItemId),
    getStudySessionById({
      sessionId: input.sessionId,
      userId,
    }),
  ]);

  if (!state || !session) {
    throw new Error("Review state or session not found");
  }

  const now = new Date();
  const nextState = calculateNextReviewState({
    state,
    result: input.result,
    now,
  });

  await Promise.all([
    createReviewLog({
      userId,
      knowledgeItemId: input.knowledgeItemId,
      reviewItemId: input.reviewItemId,
      studySessionId: input.sessionId,
      result: input.result,
      responseTimeMs: input.responseTimeMs,
      memoryHookUsedId: input.memoryHookUsedId,
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
    result: input.result,
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

  return {
    knowledgeItemId,
    content: state.knowledgeItem.summary,
    source: "one_line_use",
    memoryHookUsedId: null,
  };
}

export async function getReviewSessionSnapshot({
  userId,
  sessionId,
}: {
  userId: string;
  sessionId: string;
}): Promise<ReviewSessionSnapshot | null> {
  const session = await getStudySessionById({
    sessionId,
    userId,
  });

  if (!session) {
    return null;
  }

  const grades: Record<ReviewGrade, number> = {
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  };

  for (const log of session.reviewLogs) {
    grades[log.result] += 1;
  }

  return {
    id: session.id,
    domain: session.domain,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    reviewCount: session.reviewLogs.length,
    grades,
  };
}

function selectReviewQueueItem({
  mode,
  state,
  preferredType,
}: {
  mode: ReviewMode;
  state: Awaited<ReturnType<typeof listDueKnowledgeItemStates>>[number];
  preferredType: "recall" | "recognition" | "application";
}): ReviewQueueItem {
  const selectedType = chooseReviewItemType({
    availableTypes: state.knowledgeItem.reviewItems.map((item) => item.type),
    preferredType,
  });
  const reviewItem =
    state.knowledgeItem.reviewItems.find((item) => item.type === selectedType) ??
    state.knowledgeItem.reviewItems[0];
  const isWeak = state.memoryStrength < 0.4 || state.lapseCount > 0;
  const isStable = state.memoryStrength >= 0.7 && state.consecutiveCorrect >= 3;
  const trainingStatus = isWeak
    ? "weak"
    : isStable
      ? "stable"
      : "due_now";

  return {
    reviewItemId: reviewItem.id,
    knowledgeItemId: state.knowledgeItemId,
    type: reviewItem.type,
    prompt: reviewItem.prompt,
    answer: reviewItem.answer,
    explanation: reviewItem.explanation,
    difficulty: reviewItem.difficulty,
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
      variablePreview: [],
      reviewItemCount: state.knowledgeItem.reviewItems.length,
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
      label: "诊断薄弱",
      detail: "首次诊断把它标成了今天最该开始的一批内容。",
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
      item.type === "application" ? 70 : item.type === "recognition" ? 40 : 50;

    return total + (mode === "weak" ? base + 15 : base);
  }, 0);

  return Math.max(1, Math.ceil(estimatedSeconds / 60));
}
