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

  it("labels structured collection textareas", () => {
    const form = readFileSync(
      "src/components/admin/knowledge-item-admin-form.tsx",
      "utf8",
    );

    assert.match(form, /htmlFor="variables"/);
    assert.match(form, /htmlFor="reviewItems"/);
    assert.match(form, /htmlFor="relations"/);
  });
});
