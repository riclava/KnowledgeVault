import { prisma } from "@/lib/db/prisma";

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export type KnowledgeDedupeMergeInput = {
  canonicalKnowledgeItemId: string;
  mergedKnowledgeItemIds: string[];
};

export type KnowledgeDedupeUserStateMergeInput = {
  memoryStrength: number;
  stability: number;
  difficultyEstimate: number;
  lastReviewedAt: Date | null;
  nextReviewAt: Date | null;
  totalReviews: number;
  correctReviews: number;
  lapseCount: number;
  consecutiveCorrect: number;
};

export function normalizeKnowledgeDedupeMergeInput(
  input: unknown,
): KnowledgeDedupeMergeInput {
  const record = isRecord(input) ? input : {};
  const canonicalKnowledgeItemId = text(record.canonicalKnowledgeItemId);
  const mergedKnowledgeItemIds = unique(
    Array.isArray(record.mergedKnowledgeItemIds)
      ? record.mergedKnowledgeItemIds.map(text).filter(Boolean)
      : [],
  ).filter((id) => id !== canonicalKnowledgeItemId);

  if (!canonicalKnowledgeItemId) {
    throw new Error("保留知识项不能为空。");
  }

  if (mergedKnowledgeItemIds.length === 0) {
    throw new Error("请选择要合并的重复知识项。");
  }

  return {
    canonicalKnowledgeItemId,
    mergedKnowledgeItemIds,
  };
}

export function mergeKnowledgeDedupeArrays(
  canonicalValues: string[],
  duplicateValues: string[],
) {
  return unique([...canonicalValues, ...duplicateValues].map(text).filter(Boolean));
}

export function mergeKnowledgeDedupeUserState(
  canonical: KnowledgeDedupeUserStateMergeInput,
  duplicate: KnowledgeDedupeUserStateMergeInput,
) {
  const duplicateIsNewer =
    duplicate.lastReviewedAt !== null &&
    (canonical.lastReviewedAt === null ||
      duplicate.lastReviewedAt > canonical.lastReviewedAt);
  const preferred = duplicateIsNewer ? duplicate : canonical;

  return {
    memoryStrength: preferred.memoryStrength,
    stability: preferred.stability,
    difficultyEstimate: preferred.difficultyEstimate,
    lastReviewedAt: maxDate(canonical.lastReviewedAt, duplicate.lastReviewedAt),
    nextReviewAt: minDate(canonical.nextReviewAt, duplicate.nextReviewAt),
    totalReviews: canonical.totalReviews + duplicate.totalReviews,
    correctReviews: canonical.correctReviews + duplicate.correctReviews,
    lapseCount: canonical.lapseCount + duplicate.lapseCount,
    consecutiveCorrect: Math.max(
      canonical.consecutiveCorrect,
      duplicate.consecutiveCorrect,
    ),
  };
}

export function replaceDiagnosticKnowledgeItemIds(
  ids: string[],
  replacementById: Map<string, string>,
) {
  return unique(ids.map((id) => replacementById.get(id) ?? id).filter(Boolean));
}

