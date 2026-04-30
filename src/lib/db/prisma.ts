import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const PRISMA_CLIENT_SCHEMA_SIGNATURE = "2026-04-30-question-practice-schema";
const REQUIRED_PRISMA_DELEGATES = [
  "knowledgeDedupeRun",
  "knowledgeDedupeCandidate",
  "adminBulkGenerateImportRun",
  "adminBulkGenerateImportRow",
  "question",
  "questionKnowledgeItem",
  "questionAttempt",
] as const;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaSignature?: string;
};

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? "",
});

const existingPrisma = globalForPrisma.prisma;
const reuseExistingPrisma = shouldReusePrismaClient({
  client: existingPrisma,
  storedSignature: globalForPrisma.prismaSchemaSignature,
  currentSignature: PRISMA_CLIENT_SCHEMA_SIGNATURE,
});

export const prisma = reuseExistingPrisma
  ? (existingPrisma as PrismaClient)
  : new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaSignature = PRISMA_CLIENT_SCHEMA_SIGNATURE;
}

export function shouldReusePrismaClient({
  client,
  storedSignature,
  currentSignature,
}: {
  client?: unknown;
  storedSignature?: string;
  currentSignature: string;
}) {
  return (
    storedSignature === currentSignature && hasRequiredPrismaDelegates(client)
  );
}

export function hasRequiredPrismaDelegates(client: unknown) {
  if (!client || typeof client !== "object") {
    return false;
  }

  const record = client as Record<string, unknown>;

  return REQUIRED_PRISMA_DELEGATES.every(
    (delegate) => record[delegate] !== undefined,
  );
}
