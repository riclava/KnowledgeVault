import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

describe("admin UI files", () => {
  it("uses shadcn select components instead of native dropdown controls", () => {
    const sourceFiles = [
      "src/components/admin/admin-bulk-generate-import-form.tsx",
      "src/components/admin/admin-import-form.tsx",
      "src/components/admin/knowledge-dedupe-panel.tsx",
      "src/components/admin/knowledge-item-admin-form.tsx",
      "src/components/admin/knowledge-item-filter-form.tsx",
    ];

    for (const sourceFile of sourceFiles) {
      const source = readFileSync(sourceFile, "utf8");

      assert.doesNotMatch(source, /<select\b|<\/select>|<option\b/);
      assert.doesNotMatch(source, /<datalist\b|<\/datalist>/);
      assert.match(source, /@\/components\/ui\/select/);
    }
  });

  it("contains the backstage navigation and AI import action", () => {
    const layout = readFileSync("src/app/admin/layout.tsx", "utf8");
    const importForm = readFileSync(
      "src/components/admin/admin-import-form.tsx",
      "utf8",
    );

    assert.match(layout, /AI 导入/);
    assert.match(layout, /知识项/);
    assert.match(layout, /href="\/"/);
    assert.match(layout, /返回主页/);
    assert.match(layout, /border-t pt-3/);
    assert.doesNotMatch(layout, /variant: "outline"/);
    assert.doesNotMatch(layout, /Home className/);
    assert.match(importForm, /生成预览/);
    assert.match(importForm, /确认导入/);
    assert.match(importForm, /重新生成/);
    assert.match(importForm, /mode: "preview"/);
    assert.match(importForm, /mode: "save"/);
    assert.match(importForm, /importRunId: previewSummary\.importRunId/);
    assert.match(importForm, /KnowledgeItemRenderer/);
    assert.match(importForm, /结构化预览/);
    assert.match(importForm, /getImportPreviewItems/);
    assert.match(importForm, /editableBatch/);
    assert.match(importForm, /updatePreviewItemField/);
    assert.match(importForm, /updatePreviewRelationField/);
    assert.match(importForm, /domainOptions/);
    assert.match(importForm, /subdomainsByDomain/);
    assert.match(importForm, /selectLabel="选择已有领域"/);
    assert.match(importForm, /selectLabel="选择已有子领域"/);
    assert.match(importForm, /从存量选择/);
    assert.match(importForm, /暂无存量可选/);
    assert.match(importForm, /options=\{domainOptions\.domains\}/);
    assert.match(importForm, /options=\{subdomainSelectOptions\}/);
    assert.match(importForm, /name="domain"/);
    assert.match(importForm, /name="subdomain"/);
    assert.match(importForm, /batch: editableBatch/);
    assert.match(importForm, /allowDedupeOverride/);
    assert.match(importForm, /疑似重复/);
    assert.match(importForm, /仍然导入/);
    assert.doesNotMatch(importForm, /JSON\.stringify\(result/);
    assert.match(importForm, /sourceMaterial/);
    assert.match(importForm, /className="min-h-44 resize-y text-sm leading-6"/);
    assert.doesNotMatch(importForm, /className="min-h-72 resize-y text-sm leading-6"/);
    assert.match(importForm, /高级设置/);
    assert.match(importForm, /AI 自动判断/);
    const sourceTitleField = importForm.match(
      /<Input\s+id="sourceTitle"[\s\S]*?\/>/,
    )?.[0];
    const defaultDomainField = importForm.match(
      /<Input\s+id="defaultDomain"[\s\S]*?\/>/,
    )?.[0];

    assert.ok(sourceTitleField);
    assert.ok(defaultDomainField);
    assert.doesNotMatch(sourceTitleField, /required/);
    assert.doesNotMatch(defaultDomainField, /required/);
  });

  it("allows manual domain entry on the admin bulk generate import form", () => {
    const bulkForm = readFileSync(
      "src/components/admin/admin-bulk-generate-import-form.tsx",
      "utf8",
    );

    assert.match(bulkForm, /BulkDomainInput/);
    assert.match(bulkForm, /selectLabel="选择已有领域"/);
    assert.match(bulkForm, /selectLabel="选择已有子领域"/);
    assert.match(bulkForm, /placeholder="填写或选择领域"/);
    assert.match(bulkForm, /placeholder="填写或选择子领域"/);
    assert.match(bulkForm, /options=\{domainOptions\.domains\}/);
    assert.match(bulkForm, /options=\{availableSubdomains\}/);
    assert.match(bulkForm, /name="domain"/);
    assert.match(bulkForm, /name="subdomain"/);
    assert.match(bulkForm, /从存量选择/);
    assert.match(bulkForm, /<SelectValue>\{labelForContentType\(contentType\)\}<\/SelectValue>/);
    assert.match(bulkForm, /selectDisplayLabel/);
  });

  it("marks public and private knowledge items in the admin list", () => {
    const page = readFileSync(
      "src/app/admin/knowledge-items/page.tsx",
      "utf8",
    );
    const bulkEditor = readFileSync(
      "src/components/admin/knowledge-item-bulk-domain-editor.tsx",
      "utf8",
    );
    const service = readFileSync(
      "src/server/admin/admin-knowledge-item-service.ts",
      "utf8",
    );

    assert.match(service, /createdByUser/);
    assert.match(service, /displayName/);
    assert.match(page, /AdminKnowledgeItemBulkDomainEditor/);
    assert.match(bulkEditor, /可见性/);
    assert.match(bulkEditor, /item\.visibility === "private"/);
    assert.match(bulkEditor, /私有/);
    assert.match(bulkEditor, /公共/);
    assert.match(bulkEditor, /createdByUser/);
  });

  it("exposes a backstage knowledge item detail view from the admin list", () => {
    const page = readFileSync(
      "src/app/admin/knowledge-items/page.tsx",
      "utf8",
    );
    const bulkEditor = readFileSync(
      "src/components/admin/knowledge-item-bulk-domain-editor.tsx",
      "utf8",
    );
    const detailPage = readFileSync(
      "src/app/admin/knowledge-items/[id]/page.tsx",
      "utf8",
    );
    const editPage = readFileSync(
      "src/app/admin/knowledge-items/[id]/edit/page.tsx",
      "utf8",
    );

    assert.match(page, /AdminKnowledgeItemBulkDomainEditor/);
    assert.match(bulkEditor, /href=\{`\/admin\/knowledge-items\/\$\{item\.id\}`\}/);
    assert.match(bulkEditor, /查看/);
    assert.match(detailPage, /知识项详情/);
    assert.match(detailPage, /KnowledgeItemRenderer/);
    assert.match(detailPage, /复习题/);
    assert.match(detailPage, /变量/);
    assert.match(detailPage, /关联知识项/);
    assert.match(editPage, /href=\{`\/admin\/knowledge-items\/\$\{item\.id\}`\}/);
    assert.doesNotMatch(editPage, /href=\{`\/knowledge-items\/\$\{item\.id\}`\}/);
  });

  it("exposes learner private AI import without admin permissions", () => {
    const route = readFileSync("src/app/api/import/route.ts", "utf8");
    const page = readFileSync("src/app/import/page.tsx", "utf8");
    const shell = readFileSync("src/components/app/phase-shell.tsx", "utf8");
    const importForm = readFileSync(
      "src/components/admin/admin-import-form.tsx",
      "utf8",
    );

    assert.match(route, /withAuthenticatedApi/);
    assert.doesNotMatch(route, /withAdminApi/);
    assert.match(route, /previewLearnerImport/);
    assert.match(route, /savePreviewedLearnerImport/);
    assert.match(page, /endpoint="\/api\/import"/);
    assert.match(page, /导入到我的知识库/);
    assert.match(shell, /添加知识/);
    assert.match(shell, /用 AI 把材料整理进我的知识库。/);
    assert.match(shell, /href: "\/import"/);
    assert.match(importForm, /endpoint = "\/api\/admin\/import"/);
    assert.match(importForm, /fetch\(endpoint/);
  });

  it("uses a dropdown for the admin knowledge item domain filter", () => {
    const page = readFileSync(
      "src/app/admin/knowledge-items/page.tsx",
      "utf8",
    );
    const filterForm = readFileSync(
      "src/components/admin/knowledge-item-filter-form.tsx",
      "utf8",
    );

    assert.match(page, /listAdminKnowledgeItemDomains/);
    assert.match(page, /const \[result, domains\] = await Promise\.all/);
    assert.match(page, /AdminKnowledgeItemFilterForm/);
    assert.match(filterForm, /Select/);
    assert.match(filterForm, /SelectItem value=\{ALL_FILTER_VALUE\}/);
    assert.match(filterForm, /domains\.map\(\(domain\) =>/);

    const domainField = filterForm.match(
      /<Label htmlFor="admin-domain">领域<\/Label>[\s\S]*?<\/div>/,
    )?.[0];

    assert.ok(domainField);
    assert.doesNotMatch(domainField, /<Input/);
  });

  it("uses a multi-select difficulty dropdown and Chinese content type labels", () => {
    const filterForm = readFileSync(
      "src/components/admin/knowledge-item-filter-form.tsx",
      "utf8",
    );

    assert.match(filterForm, /const selectedDifficulties = new Set/);
    assert.match(filterForm, /<details[\s\S]*id="admin-difficulty"/);
    assert.match(filterForm, /type="checkbox"[\s\S]*name="difficulty"/);
    assert.match(filterForm, /DIFFICULTY_OPTIONS\.map\(\(difficulty\) =>/);
    assert.match(filterForm, /CONTENT_TYPE_OPTIONS\.map\(\(type\) =>/);
    assert.match(filterForm, /\{type\.label\}/);
    assert.match(filterForm, /label: "数学公式"/);
    assert.match(filterForm, /label: "词汇"/);
    assert.match(filterForm, /label: "纯文本"/);
  });

  it("auto-applies admin knowledge item filters without a submit button", () => {
    const filterForm = readFileSync(
      "src/components/admin/knowledge-item-filter-form.tsx",
      "utf8",
    );

    assert.match(filterForm, /"use client"/);
    assert.match(filterForm, /useRouter/);
    assert.match(filterForm, /useSearchParams/);
    assert.match(filterForm, /window\.setTimeout\(\(\) =>/);
    assert.match(filterForm, /}, 500\)/);
    assert.match(filterForm, /onChange=\{handleImmediateFilterChange\}/);
    assert.match(filterForm, /router\.replace\(buildFilterHref\(pathname, params\), \{ scroll: false \}\)/);
    assert.doesNotMatch(filterForm, /type="submit"/);
    assert.doesNotMatch(filterForm, />\s*筛选\s*</);
  });

  it("exposes pagination and bulk domain editing on the admin knowledge item list", () => {
    const page = readFileSync(
      "src/app/admin/knowledge-items/page.tsx",
      "utf8",
    );
    const bulkEditor = readFileSync(
      "src/components/admin/knowledge-item-bulk-domain-editor.tsx",
      "utf8",
    );
    const route = readFileSync(
      "src/app/api/admin/knowledge-items/route.ts",
      "utf8",
    );

    assert.match(page, /AdminKnowledgeItemBulkDomainEditor/);
    assert.match(page, /buildPageHref/);
    assert.match(page, /上一页/);
    assert.match(page, /下一页/);
    assert.match(page, /共 \{result\.total\} 项/);
    assert.match(bulkEditor, /selectedIds\.length > 0/);
    assert.match(bulkEditor, /已选 \{selectedIds\.length\} 项/);
    assert.match(bulkEditor, /Sheet/);
    assert.match(bulkEditor, /修改领域\/子领域/);
    assert.match(bulkEditor, /selectedIds/);
    assert.match(bulkEditor, /name="domain"/);
    assert.match(bulkEditor, /name="subdomain"/);
    assert.match(bulkEditor, /name="clearSubdomain"/);
    assert.match(bulkEditor, /清空子领域/);
    assert.match(bulkEditor, /确认修改/);
    assert.doesNotMatch(bulkEditor, /留空清空/);
    assert.match(bulkEditor, /method: "PATCH"/);
    assert.match(route, /export async function PATCH/);
    assert.match(route, /bulkUpdateAdminKnowledgeItemDomain/);
  });

  it("exposes bulk delete on the admin knowledge item list", () => {
    const bulkEditor = readFileSync(
      "src/components/admin/knowledge-item-bulk-domain-editor.tsx",
      "utf8",
    );
    const route = readFileSync(
      "src/app/api/admin/knowledge-items/route.ts",
      "utf8",
    );

    assert.match(route, /export async function DELETE/);
    assert.match(route, /bulkDeleteAdminKnowledgeItems/);
    assert.match(bulkEditor, /批量删除/);
    assert.match(bulkEditor, /确认删除知识项/);
    assert.match(bulkEditor, /method: "DELETE"/);
    assert.match(bulkEditor, /已删除 \$\{getDeletedCount\(responseBody\)\} 个知识项/);
  });

  it("feeds existing domain options into the admin import form", () => {
    const page = readFileSync("src/app/admin/import/page.tsx", "utf8");

    assert.match(page, /listAdminKnowledgeItemDomainOptions/);
    assert.match(page, /await listAdminKnowledgeItemDomainOptions\(\)/);
    assert.match(page, /domainOptions=\{domainOptions\}/);
  });

  it("exposes admin bulk generate import API routes", () => {
    const runsRoute = readFileSync(
      "src/app/api/admin/bulk-generate-import/runs/route.ts",
      "utf8",
    );
    const runRoute = readFileSync(
      "src/app/api/admin/bulk-generate-import/runs/[id]/route.ts",
      "utf8",
    );
    const processRoute = readFileSync(
      "src/app/api/admin/bulk-generate-import/runs/[id]/process/route.ts",
      "utf8",
    );
    const cancelRoute = readFileSync(
      "src/app/api/admin/bulk-generate-import/runs/[id]/cancel/route.ts",
      "utf8",
    );

    assert.match(runsRoute, /withAdminApi/);
    assert.match(runsRoute, /createAdminBulkGenerateImportRunForAdmin/);
    assert.match(runsRoute, /export async function GET/);
    assert.match(runsRoute, /listAdminBulkGenerateImportRunsForAdmin/);
    assert.match(runRoute, /withAdminApi/);
    assert.match(runRoute, /getAdminBulkGenerateImportRunDetailForAdmin/);
    assert.match(runRoute, /export async function DELETE/);
    assert.match(runRoute, /deleteAdminBulkGenerateImportRunForAdmin/);
    assert.match(processRoute, /withAdminApi/);
    assert.match(processRoute, /startAdminBulkGenerateImportRunForAdmin/);
    assert.match(processRoute, /status: 202/);
    assert.match(cancelRoute, /withAdminApi/);
    assert.match(cancelRoute, /cancelAdminBulkGenerateImportRunForAdmin/);
    assert.match(cancelRoute, /export async function POST/);
  });

  it("exposes the admin bulk generate import UI with polling progress", () => {
    const layout = readFileSync("src/app/admin/layout.tsx", "utf8");
    const page = readFileSync(
      "src/app/admin/bulk-generate-import/page.tsx",
      "utf8",
    );
    const form = readFileSync(
      "src/components/admin/admin-bulk-generate-import-form.tsx",
      "utf8",
    );

    assert.match(layout, /批量生成导入/);
    assert.match(layout, /href: "\/admin\/bulk-generate-import"/);
    assert.match(page, /listAdminKnowledgeItemDomainOptions/);
    assert.match(page, /listAdminBulkGenerateImportRunsForAdmin/);
    assert.match(page, /AdminBulkGenerateImportForm/);
    assert.match(page, /initialRuns=\{initialRuns\}/);
    assert.match(form, /type="file"/);
    assert.match(form, /name="contentType"/);
    assert.match(form, /name="domain"/);
    assert.match(form, /name="subdomain"/);
    assert.match(form, /const \[domain, setDomain\] = useState/);
    assert.match(form, /availableSubdomains/);
    assert.match(form, /setSubdomain\(""\)/);
    assert.doesNotMatch(form, /<datalist/);
    assert.doesNotMatch(form, /Object\.values\(domainOptions\.subdomainsByDomain\)/);
    assert.match(form, /createRun/);
    assert.match(form, /refreshRuns/);
    assert.match(form, /loadRun/);
    assert.match(form, /任务管理/);
    assert.match(form, /最近任务/);
    assert.match(form, /继续处理/);
    assert.match(form, /cancelRun/);
    assert.match(form, /取消任务/);
    assert.match(form, /已取消/);
    assert.match(form, /deleteRun/);
    assert.match(form, /确认删除批量生成任务/);
    assert.match(form, /删除任务/);
    assert.match(form, /method: "DELETE"/);
    assert.match(form, /canDeleteRun/);
    assert.match(form, /startProcessing/);
    assert.match(form, /window\.setInterval/);
    assert.match(form, /处理进度/);
    assert.match(form, /等待中/);
    assert.match(form, /处理中/);
    assert.match(form, /已导入/);
    assert.match(form, /重复跳过/);
    assert.match(form, /失败/);
  });

  it("registers app startup recovery for interrupted bulk generate imports", () => {
    const instrumentation = readFileSync("src/instrumentation.ts", "utf8");

    assert.match(instrumentation, /export async function register/);
    assert.match(instrumentation, /NEXT_RUNTIME/);
    assert.match(
      instrumentation,
      /recoverInterruptedAdminBulkGenerateImportRunsForApp/,
    );
  });
});
