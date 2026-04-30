-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "KnowledgeItemRelationType" AS ENUM ('prerequisite', 'related', 'confusable', 'application_of');

-- CreateEnum
CREATE TYPE "KnowledgeItemType" AS ENUM ('math_formula', 'vocabulary', 'plain_text', 'concept_card', 'comparison_table', 'procedure');

-- CreateEnum
CREATE TYPE "StudySessionStatus" AS ENUM ('active', 'completed', 'abandoned');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('learner', 'admin');

-- CreateEnum
CREATE TYPE "AdminImportStatus" AS ENUM ('validation_failed', 'saved', 'ai_failed');

-- CreateEnum
CREATE TYPE "KnowledgeItemVisibility" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "KnowledgeDedupeRunStatus" AS ENUM ('running', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "KnowledgeDedupeCandidateStatus" AS ENUM ('pending', 'merged', 'ignored', 'stale');

-- CreateEnum
CREATE TYPE "AdminBulkGenerateImportRunStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'canceled');

-- CreateEnum
CREATE TYPE "AdminBulkGenerateImportRowStatus" AS ENUM ('pending', 'processing', 'imported', 'duplicate_skipped', 'ai_failed', 'validation_failed', 'save_failed', 'canceled');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('single_choice', 'multiple_choice', 'true_false', 'fill_blank', 'short_answer');

-- CreateEnum
CREATE TYPE "QuestionGradingMode" AS ENUM ('rule', 'ai');

-- CreateEnum
CREATE TYPE "QuestionAttemptResult" AS ENUM ('correct', 'partial', 'incorrect');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "anonymousSessionId" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'learner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "learnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_items" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentType" "KnowledgeItemType" NOT NULL,
    "renderPayload" JSONB NOT NULL,
    "domain" TEXT NOT NULL,
    "subdomain" TEXT,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "tags" TEXT[],
    "extension" JSONB,
    "visibility" "KnowledgeItemVisibility" NOT NULL DEFAULT 'public',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_dedupe_runs" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "subdomain" TEXT,
    "threshold" DOUBLE PRECISION NOT NULL,
    "usedAiReview" BOOLEAN NOT NULL DEFAULT false,
    "status" "KnowledgeDedupeRunStatus" NOT NULL DEFAULT 'running',
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "warningMessage" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_dedupe_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_dedupe_candidates" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "knowledgeItemIds" TEXT[],
    "localScore" DOUBLE PRECISION NOT NULL,
    "localReasons" JSONB NOT NULL,
    "aiScore" DOUBLE PRECISION,
    "aiRecommendation" JSONB,
    "warningMessage" TEXT,
    "suggestedCanonicalItemId" TEXT,
    "status" "KnowledgeDedupeCandidateStatus" NOT NULL DEFAULT 'pending',
    "mergedIntoKnowledgeItemId" TEXT,
    "mergedKnowledgeItemIds" TEXT[],
    "ignoredReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_dedupe_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_item_relations" (
    "id" TEXT NOT NULL,
    "fromKnowledgeItemId" TEXT NOT NULL,
    "toKnowledgeItemId" TEXT NOT NULL,
    "relationType" "KnowledgeItemRelationType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_item_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_knowledge_item_states" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "knowledgeItemId" TEXT NOT NULL,
    "memoryStrength" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difficultyEstimate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3),
    "nextReviewAt" TIMESTAMP(3),
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "correctReviews" INTEGER NOT NULL DEFAULT 0,
    "lapseCount" INTEGER NOT NULL DEFAULT 0,
    "consecutiveCorrect" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_knowledge_item_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "questionIds" TEXT[],
    "weakKnowledgeItemIds" TEXT[],
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagnostic_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_item_memory_hooks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "knowledgeItemId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_item_memory_hooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" "StudySessionStatus" NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB,
    "answer" JSONB NOT NULL,
    "answerAliases" TEXT[],
    "explanation" TEXT,
    "difficulty" INTEGER NOT NULL,
    "tags" TEXT[],
    "gradingMode" "QuestionGradingMode" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "visibility" "KnowledgeItemVisibility" NOT NULL DEFAULT 'public',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_knowledge_items" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "knowledgeItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_knowledge_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "studySessionId" TEXT,
    "submittedAnswer" JSONB NOT NULL,
    "result" "QuestionAttemptResult" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "feedback" TEXT,
    "responseTimeMs" INTEGER,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_import_runs" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "sourceTitle" TEXT,
    "sourceExcerpt" TEXT NOT NULL,
    "defaultDomain" TEXT NOT NULL,
    "status" "AdminImportStatus" NOT NULL,
    "generatedCount" INTEGER NOT NULL DEFAULT 0,
    "savedCount" INTEGER NOT NULL DEFAULT 0,
    "validationErrors" JSONB,
    "aiOutput" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_bulk_generate_import_runs" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "contentType" "KnowledgeItemType" NOT NULL,
    "domain" TEXT NOT NULL,
    "subdomain" TEXT,
    "status" "AdminBulkGenerateImportRunStatus" NOT NULL DEFAULT 'pending',
    "totalCount" INTEGER NOT NULL,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateSkippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_bulk_generate_import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_bulk_generate_import_rows" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "sourceText" TEXT NOT NULL,
    "status" "AdminBulkGenerateImportRowStatus" NOT NULL DEFAULT 'pending',
    "generatedSlug" TEXT,
    "generatedTitle" TEXT,
    "savedKnowledgeItemId" TEXT,
    "duplicateWarnings" JSONB,
    "validationErrors" JSONB,
    "errorMessage" TEXT,
    "aiOutput" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_bulk_generate_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_anonymousSessionId_key" ON "users"("anonymousSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_email_key" ON "auth_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_learnerId_key" ON "auth_users"("learnerId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_key" ON "auth_sessions"("token");

-- CreateIndex
CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions"("userId");

-- CreateIndex
CREATE INDEX "auth_sessions_expiresAt_idx" ON "auth_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "auth_accounts_userId_idx" ON "auth_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_accounts_providerId_accountId_key" ON "auth_accounts"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications"("identifier");

-- CreateIndex
CREATE INDEX "auth_verifications_expiresAt_idx" ON "auth_verifications"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_items_slug_key" ON "knowledge_items"("slug");

-- CreateIndex
CREATE INDEX "knowledge_items_domain_subdomain_idx" ON "knowledge_items"("domain", "subdomain");

-- CreateIndex
CREATE INDEX "knowledge_items_contentType_idx" ON "knowledge_items"("contentType");

-- CreateIndex
CREATE INDEX "knowledge_items_visibility_createdByUserId_idx" ON "knowledge_items"("visibility", "createdByUserId");

-- CreateIndex
CREATE INDEX "knowledge_dedupe_runs_domain_subdomain_idx" ON "knowledge_dedupe_runs"("domain", "subdomain");

-- CreateIndex
CREATE INDEX "knowledge_dedupe_runs_adminUserId_createdAt_idx" ON "knowledge_dedupe_runs"("adminUserId", "createdAt");

-- CreateIndex
CREATE INDEX "knowledge_dedupe_candidates_runId_status_idx" ON "knowledge_dedupe_candidates"("runId", "status");

-- CreateIndex
CREATE INDEX "knowledge_item_relations_toKnowledgeItemId_idx" ON "knowledge_item_relations"("toKnowledgeItemId");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_item_relations_fromKnowledgeItemId_toKnowledgeIte_key" ON "knowledge_item_relations"("fromKnowledgeItemId", "toKnowledgeItemId", "relationType");

-- CreateIndex
CREATE INDEX "user_knowledge_item_states_knowledgeItemId_idx" ON "user_knowledge_item_states"("knowledgeItemId");

-- CreateIndex
CREATE UNIQUE INDEX "user_knowledge_item_states_userId_knowledgeItemId_key" ON "user_knowledge_item_states"("userId", "knowledgeItemId");

-- CreateIndex
CREATE INDEX "diagnostic_attempts_userId_completedAt_idx" ON "diagnostic_attempts"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "knowledge_item_memory_hooks_knowledgeItemId_idx" ON "knowledge_item_memory_hooks"("knowledgeItemId");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_item_memory_hooks_userId_knowledgeItemId_key" ON "knowledge_item_memory_hooks"("userId", "knowledgeItemId");

-- CreateIndex
CREATE INDEX "study_sessions_userId_startedAt_idx" ON "study_sessions"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "questions_type_idx" ON "questions"("type");

-- CreateIndex
CREATE INDEX "questions_difficulty_idx" ON "questions"("difficulty");

-- CreateIndex
CREATE INDEX "questions_visibility_createdByUserId_idx" ON "questions"("visibility", "createdByUserId");

-- CreateIndex
CREATE INDEX "question_knowledge_items_knowledgeItemId_idx" ON "question_knowledge_items"("knowledgeItemId");

-- CreateIndex
CREATE UNIQUE INDEX "question_knowledge_items_questionId_knowledgeItemId_key" ON "question_knowledge_items"("questionId", "knowledgeItemId");

-- CreateIndex
CREATE INDEX "question_attempts_userId_reviewedAt_idx" ON "question_attempts"("userId", "reviewedAt");

-- CreateIndex
CREATE INDEX "question_attempts_questionId_idx" ON "question_attempts"("questionId");

-- CreateIndex
CREATE INDEX "admin_import_runs_adminUserId_createdAt_idx" ON "admin_import_runs"("adminUserId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_import_runs_status_createdAt_idx" ON "admin_import_runs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "admin_bulk_generate_import_runs_adminUserId_createdAt_idx" ON "admin_bulk_generate_import_runs"("adminUserId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_bulk_generate_import_runs_status_createdAt_idx" ON "admin_bulk_generate_import_runs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "admin_bulk_generate_import_rows_runId_status_idx" ON "admin_bulk_generate_import_rows"("runId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "admin_bulk_generate_import_rows_runId_lineNumber_key" ON "admin_bulk_generate_import_rows"("runId", "lineNumber");

-- AddForeignKey
ALTER TABLE "auth_users" ADD CONSTRAINT "auth_users_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_dedupe_runs" ADD CONSTRAINT "knowledge_dedupe_runs_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_dedupe_candidates" ADD CONSTRAINT "knowledge_dedupe_candidates_runId_fkey" FOREIGN KEY ("runId") REFERENCES "knowledge_dedupe_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_item_relations" ADD CONSTRAINT "knowledge_item_relations_fromKnowledgeItemId_fkey" FOREIGN KEY ("fromKnowledgeItemId") REFERENCES "knowledge_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_item_relations" ADD CONSTRAINT "knowledge_item_relations_toKnowledgeItemId_fkey" FOREIGN KEY ("toKnowledgeItemId") REFERENCES "knowledge_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_knowledge_item_states" ADD CONSTRAINT "user_knowledge_item_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_knowledge_item_states" ADD CONSTRAINT "user_knowledge_item_states_knowledgeItemId_fkey" FOREIGN KEY ("knowledgeItemId") REFERENCES "knowledge_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_attempts" ADD CONSTRAINT "diagnostic_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_item_memory_hooks" ADD CONSTRAINT "knowledge_item_memory_hooks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_item_memory_hooks" ADD CONSTRAINT "knowledge_item_memory_hooks_knowledgeItemId_fkey" FOREIGN KEY ("knowledgeItemId") REFERENCES "knowledge_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_knowledge_items" ADD CONSTRAINT "question_knowledge_items_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_knowledge_items" ADD CONSTRAINT "question_knowledge_items_knowledgeItemId_fkey" FOREIGN KEY ("knowledgeItemId") REFERENCES "knowledge_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_studySessionId_fkey" FOREIGN KEY ("studySessionId") REFERENCES "study_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_import_runs" ADD CONSTRAINT "admin_import_runs_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_bulk_generate_import_runs" ADD CONSTRAINT "admin_bulk_generate_import_runs_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_bulk_generate_import_rows" ADD CONSTRAINT "admin_bulk_generate_import_rows_runId_fkey" FOREIGN KEY ("runId") REFERENCES "admin_bulk_generate_import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
