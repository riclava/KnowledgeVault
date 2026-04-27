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
});
