import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeAdminKnowledgeItemBulkDeleteInput } from "@/server/admin/admin-knowledge-item-service";

describe("admin knowledge item bulk delete", () => {
  it("normalizes selected ids for deletion", () => {
    assert.deepEqual(
      normalizeAdminKnowledgeItemBulkDeleteInput({
        ids: [" first ", "second", "", "first", 42, null],
      }),
      { ok: true, ids: ["first", "second"] },
    );
  });

  it("rejects empty bulk delete requests", () => {
    assert.deepEqual(normalizeAdminKnowledgeItemBulkDeleteInput({ ids: [] }), {
      ok: false,
      error: "请选择要删除的知识项。",
    });
  });
});
