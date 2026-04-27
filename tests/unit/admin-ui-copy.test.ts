import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

describe("admin UI files", () => {
  it("contains the backstage navigation and AI import action", () => {
    const layout = readFileSync("src/app/admin/layout.tsx", "utf8");
    const importForm = readFileSync(
      "src/components/admin/admin-import-form.tsx",
      "utf8",
    );

    assert.match(layout, /AI 导入/);
    assert.match(layout, /知识项/);
    assert.match(importForm, /生成并保存/);
    assert.match(importForm, /sourceMaterial/);
    const sourceTitleField = importForm.match(
      /<Input\s+id="sourceTitle"[\s\S]*?\/>/,
    )?.[0];

    assert.ok(sourceTitleField);
    assert.doesNotMatch(sourceTitleField, /required/);
  });
});
