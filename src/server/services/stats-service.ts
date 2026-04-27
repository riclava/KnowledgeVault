import {
  countProgressBuckets,
  createProductEvents,
  getLatestCompletedStudySessionSummary,
  listAccessibleMemoryHooks,
  listProductEvents,
  listRecentMemoryHookActivity,
  listRecentStudySessions,
  listReviewLogsForUser,
  listWeakKnowledgeItemStates,
} from "@/server/repositories/stats-repository";
import type { ProgressStats, SummaryStats, WeakKnowledgeItemStat } from "@/types/stats";

export async function getSummaryStats({
  userId,
  domain,
}: {
  userId: string;
  domain: string;
}): Promise<SummaryStats> {
  const [latestSession, weakStates, sessions, logs, hooks, events] = await Promise.all([
    getLatestCompletedStudySessionSummary({
      userId,
      domain,
    }),
    listWeakKnowledgeItemStates({
      userId,
      domain,
      take: 6,
    }),
    listRecentStudySessions({
      userId,
      domain,
      take: 90,
    }),
    listReviewLogsForUser({
      userId,
      domain,
      take: 1000,
    }),
    listAccessibleMemoryHooks({
      userId,
      domain,
    }),
    listProductEvents({
      userId,
      domain,
    }),
  ]);

  if (!latestSession) {
    return {
      latestSession: null,
      nextSuggestedReviewAt: weakStates[0]?.nextReviewAt?.toISOString() ?? null,
      immediateWeakKnowledgeItems: weakStates.map(toWeakKnowledgeItemStat),
      memoryHookActivity: [],
      advancedStats: buildAdvancedStats(logs),
      learningRecommendations: buildLearningRecommendations({
        weakKnowledgeItems: weakStates.map(toWeakKnowledgeItemStat),
        logs,
        hooks,
      }),
      metrics: buildMetrics({
        sessions,
        logs,
        hooks,
        events,
      }),
    };
  }

  const grades = {
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  } as const satisfies Record<"again" | "hard" | "good" | "easy", number>;

  const mutableGrades = { ...grades };

  for (const log of latestSession.reviewLogs) {
    mutableGrades[log.result] += 1;
  }

  const responseTimes = latestSession.reviewLogs
    .map((log) => log.responseTimeMs)
    .filter((value): value is number => typeof value === "number");
  const averageResponseTimeMs =
    responseTimes.length > 0
      ? Math.round(
          responseTimes.reduce((total, value) => total + value, 0) /
            responseTimes.length,
        )
      : null;

  const knowledgeItemIds = Array.from(
    new Set(latestSession.reviewLogs.map((log) => log.knowledgeItemId)),
  );
  const hookActivity = await listRecentMemoryHookActivity({
    userId,
    domain,
    from: latestSession.startedAt,
    knowledgeItemIds,
  });

  const immediateWeakKnowledgeItems = buildWeakKnowledgeItemsFromSession({
    session: latestSession,
    weakStates,
  });

  return {
    latestSession: {
      id: latestSession.id,
      domain: latestSession.domain,
      startedAt: latestSession.startedAt.toISOString(),
      completedAt: latestSession.completedAt?.toISOString() ?? null,
      reviewCount: latestSession.reviewLogs.length,
      durationMinutes: Math.max(
        1,
        Math.round(
          ((latestSession.completedAt ?? latestSession.startedAt).getTime() -
            latestSession.startedAt.getTime()) /
            60000,
        ),
      ),
      averageResponseTimeMs,
      grades: mutableGrades,
    },
    nextSuggestedReviewAt: weakStates[0]?.nextReviewAt?.toISOString() ?? null,
    immediateWeakKnowledgeItems,
    memoryHookActivity: [
      ...hookActivity.createdHooks.map((hook) => ({
        id: hook.id,
        knowledgeItemId: hook.knowledgeItem.id,
        knowledgeItemTitle: hook.knowledgeItem.title,
        content: hook.content,
        source: "created" as const,
        timestamp: hook.createdAt.toISOString(),
      })),
      ...hookActivity.usedHooks
        .filter((log) => log.memoryHookUsed)
        .map((log) => ({
          id: log.memoryHookUsed!.id,
          knowledgeItemId: log.knowledgeItem.id,
          knowledgeItemTitle: log.knowledgeItem.title,
          content: log.memoryHookUsed!.content,
          source: "used" as const,
          timestamp: log.reviewedAt.toISOString(),
        })),
    ]
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
      .slice(0, 8),
    advancedStats: buildAdvancedStats(logs),
    learningRecommendations: buildLearningRecommendations({
      weakKnowledgeItems: immediateWeakKnowledgeItems,
      logs,
      hooks,
    }),
    metrics: buildMetrics({
      sessions,
      logs,
      hooks,
      events,
    }),
  };
}