export async function mergeKnowledgeDedupeCandidateForAdmin({
  candidateId,
  input,
}: {
  candidateId: string;
  input: unknown;
}) {
  const mergeInput = normalizeKnowledgeDedupeMergeInput(input);

  return prisma.$transaction(async (tx) => {
    const candidate = await tx.knowledgeDedupeCandidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      return { ok: false as const, error: "去重候选不存在。" };
    }

    if (candidate.status !== "pending") {
      return { ok: false as const, error: "该去重候选已经处理。" };
    }

    const candidateItemIds = new Set(candidate.knowledgeItemIds);
    const requestedIds = [
      mergeInput.canonicalKnowledgeItemId,
      ...mergeInput.mergedKnowledgeItemIds,
    ];

    if (requestedIds.some((id) => !candidateItemIds.has(id))) {
      return { ok: false as const, error: "合并项必须来自当前候选组。" };
    }

    const items = await tx.knowledgeItem.findMany({
      where: {
        id: { in: requestedIds },
        visibility: "public",
      },
    });

    if (items.length !== requestedIds.length) {
      await tx.knowledgeDedupeCandidate.update({
        where: { id: candidateId },
        data: { status: "stale" },
      });

      return { ok: false as const, error: "候选知识项已经变化，请重新扫描。" };
    }

    const canonical = items.find(
      (item) => item.id === mergeInput.canonicalKnowledgeItemId,
    );

    if (!canonical) {
      return { ok: false as const, error: "保留知识项不存在。" };
    }

    await mergeKnowledgeItemContent({
      tx,
      canonical,
      duplicates: items.filter((item) =>
        mergeInput.mergedKnowledgeItemIds.includes(item.id),
      ),
    });

    await mergeKnowledgeItemVariables({
      tx,
      canonicalKnowledgeItemId: canonical.id,
      duplicateKnowledgeItemIds: mergeInput.mergedKnowledgeItemIds,
    });
    await mergeKnowledgeItemReviewItems({
      tx,
      canonicalKnowledgeItemId: canonical.id,
      duplicateKnowledgeItemIds: mergeInput.mergedKnowledgeItemIds,
    });
    await mergeKnowledgeItemRelations({
      tx,
      canonicalKnowledgeItemId: canonical.id,
      duplicateKnowledgeItemIds: mergeInput.mergedKnowledgeItemIds,
    });
    await tx.reviewLog.updateMany({
      where: { knowledgeItemId: { in: mergeInput.mergedKnowledgeItemIds } },
      data: { knowledgeItemId: canonical.id },
    });
    await mergeKnowledgeItemUserStates({
      tx,
      canonicalKnowledgeItemId: canonical.id,
      duplicateKnowledgeItemIds: mergeInput.mergedKnowledgeItemIds,
    });
    await mergeKnowledgeItemMemoryHooks({
      tx,
      canonicalKnowledgeItemId: canonical.id,
      duplicateKnowledgeItemIds: mergeInput.mergedKnowledgeItemIds,
    });
    await mergeDiagnosticAttempts({
      tx,
      canonicalKnowledgeItemId: canonical.id,
      duplicateKnowledgeItemIds: mergeInput.mergedKnowledgeItemIds,
    });
    await tx.knowledgeItem.deleteMany({
      where: { id: { in: mergeInput.mergedKnowledgeItemIds } },
    });
    await tx.knowledgeDedupeCandidate.update({
      where: { id: candidateId },
      data: {
        status: "merged",
        mergedIntoKnowledgeItemId: canonical.id,
        mergedKnowledgeItemIds: mergeInput.mergedKnowledgeItemIds,
      },
    });

    return {
      ok: true as const,
      canonicalKnowledgeItemId: canonical.id,
      mergedKnowledgeItemIds: mergeInput.mergedKnowledgeItemIds,
    };
  });
}

async function mergeKnowledgeItemContent({
  tx,
  canonical,
  duplicates,
}: {
  tx: TransactionClient;
  canonical: {
    id: string;
    tags: string[];
    examples: string[];
    useConditions: string[];
    nonUseConditions: string[];
    antiPatterns: string[];
    typicalProblems: string[];
  };
  duplicates: Array<{
    tags: string[];
    examples: string[];
    useConditions: string[];
    nonUseConditions: string[];
    antiPatterns: string[];
    typicalProblems: string[];
  }>;
}) {
  await tx.knowledgeItem.update({
    where: { id: canonical.id },
    data: {
      tags: mergeKnowledgeDedupeArrays(
        canonical.tags,
        duplicates.flatMap((item) => item.tags),
      ),
      examples: mergeKnowledgeDedupeArrays(
        canonical.examples,
        duplicates.flatMap((item) => item.examples),
      ),
      useConditions: mergeKnowledgeDedupeArrays(
        canonical.useConditions,
        duplicates.flatMap((item) => item.useConditions),
      ),
      nonUseConditions: mergeKnowledgeDedupeArrays(
        canonical.nonUseConditions,
        duplicates.flatMap((item) => item.nonUseConditions),
      ),
      antiPatterns: mergeKnowledgeDedupeArrays(
        canonical.antiPatterns,
        duplicates.flatMap((item) => item.antiPatterns),
      ),
      typicalProblems: mergeKnowledgeDedupeArrays(
        canonical.typicalProblems,
        duplicates.flatMap((item) => item.typicalProblems),
      ),
    },
  });
}

