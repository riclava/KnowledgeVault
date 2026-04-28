import type { Prisma } from "@/generated/prisma/client";

export type KnowledgeItemWriteScope =
  | { scope: "admin" }
  | { scope: "learner"; userId: string };

export function buildKnowledgeItemVisibilityWhere(
  userId?: string,
): Prisma.KnowledgeItemWhereInput {
  if (!userId) {
    return { visibility: "public" };
  }

  return {
    OR: [
      { visibility: "public" },
      { visibility: "private", createdByUserId: userId },
    ],
  };
}

export function buildOwnedKnowledgeItemData(scope: KnowledgeItemWriteScope) {
  if (scope.scope === "learner") {
    return {
      visibility: "private" as const,
      createdByUserId: scope.userId,
    };
  }

  return {
    visibility: "public" as const,
    createdByUserId: null,
  };
}
