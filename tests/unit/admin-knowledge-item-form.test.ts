import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("admin knowledge item form", () => {
  it("includes aggregate editing sections and save routes", () => {
    const form = readFileSync(
      "src/components/admin/knowledge-item-admin-form.tsx",
      "utf8",
    );
    const collectionRoute = readFileSync(
      "src/app/api/admin/knowledge-items/route.ts",
      "utf8",
    );
    const itemRoute = readFileSync(
      "src/app/api/admin/knowledge-items/[id]/route.ts",
      "utf8",
    );

    assert.match(form, /基础信息/);
    assert.match(form, /复习题/);
    assert.match(form, /变量/);
    assert.match(form, /知识关系/);
    assert.match(collectionRoute, /export async function POST/);
    assert.match(itemRoute, /export async function PUT/);
  });

  it("binds PUT saves to the routed item slug", () => {
    const itemRoute = readFileSync(
      "src/app/api/admin/knowledge-items/[id]/route.ts",
      "utf8",
    );

    assert.match(itemRoute, /const id = normalizeRouteParam\(rawId\)/);
    assert.match(itemRoute, /await getAdminKnowledgeItem\(id\)/);
    assert.match(itemRoute, /body\.slug !== knowledgeItem\.slug/);
    assert.match(itemRoute, /Slug 与当前知识项不匹配/);
  });

  it("exposes delete actions from the admin list and edit form", () => {
    const listPage = readFileSync(
      "src/app/admin/knowledge-items/page.tsx",
      "utf8",
    );
    const editPage = readFileSync(
      "src/app/admin/knowledge-items/[id]/edit/page.tsx",
      "utf8",
    );
    const form = readFileSync(
      "src/components/admin/knowledge-item-admin-form.tsx",
      "utf8",
    );
    const deleteButton = readFileSync(
      "src/components/admin/knowledge-item-delete-button.tsx",
      "utf8",
    );
    const itemRoute = readFileSync(
      "src/app/api/admin/knowledge-items/[id]/route.ts",
      "utf8",
    );

    assert.match(listPage, /KnowledgeItemDeleteButton/);
    assert.match(listPage, /endpoint=\{`\/api\/admin\/knowledge-items\/\$\{item\.id\}`\}/);
    assert.match(editPage, /deleteEndpoint=\{`\/api\/admin\/knowledge-items\/\$\{item\.id\}`\}/);
    assert.match(form, /deleteEndpoint/);
    assert.match(form, /删除知识项/);
    assert.match(deleteButton, /"use client"/);
    assert.match(deleteButton, /toast\("确认删除知识项"/);
    assert.match(deleteButton, /method: "DELETE"/);
    assert.match(deleteButton, /router\.refresh\(\)/);
    assert.match(deleteButton, /\{isPending \? "删除中\.\.\." : "删除"\}/);
    assert.match(itemRoute, /export async function DELETE/);
    assert.match(itemRoute, /await deleteAdminKnowledgeItem\(knowledgeItem\.id\)/);
  });

  it("labels structured collection textareas", () => {
    const form = readFileSync(
      "src/components/admin/knowledge-item-admin-form.tsx",
      "utf8",
    );

    assert.match(form, /htmlFor="variables"/);
    assert.match(form, /htmlFor="reviewItems"/);
    assert.match(form, /htmlFor="relations"/);
  });

  it("supports structured content type payload fields", () => {
    const form = readFileSync(
      "src/components/admin/knowledge-item-admin-form.tsx",
      "utf8",
    );

    assert.match(form, /"concept_card"/);
    assert.match(form, /"comparison_table"/);
    assert.match(form, /"procedure"/);
    assert.match(form, /name="definition"/);
    assert.match(form, /name="comparisonMode"/);
    assert.match(form, /name="matrixSubjects"/);
    assert.match(form, /name="tableColumns"/);
    assert.match(form, /name="procedureSteps"/);
    assert.match(form, /name="procedureNodes"/);
    assert.match(form, /name="procedureEdges"/);
    assert.match(form, /name="mermaid"/);
    assert.match(form, /contentType === "concept_card"/);
    assert.match(form, /contentType === "comparison_table"/);
    assert.match(form, /contentType === "procedure"/);
  });

  it("optimizes the new knowledge item page for guided creation", () => {
    const newPage = readFileSync(
      "src/app/admin/knowledge-items/new/page.tsx",
      "utf8",
    );
    const form = readFileSync(
      "src/components/admin/knowledge-item-admin-form.tsx",
      "utf8",
    );

    assert.match(newPage, /创建一个可训练的知识项/);
    assert.match(newPage, /返回知识项/);
    assert.match(newPage, /mode="create"/);
    assert.match(form, /创建路径/);
    assert.match(form, /ContentTypeGuide/);
    assert.match(form, /FormSection/);
    assert.match(form, /advanced/);
    assert.match(form, /创建知识项/);
  });
});