async function mergeKnowledgeItemVariables({
  tx,
  canonicalKnowledgeItemId,
  duplicateKnowledgeItemIds,
}: {
  tx: TransactionClient;
  canonicalKnowledgeItemId: string;
  duplicateKnowledgeItemIds: string[];
}) {
  const canonicalVariables = await tx.knowledgeItemVariable.findMany({
    where: { knowledgeItemId: canonicalKnowledgeItemId },
    select: { symbol: true },
  });
  const canonicalSymbols = new Set(canonicalVariables.map((variable) => variable.symbol));
  const duplicateVariables = await tx.knowledgeItemVariable.findMany({
    where: { knowledgeItemId: { in: duplicateKnowledgeItemIds } },
    select: { id: true, symbol: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  for (const variable of duplicateVariables) {
    if (canonicalSymbols.has(variable.symbol)) {
      await tx.knowledgeItemVariable.delete({ where: { id: variable.id } });
      continue;
    }

    canonicalSymbols.add(variable.symbol);
    await tx.knowledgeItemVariable.update({
      where: { id: variable.id },
      data: { knowledgeItemId: canonicalKnowledgeItemId },
    });
  }
}

async function mergeKnowledgeItemReviewItems({
  tx,
  canonicalKnowledgeItemId,
  duplicateKnowledgeItemIds,
}: {
  tx: TransactionClient;
  canonicalKnowledgeItemId: string;
  duplicateKnowledgeItemIds: string[];
}) {
  const canonicalReviewItems = await tx.reviewItem.findMany({
    where: { knowledgeItemId: canonicalKnowledgeItemId },
    select: { prompt: true },
  });
  const canonicalPrompts = new Set(
    canonicalReviewItems.map((reviewItem) => reviewItem.prompt.trim()),
  );
  const duplicateReviewItems = await tx.reviewItem.findMany({
    where: { knowledgeItemId: { in: duplicateKnowledgeItemIds } },
    select: {
      id: true,
      prompt: true,
      isActive: true,
      _count: { select: { reviewLogs: true } },
    },
  });

  for (const reviewItem of duplicateReviewItems) {
    const prompt = reviewItem.prompt.trim();
    const shouldMove =
      reviewItem._count.reviewLogs > 0 ||
      (reviewItem.isActive && !canonicalPrompts.has(prompt));

    if (shouldMove) {
      canonicalPrompts.add(prompt);
      await tx.reviewItem.update({
        where: { id: reviewItem.id },
        data: { knowledgeItemId: canonicalKnowledgeItemId },
      });
      continue;
    }

    await tx.reviewItem.delete({ where: { id: reviewItem.id } });
  }
}

async function mergeKnowledgeItemRelations({
  tx,
  canonicalKnowledgeItemId,
  duplicateKnowledgeItemIds,
}: {
  tx: TransactionClient;
  canonicalKnowledgeItemId: string;
  duplicateKnowledgeItemIds: string[];
}) {
  const relations = await tx.knowledgeItemRelation.findMany({
    where: {
      OR: [
        { fromKnowledgeItemId: { in: duplicateKnowledgeItemIds } },
        { toKnowledgeItemId: { in: duplicateKnowledgeItemIds } },
      ],
    },
  });

  for (const relation of relations) {
    const fromKnowledgeItemId = duplicateKnowledgeItemIds.includes(
      relation.fromKnowledgeItemId,
    )
      ? canonicalKnowledgeItemId
      : relation.fromKnowledgeItemId;
    const toKnowledgeItemId = duplicateKnowledgeItemIds.includes(
      relation.toKnowledgeItemId,
    )
      ? canonicalKnowledgeItemId
      : relation.toKnowledgeItemId;

    if (fromKnowledgeItemId === toKnowledgeItemId) {
      await tx.knowledgeItemRelation.delete({ where: { id: relation.id } });
      continue;
    }

    const existing = await tx.knowledgeItemRelation.findFirst({
      where: {
        fromKnowledgeItemId,
        toKnowledgeItemId,
        relationType: relation.relationType,
      },
      select: { id: true },
    });

    if (existing && existing.id !== relation.id) {
      await tx.knowledgeItemRelation.delete({ where: { id: relation.id } });
      continue;
    }

    await tx.knowledgeItemRelation.update({
      where: { id: relation.id },
      data: { fromKnowledgeItemId, toKnowledgeItemId },
    });
  }
}

async function mergeKnowledgeItemUserStates({
  tx,
  canonicalKnowledgeItemId,
  duplicateKnowledgeItemIds,
}: {
  tx: TransactionClient;
  canonicalKnowledgeItemId: string;
  duplicateKnowledgeItemIds: string[];
}) {
  const duplicateStates = await tx.userKnowledgeItemState.findMany({
    where: { knowledgeItemId: { in: duplicateKnowledgeItemIds } },
  });

  for (const duplicateState of duplicateStates) {
    const canonicalState = await tx.userKnowledgeItemState.findUnique({
      where: {
        userId_knowledgeItemId: {
          userId: duplicateState.userId,
          knowledgeItemId: canonicalKnowledgeItemId,
        },
      },
    });

    if (!canonicalState) {
      await tx.userKnowledgeItemState.update({
        where: { id: duplicateState.id },
        data: { knowledgeItemId: canonicalKnowledgeItemId },
      });
      continue;
    }

    await tx.userKnowledgeItemState.update({
      where: { id: canonicalState.id },
      data: mergeKnowledgeDedupeUserState(canonicalState, duplicateState),
    });
    await tx.userKnowledgeItemState.delete({ where: { id: duplicateState.id } });
  }
}

async function mergeKnowledgeItemMemoryHooks({
  tx,
  canonicalKnowledgeItemId,
  duplicateKnowledgeItemIds,
}: {
  tx: TransactionClient;
  canonicalKnowledgeItemId: string;
  duplicateKnowledgeItemIds: string[];
}) {
  const duplicateHooks = await tx.knowledgeItemMemoryHook.findMany({
    where: { knowledgeItemId: { in: duplicateKnowledgeItemIds } },
  });

  for (const duplicateHook of duplicateHooks) {
    const canonicalHook = await tx.knowledgeItemMemoryHook.findUnique({
      where: {
        userId_knowledgeItemId: {
          userId: duplicateHook.userId,
          knowledgeItemId: canonicalKnowledgeItemId,
        },
      },
    });

    if (!canonicalHook) {
      await tx.knowledgeItemMemoryHook.update({
        where: { id: duplicateHook.id },
        data: { knowledgeItemId: canonicalKnowledgeItemId },
      });
      continue;
    }

    await tx.reviewLog.updateMany({
      where: { memoryHookUsedId: duplicateHook.id },
      data: { memoryHookUsedId: canonicalHook.id },
    });
    await tx.knowledgeItemMemoryHook.update({
      where: { id: canonicalHook.id },
      data: {
        content: `${canonicalHook.content}\n\n---\n\n${duplicateHook.content}`,
      },
    });
    await tx.knowledgeItemMemoryHook.delete({ where: { id: duplicateHook.id } });
  }
}

async function mergeDiagnosticAttempts({
  tx,
  canonicalKnowledgeItemId,
  duplicateKnowledgeItemIds,
}: {
  tx: TransactionClient;
  canonicalKnowledgeItemId: string;
  duplicateKnowledgeItemIds: string[];
}) {
  const replacementById = new Map(
    duplicateKnowledgeItemIds.map((id) => [id, canonicalKnowledgeItemId]),
  );
  const attempts = await tx.diagnosticAttempt.findMany({
    where: { weakKnowledgeItemIds: { hasSome: duplicateKnowledgeItemIds } },
    select: { id: true, weakKnowledgeItemIds: true },
  });

  for (const attempt of attempts) {
    await tx.diagnosticAttempt.update({
      where: { id: attempt.id },
      data: {
        weakKnowledgeItemIds: replaceDiagnosticKnowledgeItemIds(
          attempt.weakKnowledgeItemIds,
          replacementById,
        ),
      },
    });
  }
}

function maxDate(first: Date | null, second: Date | null) {
  if (!first) {
    return second;
  }

  if (!second) {
    return first;
  }

  return first > second ? first : second;
}

function minDate(first: Date | null, second: Date | null) {
  if (!first) {
    return second;
  }

  if (!second) {
    return first;
  }

  return first < second ? first : second;
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}
