import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

const removedFeaturePaths = [
  "src/app/content-assist",
  "src/app/deep-dive",
  "src/app/knowledge-items/page.tsx",
  "src/app/knowledge-items/new",
  "src/app/memory-hooks",
  "src/app/paths",
  "src/app/summary",
  "src/app/api/content-assist",
  "src/app/api/knowledge-items/route.ts",
  "src/app/api/knowledge-items/draft",
  "src/app/api/diagnostic/result",
  "src/app/api/review/session",
  "src/app/api/users/me",
  "src/app/api/stats",
  "src/components/content-assist",
  "src/components/deep-dive",
  "src/components/app/phase-tools-menu.tsx",
  "src/components/knowledge-item/latex-renderer.tsx",
  "src/components/knowledge-item/custom-knowledge-item-form.tsx",
  "src/components/memory-hooks/memory-hook-workspace.tsx",
  "src/components/summary",
  "src/components/ui/separator.tsx",
  "src/server/services/content-assist-service.ts",
  "src/server/services/knowledge-item-draft-service.ts",
  "src/server/services/openai-compatible-client.ts",
  "src/server/services/stats-service.ts",
  "src/server/repositories/stats-repository.ts",
  "src/types/content-assist.ts",
  "src/types/stats.ts",
  "public/file.svg",
  "public/globe.svg",
  "public/next.svg",
  "public/vercel.svg",
  "public/window.svg",
];

const removedNavCopy = [
  "更多工具",
  "复习总结",
  "学习路径",
  "深入理解",
  "内容辅助",
  "整理下次提示",
  "新建知识项",
  "知识项库",
];

describe("review-first mainline scope", () => {
  it("removes non-mainline feature surfaces", () => {
    for (const path of removedFeaturePaths) {
      assert.equal(
        existsSync(join(root, path)),
        false,
        `${path} should be removed from the product surface`,
      );
    }
  });

  it("removes service exports that only backed removed utility APIs", () => {
    const diagnosticService = readFileSync(
      join(root, "src/server/services/diagnostic-service.ts"),
      "utf8",
    );
    const diagnosticRepository = readFileSync(
      join(root, "src/server/repositories/diagnostic-repository.ts"),
      "utf8",
    );
    const reviewService = readFileSync(
      join(root, "src/server/services/review-service.ts"),
      "utf8",
    );
    const reviewTypes = readFileSync(join(root, "src/types/review.ts"), "utf8");

    assert.doesNotMatch(diagnosticService, /getLatestDiagnosticResult/);
    assert.doesNotMatch(diagnosticRepository, /getLatestDiagnosticAttempt/);
    assert.doesNotMatch(reviewService, /getReviewSessionSnapshot/);
    assert.doesNotMatch(reviewTypes, /ReviewSessionSnapshot/);
  });

  it("keeps the shell focused on review, weak review, and knowledge details", () => {
    const shell = readFileSync(join(root, "src/components/app/phase-shell.tsx"), "utf8");

    assert.match(shell, /今日复习/);
    assert.match(shell, /补弱/);
    assert.match(shell, /诊断/);

    for (const copy of removedNavCopy) {
      assert.doesNotMatch(shell, new RegExp(copy));
    }
  });
});
