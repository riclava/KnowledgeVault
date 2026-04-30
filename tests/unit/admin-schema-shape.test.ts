import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const baseline = readFileSync(
  "prisma/migrations/00000000000000_dev_baseline/migration.sql",
  "utf8",
);

describe("admin schema shape", () => {
  it("adds structured knowledge item content types", () => {
    assert.match(
      schema,
      /enum KnowledgeItemType\s*{\s*math_formula\s*vocabulary\s*plain_text\s*concept_card\s*comparison_table\s*procedure\s*}/s,
    );
    assert.match(
      baseline,
      /CREATE TYPE "KnowledgeItemType" AS ENUM \('math_formula', 'vocabulary', 'plain_text', 'concept_card', 'comparison_table', 'procedure'\)/,
    );
  });

  it("adds database roles and import-run tracking", () => {
    assert.match(schema, /enum UserRole\s*{\s*learner\s*admin\s*}/s);
    assert.match(schema, /role\s+UserRole\s+@default\(learner\)/);
    assert.match(schema, /enum AdminImportStatus\s*{\s*validation_failed\s*saved\s*ai_failed\s*}/s);
    assert.match(schema, /model AdminImportRun\s*{/);
    assert.match(schema, /adminUser\s+User\s+@relation/);
  });

  it("updates the development baseline directly", () => {
    assert.match(baseline, /CREATE TYPE "UserRole" AS ENUM \('learner', 'admin'\)/);
    assert.match(baseline, /"role" "UserRole" NOT NULL DEFAULT 'learner'/);
    assert.match(baseline, /CREATE TYPE "AdminImportStatus" AS ENUM/);
    assert.match(
      baseline,
      /CREATE TYPE "AdminImportStatus" AS ENUM \('validation_failed', 'saved', 'ai_failed'\)/,
    );
    assert.match(baseline, /CREATE TABLE "admin_import_runs"/);
    assert.match(baseline, /admin_import_runs_adminUserId_createdAt_idx/);
  });

  it("simplifies knowledge items and removes embedded review models", () => {
    assert.doesNotMatch(schema, /intuition\s+String\?/);
    assert.doesNotMatch(schema, /deepDive\s+String\?/);
    assert.doesNotMatch(schema, /useConditions\s+String\[\]/);
    assert.doesNotMatch(schema, /nonUseConditions\s+String\[\]/);
    assert.doesNotMatch(schema, /antiPatterns\s+String\[\]/);
    assert.doesNotMatch(schema, /typicalProblems\s+String\[\]/);
    assert.doesNotMatch(schema, /model KnowledgeItemVariable\s*{/);
    assert.doesNotMatch(schema, /model ReviewItem\s*{/);
    assert.doesNotMatch(schema, /model ReviewLog\s*{/);
    assert.match(schema, /questionBindings\s+QuestionKnowledgeItem\[\]/);
    assert.doesNotMatch(baseline, /"intuition"/);
    assert.doesNotMatch(baseline, /CREATE TABLE "knowledge_item_variables"/);
    assert.doesNotMatch(baseline, /CREATE TABLE "review_items"/);
    assert.doesNotMatch(baseline, /CREATE TABLE "review_logs"/);
  });

  it("adds independent questions and knowledge bindings", () => {
    assert.match(
      schema,
      /enum QuestionType\s*{\s*single_choice\s*multiple_choice\s*true_false\s*fill_blank\s*short_answer\s*}/s,
    );
    assert.match(schema, /enum QuestionGradingMode\s*{\s*rule\s*ai\s*}/s);
    assert.match(
      schema,
      /enum QuestionAttemptResult\s*{\s*correct\s*partial\s*incorrect\s*}/s,
    );
    assert.match(schema, /model Question\s*{/);
    assert.match(schema, /model QuestionKnowledgeItem\s*{/);
    assert.match(schema, /model QuestionAttempt\s*{/);
    assert.match(
      baseline,
      /CREATE TYPE "QuestionType" AS ENUM \('single_choice', 'multiple_choice', 'true_false', 'fill_blank', 'short_answer'\)/,
    );
    assert.match(baseline, /CREATE TABLE "questions"/);
    assert.match(baseline, /CREATE TABLE "question_knowledge_items"/);
    assert.match(baseline, /CREATE TABLE "question_attempts"/);
  });

  it("adds public knowledge dedupe run and candidate tracking", () => {
    assert.match(
      schema,
      /enum KnowledgeDedupeRunStatus\s*{\s*running\s*completed\s*failed\s*}/s,
    );
    assert.match(
      schema,
      /enum KnowledgeDedupeCandidateStatus\s*{\s*pending\s*merged\s*ignored\s*stale\s*}/s,
    );
    assert.match(schema, /model KnowledgeDedupeRun\s*{/);
    assert.match(schema, /model KnowledgeDedupeCandidate\s*{/);
    assert.match(schema, /@@map\("knowledge_dedupe_runs"\)/);
    assert.match(schema, /@@map\("knowledge_dedupe_candidates"\)/);
    assert.match(
      baseline,
      /CREATE TYPE "KnowledgeDedupeRunStatus" AS ENUM \('running', 'completed', 'failed'\)/,
    );
    assert.match(baseline, /CREATE TABLE "knowledge_dedupe_runs"/);
    assert.match(baseline, /CREATE TABLE "knowledge_dedupe_candidates"/);
    assert.match(baseline, /knowledge_dedupe_runs_adminUserId_createdAt_idx/);
  });

  it("adds backend-owned bulk generate import progress tracking", () => {
    assert.match(
      schema,
      /enum AdminBulkGenerateImportRunStatus\s*{\s*pending\s*running\s*completed\s*failed\s*canceled\s*}/s,
    );
    assert.match(
      schema,
      /enum AdminBulkGenerateImportRowStatus\s*{\s*pending\s*processing\s*imported\s*duplicate_skipped\s*ai_failed\s*validation_failed\s*save_failed\s*canceled\s*}/s,
    );
    assert.match(schema, /model AdminBulkGenerateImportRun\s*{/);
    assert.match(schema, /model AdminBulkGenerateImportRow\s*{/);
    assert.match(schema, /@@map\("admin_bulk_generate_import_runs"\)/);
    assert.match(schema, /@@map\("admin_bulk_generate_import_rows"\)/);
    assert.match(schema, /bulkGenerateImportRuns\s+AdminBulkGenerateImportRun\[\]/);
    assert.match(
      baseline,
      /CREATE TYPE "AdminBulkGenerateImportRunStatus" AS ENUM \('pending', 'running', 'completed', 'failed', 'canceled'\)/,
    );
    assert.match(
      baseline,
      /CREATE TYPE "AdminBulkGenerateImportRowStatus" AS ENUM \('pending', 'processing', 'imported', 'duplicate_skipped', 'ai_failed', 'validation_failed', 'save_failed', 'canceled'\)/,
    );
    assert.match(baseline, /CREATE TABLE "admin_bulk_generate_import_runs"/);
    assert.match(baseline, /CREATE TABLE "admin_bulk_generate_import_rows"/);
    assert.match(baseline, /admin_bulk_generate_import_runs_adminUserId_createdAt_idx/);
    assert.match(baseline, /admin_bulk_generate_import_rows_runId_lineNumber_key/);
  });
});
