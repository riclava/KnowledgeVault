import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeAdminImportRequest } from "@/server/admin/admin-import-service";

describe("admin import service", () => {
  it("normalizes import request body", () => {
    assert.deepEqual(
      normalizeAdminImportRequest({
        sourceMaterial: "  lesson text  ",
        sourceTitle: "  Lesson  ",
        defaultDomain: " 数学 ",
        defaultSubdomain: " 代数 ",
        preferredContentTypes: ["math_formula", "plain_text"],
      }),
      {
        sourceMaterial: "lesson text",
        sourceTitle: "Lesson",
        defaultDomain: "数学",
        defaultSubdomain: "代数",
        preferredContentTypes: ["math_formula", "plain_text"],
      },
    );
  });

  it("rejects missing source material and domain", () => {
    assert.throws(
      () => normalizeAdminImportRequest({ sourceMaterial: "", defaultDomain: "" }),
      /素材和默认领域不能为空/,
    );
  });
});
