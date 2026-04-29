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

  it("uses the shadcn select for switching learning domains", () => {
    const domainSelector = readFileSync(
      "src/components/app/learning-domain-selector.tsx",
      "utf8",
    );

    assert.match(domainSelector, /@\/components\/ui\/select/);
    assert.match(domainSelector, /SelectTrigger/);
    assert.match(domainSelector, /SelectContent/);
    assert.match(domainSelector, /SelectItem/);
    assert.match(domainSelector, /onValueChange=\{handleChange\}/);
    assert.match(domainSelector, /value=\{currentDomain\}/);
    assert.doesNotMatch(domainSelector, /<select/);
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
    const adminFilterForm = readFileSync(
      "src/components/admin/knowledge-item-filter-form.tsx",
      "utf8",
    );
    const importForm = readFileSync(
      "src/components/admin/admin-import-form.tsx",
      "utf8",
    );

    assert.match(adminFilterForm, /name="query"/);
    assert.match(adminFilterForm, /name="contentType"/);
    assert.match(adminFilterForm, /清除筛选/);
    assert.match(importForm, /导入完成/);
    assert.match(importForm, /结构化预览/);
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

  it("uses a type-aware detail shell without nested renderer cards", () => {
    const detail = readFileSync(
      "src/components/knowledge-item/knowledge-item-detail-view.tsx",
      "utf8",
    );
    const rendererFiles = [
      "src/components/knowledge-item/renderers/math-formula-renderer.tsx",
      "src/components/knowledge-item/renderers/vocabulary-renderer.tsx",
      "src/components/knowledge-item/renderers/plain-text-renderer.tsx",
      "src/components/knowledge-item/renderers/concept-card-renderer.tsx",
      "src/components/knowledge-item/renderers/comparison-table-renderer.tsx",
      "src/components/knowledge-item/renderers/procedure-renderer.tsx",
    ].map((file) => readFileSync(file, "utf8"));

    assert.match(detail, /contentTypeLayoutClass\(knowledgeItem\.contentType\)/);
    assert.match(detail, /data-content-type=\{knowledgeItem\.contentType\}/);
    assert.match(detail, /LearningPriorityRail/);
    assert.match(detail, /aria-label="知识项快捷跳转"/);
    assert.match(detail, /overflow-x-auto/);

    for (const renderer of rendererFiles) {
      assert.doesNotMatch(renderer, /shadow-sm/);
    }
  });

  it("protects popup AI chat behind authenticated API access", () => {
    const route = readFileSync("src/app/api/ai/chat/route.ts", "utf8");

    assert.match(route, /withAuthenticatedApi/);
    assert.match(route, /generateAiChatReply/);
    assert.match(route, /NextResponse\.json\(\{ data: reply \}\)/);
    assert.match(route, /status: 400/);
  });
});