export async function getProgressStats({
  userId,
  domain,
}: {
  userId: string;
  domain: string;
}): Promise<ProgressStats> {
  const progress = await countProgressBuckets({
    userId,
    domain,
  });

  return {
    trackedKnowledgeItemCount: progress.trackedKnowledgeItemCount,
    dueNowCount: progress.dueNowCount,
    scheduledCount: progress.scheduledCount,
    stableCount: progress.stableCount,
    weakCount: progress.weakCount,
    memoryHookKnowledgeItemCount: progress.memoryHookKnowledgeItemCount,
    latestDiagnosticAt: progress.latestDiagnosticAt?.toISOString() ?? null,
  };
}

export async function getWeakKnowledgeItems({
  userId,
  domain,
}: {
  userId: string;
  domain: string;
}) {
  const weakStates = await listWeakKnowledgeItemStates({
    userId,
    domain,
    take: 8,
  });
  return weakStates.map(toWeakKnowledgeItemStat);
}

export async function recordStatsEvents({
  userId,
  events,
}: {
  userId: string;
  events: Array<{
    knowledgeItemId?: string;
    studySessionId?: string;
    type: "weak_item_impression" | "weak_item_opened";
  }>;
}) {
  await createProductEvents({
    userId,
    events,
  });
}

function buildWeakKnowledgeItemsFromSession({
  session,
  weakStates,
}: {
  session: NonNullable<
    Awaited<ReturnType<typeof getLatestCompletedStudySessionSummary>>
  >;
  weakStates: Awaited<ReturnType<typeof listWeakKnowledgeItemStates>>;
}): WeakKnowledgeItemStat[] {
  const scoreByKnowledgeItemId = new Map<
    string,
    {
      slug: string;
      title: string;
      domain: string;
      summary: string;
      againCount: number;
      hardCount: number;
      latestResult: "again" | "hard" | "good" | "easy";
    }
  >();

  for (const log of session.reviewLogs) {
    const current = scoreByKnowledgeItemId.get(log.knowledgeItemId) ?? {
      slug: log.knowledgeItem.slug,
      title: log.knowledgeItem.title,
      domain: log.knowledgeItem.domain,
      summary: log.knowledgeItem.summary,
      againCount: 0,
      hardCount: 0,
      latestResult: log.result,
    };

    if (log.result === "again") {
      current.againCount += 1;
    }

    if (log.result === "hard") {
      current.hardCount += 1;
    }

    current.latestResult = log.result;
    scoreByKnowledgeItemId.set(log.knowledgeItemId, current);
  }

  return Array.from(scoreByKnowledgeItemId.entries())
    .filter(([, entry]) => entry.againCount > 0 || entry.hardCount > 0)
    .sort((left, right) => {
      const leftScore = left[1].againCount * 3 + left[1].hardCount * 2;
      const rightScore = right[1].againCount * 3 + right[1].hardCount * 2;
      return rightScore - leftScore;
    })
    .map(([knowledgeItemId, entry]) => {
      const state = weakStates.find((candidate) => candidate.knowledgeItemId === knowledgeItemId);

      return {
        knowledgeItemId,
        slug: entry.slug,
        title: entry.title,
        domain: entry.domain,
        summary: entry.summary,
        latestResult: entry.latestResult,
        againCount: entry.againCount,
        hardCount: entry.hardCount,
        nextReviewAt: state?.nextReviewAt?.toISOString() ?? null,
        memoryHookCount: state?.knowledgeItem._count.memoryHooks ?? 0,
        weakPoint: inferWeakPoint({
          latestResult: entry.latestResult,
          againCount: entry.againCount,
          hardCount: entry.hardCount,
          memoryHookCount: state?.knowledgeItem._count.memoryHooks ?? 0,
        }),
        recommendedAction: getRecommendedAction(
          inferWeakPoint({
            latestResult: entry.latestResult,
            againCount: entry.againCount,
            hardCount: entry.hardCount,
            memoryHookCount: state?.knowledgeItem._count.memoryHooks ?? 0,
          }),
        ),
        reason:
          entry.againCount > 0
            ? "这条知识项在本次复习里出现了 Again，建议优先回看适用条件和误用点。"
            : "这条知识项在本次复习里偏难，建议再做一次补弱确认边界。",
      };
    })
    .slice(0, 6);
}

