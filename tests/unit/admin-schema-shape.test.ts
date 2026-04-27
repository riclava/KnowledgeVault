import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const baseline = readFileSync(
  "prisma/migrations/00000000000000_dev_baseline/migration.sql",
  "utf8",
);

describe("admin schema shape", () => {
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
    assert.match(baseline, /CREATE TABLE "admin_import_runs"/);
    assert.match(baseline, /admin_import_runs_adminUserId_createdAt_idx/);
  });
});
