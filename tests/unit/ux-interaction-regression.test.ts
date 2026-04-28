import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("learner interaction UX regressions", () => {
  it("preserves the active learning domain when leaving and returning from review details", () => {
    const reviewSession = readFileSync(
      "src/components/review/review-session.tsx",
      "utf8",
    );
    const detailPage = readFileSync(
      "src/app/knowledge-items/[id]/page.tsx",
      "utf8",
    );

    assert.match(reviewSession, /buildKnowledgeItemHref/);
    assert.match(reviewSession, /domain=\$\{encodeURIComponent\(domain\)\}/);
    assert.match(detailPage, /resolveLearningDomain/);
    assert.match(detailPage, /learningDomain=\{learningDomain\}/);
    assert.match(detailPage, /buildReturnLink\(\{[\s\S]*domain:/);
  });

  it("keeps learner-facing controls at touch-friendly sizes", () => {
    const button = readFileSync("src/components/ui/button.tsx", "utf8");
    const input = readFileSync("src/components/ui/input.tsx", "utf8");

    assert.match(button, /default:\s*"h-10/);
    assert.match(button, /sm:\s*"h-9/);
    assert.match(button, /lg:\s*"h-11/);
    assert.match(input, /"h-10 w-full/);
  });

  it("makes Again and Hard remediation an explicit save-or-skip step", () => {
    const reviewSession = readFileSync(
      "src/components/review/review-session.tsx",
      "utf8",
    );
    const remediationSheet = readFileSync(
      "src/components/review/review-remediation-sheet.tsx",
      "utf8",
    );

    assert.match(reviewSession, /保存并继续/);
    assert.match(reviewSession, /跳过提示，继续下一题/);
    assert.match(reviewSession, /saveReviewMemoryHookAndContinue/);
    assert.match(remediationSheet, /回到复习卡片/);
    assert.doesNotMatch(remediationSheet, /继续下一题/);
  });

  it("lets learners review and adjust diagnostic answers before submitting", () => {
    const diagnostic = readFileSync(
      "src/components/diagnostic/diagnostic-quiz.tsx",
      "utf8",
    );

    assert.match(diagnostic, /上一步/);
    assert.match(diagnostic, /确认自评/);
    assert.match(diagnostic, /handlePreviousQuestion/);
  });

  it("exposes admin filtering and human-readable import results", () => {
    const adminList = readFileSync(
      "src/app/admin/knowledge-items/page.tsx",
      "utf8",
    );
    const importForm = readFileSync(
      "src/components/admin/admin-import-form.tsx",
      "utf8",
    );

    assert.match(adminList, /name="query"/);
    assert.match(adminList, /name="contentType"/);
    assert.match(adminList, /清除筛选/);
    assert.match(importForm, /导入完成/);
    assert.match(importForm, /调试详情/);
  });

  it("supports password visibility and field-level auth errors", () => {
    const authForm = readFileSync(
      "src/components/account/password-auth-form.tsx",
      "utf8",
    );

    assert.match(authForm, /showPassword/);
    assert.match(authForm, /显示密码/);
    assert.match(authForm, /aria-invalid/);
    assert.match(authForm, /fieldErrors/);
  });
});