function toWeakKnowledgeItemStat(
  state: Awaited<ReturnType<typeof listWeakKnowledgeItemStates>>[number],
): WeakKnowledgeItemStat {
  return {
    knowledgeItemId: state.knowledgeItemId,
    slug: state.knowledgeItem.slug,
    title: state.knowledgeItem.title,
    domain: state.knowledgeItem.domain,
    summary: state.knowledgeItem.summary,
    latestResult: null,
    againCount: state.lapseCount,
    hardCount: Math.max(0, state.totalReviews - state.correctReviews - state.lapseCount),
    nextReviewAt: state.nextReviewAt?.toISOString() ?? null,
    memoryHookCount: state.knowledgeItem._count.memoryHooks,
    weakPoint: inferWeakPoint({
      latestResult: null,
      againCount: state.lapseCount,
      hardCount: Math.max(0, state.totalReviews - state.correctReviews - state.lapseCount),
      memoryHookCount: state.knowledgeItem._count.memoryHooks,
      memoryStrength: state.memoryStrength,
    }),
    recommendedAction: getRecommendedAction(
      inferWeakPoint({
        latestResult: null,
        againCount: state.lapseCount,
        hardCount: Math.max(0, state.totalReviews - state.correctReviews - state.lapseCount),
        memoryHookCount: state.knowledgeItem._count.memoryHooks,
        memoryStrength: state.memoryStrength,
      }),
    ),
    reason:
      state.lapseCount > 0
        ? "近期出现过遗忘，建议从误用点和例题重新建立判断。"
        : "当前记忆强度偏低，适合先做一轮快速补弱。",
  };
}

function buildMetrics({
  sessions,
  logs,
  hooks,
  events,
}: {
  sessions: Awaited<ReturnType<typeof listRecentStudySessions>>;
  logs: Awaited<ReturnType<typeof listReviewLogsForUser>>;
  hooks: Awaited<ReturnType<typeof listAccessibleMemoryHooks>>;
  events: Awaited<ReturnType<typeof listProductEvents>>;
}) {
  const firstSession = sessions[sessions.length - 1] ?? null;
  const today = new Date();
  const todayKey = dayKey(today);
  const sessionsToday = sessions.filter((session) => dayKey(session.startedAt) === todayKey);
  const completedToday = sessionsToday.filter((session) => session.status === "completed");

  const completionDates = Array.from(
    new Set(
      sessions
        .filter((session) => session.status === "completed")
        .map((session) => dayKey(session.startedAt)),
    ),
  ).sort();

  let nextDayHits = 0;
  let nextDayEligible = 0;
  for (let index = 0; index < completionDates.length - 1; index += 1) {
    nextDayEligible += 1;
    const current = new Date(`${completionDates[index]}T00:00:00`);
    const next = new Date(current);
    next.setDate(current.getDate() + 1);
    if (completionDates[index + 1] === dayKey(next)) {
      nextDayHits += 1;
    }
  }

  const recoveryMap = new Map<
    string,
    { hadTrouble: boolean; recovered: boolean }
  >();
  for (const log of logs) {
    const item = recoveryMap.get(log.knowledgeItemId) ?? {
      hadTrouble: false,
      recovered: false,
    };

    if (log.result === "again" || log.result === "hard") {
      item.hadTrouble = true;
    }

    if (item.hadTrouble && (log.result === "good" || log.result === "easy")) {
      item.recovered = true;
    }

    recoveryMap.set(log.knowledgeItemId, item);
  }

  const troubleCount = Array.from(recoveryMap.values()).filter((item) => item.hadTrouble).length;
  const recoveredCount = Array.from(recoveryMap.values()).filter((item) => item.recovered).length;

  const impressionCount = events.filter(
    (event) => event.type === "weak_item_impression",
  ).length;
  const openedCount = events.filter(
    (event) => event.type === "weak_item_opened",
  ).length;

  const againHardCount = logs.filter(
    (log) => log.result === "again" || log.result === "hard",
  ).length;
  const createdHookCount = hooks.length;

  return [
    {
      id: "first_review_completion_rate" as const,
      label: "首次 Review 完成率",
      value:
        firstSession && sessions.length > 0
          ? firstSession.status === "completed"
            ? 1
            : 0
          : null,
      description: "第一轮进入复习后，是否顺利完成整组训练。",
    },
    {
      id: "daily_review_completion_rate" as const,
      label: "每日 Review 完成率",
      value: sessionsToday.length > 0 ? completedToday.length / sessionsToday.length : null,
      description: "今天开始的复习 session 中，有多少真正完成了整组训练。",
    },
    {
      id: "next_day_return_rate" as const,
      label: "次日回访率",
      value: nextDayEligible > 0 ? nextDayHits / nextDayEligible : null,
      description: "完成复习后，第二天是否有继续回来练。",
    },
    {
      id: "again_hard_recovery_rate" as const,
      label: "Again/Hard 回收率",
      value: troubleCount > 0 ? recoveredCount / troubleCount : null,
      description: "曾经 Again/Hard 的知识项，后续是否被练回 Good/Easy。",
    },
    {
      id: "weak_knowledgeItem_click_rate" as const,
      label: "薄弱知识项点击率",
      value: impressionCount > 0 ? openedCount / impressionCount : null,
      description: "总结页展示的薄弱知识项，有多少被继续点开补弱。",
    },
    {
      id: "memory_hook_creation_rate" as const,
      label: "下次提示创建率",
      value: againHardCount > 0 ? createdHookCount / againHardCount : null,
      description: "遇到困难后，用户是否愿意把提醒真正写下来。",
    },
  ];
}

function buildAdvancedStats(
  logs: Awaited<ReturnType<typeof listReviewLogsForUser>>,
) {
  const correctCount = logs.filter(
    (log) => log.result === "good" || log.result === "easy",
  ).length;
  const responseTimes = logs
    .map((log) => log.responseTimeMs)
    .filter((value): value is number => typeof value === "number");
  const typeLabels = {
    recall: "主动回忆",
    recognition: "判断识别",
    application: "场景应用",
  };
  const reviewTypeBreakdown = (["recall", "recognition", "application"] as const).map(
    (type) => {
      const typedLogs = logs.filter((log) => log.reviewItem.type === type);

      return {
        type,
        label: typeLabels[type],
        count: typedLogs.length,
        weakCount: typedLogs.filter(
          (log) => log.result === "again" || log.result === "hard",
        ).length,
      };
    },
  );
  const sevenDayTrend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = dayKey(date);
    const dayLogs = logs.filter((log) => dayKey(log.reviewedAt) === key);

    return {
      date: key,
      count: dayLogs.length,
      correctCount: dayLogs.filter(
        (log) => log.result === "good" || log.result === "easy",
      ).length,
    };
  });

  return {
    totalReviews: logs.length,
    correctRate: logs.length > 0 ? correctCount / logs.length : null,
    averageResponseTimeMs:
      responseTimes.length > 0
        ? Math.round(
            responseTimes.reduce((total, value) => total + value, 0) /
              responseTimes.length,
          )
        : null,
    reviewTypeBreakdown,
    sevenDayTrend,
  };
}

function buildLearningRecommendations({
  weakKnowledgeItems,
  logs,
  hooks,
}: {
  weakKnowledgeItems: WeakKnowledgeItemStat[];
  logs: Awaited<ReturnType<typeof listReviewLogsForUser>>;
  hooks: Awaited<ReturnType<typeof listAccessibleMemoryHooks>>;
}) {
  const recommendations = [];
  const applicationWeakCount = logs.filter(
    (log) =>
      log.reviewItem.type === "application" &&
      (log.result === "again" || log.result === "hard"),
  ).length;
  const userHookCount = hooks.length;

  if (weakKnowledgeItems.length > 0) {
    recommendations.push({
      id: "weak-review",
      label: "先做错题重练",
      description: `当前有 ${weakKnowledgeItems.length} 条知识项需要补弱，优先用 Again/Hard 队列回收。`,
      href: "/review?mode=weak",
      priority: "high" as const,
    });
  }

  if (applicationWeakCount > 0) {
    recommendations.push({
      id: "application-focus",
      label: "补场景应用",
      description: "Application 题里出现困难，先回看典型场景和什么时候不能用。",
      href: "/knowledge-items?tag=application",
      priority: "medium" as const,
    });
  }

  if (userHookCount < Math.max(1, weakKnowledgeItems.length)) {
    recommendations.push({
      id: "memory-hooks",
      label: "补下次提示",
      description: "薄弱知识项最好写一句自己的提醒，卡住时会优先看到它。",
      href: "/memory-hooks",
      priority: "medium" as const,
    });
  }

  recommendations.push({
    id: "deep-dive",
    label: "练一次理解",
    description: "对会背但不会用的知识项，用结构拆解把条件和用法重新连起来。",
    href: "/deep-dive",
    priority: "low" as const,
  });

  return recommendations.slice(0, 4);
}

function inferWeakPoint({
  latestResult,
  againCount,
  hardCount,
  memoryHookCount,
  memoryStrength,
}: {
  latestResult: "again" | "hard" | "good" | "easy" | null;
  againCount: number;
  hardCount: number;
  memoryHookCount: number;
  memoryStrength?: number;
}): WeakKnowledgeItemStat["weakPoint"] {
  if (againCount > 0 || latestResult === "again" || (memoryStrength ?? 1) < 0.25) {
    return "retention";
  }

  if (hardCount > 0 || latestResult === "hard") {
    return memoryHookCount === 0 ? "concept" : "boundary";
  }

  return "application";
}

function getRecommendedAction(weakPoint: WeakKnowledgeItemStat["weakPoint"]) {
  switch (weakPoint) {
    case "retention":
      return "先看一条提示，再做一次主动回忆。";
    case "concept":
      return "补一条下次提示，把知识项用途压成自己的话。";
    case "boundary":
      return "优先看什么时候不能用和常见误用。";
    case "application":
    default:
      return "回看典型场景，再做一题场景应用。";
  }
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
