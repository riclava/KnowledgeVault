import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("toast feedback", () => {
  it("uses Sonner as the single app-wide toast surface", () => {
    const packageJson = readFileSync("package.json", "utf8");
    const layout = readFileSync("src/app/layout.tsx", "utf8");

    assert.match(packageJson, /"sonner":/);
    assert.match(layout, /import \{ Toaster \} from "sonner"/);
    assert.match(layout, /<Toaster[\s\S]*richColors/);
  });

  it("does not use blocking browser popups for app feedback", () => {
    const files = [
      "src/components/admin/knowledge-item-delete-button.tsx",
      "src/components/admin/admin-import-form.tsx",
      "src/components/admin/knowledge-item-admin-form.tsx",
      "src/components/memory-hooks/knowledge-item-memory-hook-panel.tsx",
      "src/components/review/review-session.tsx",
      "src/components/account/account-panel.tsx",
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");

      assert.doesNotMatch(source, /window\.(alert|confirm)\(/, file);
      assert.match(source, /import \{ toast \} from "sonner"/, file);
    }
  });

  it("keeps destructive delete confirmation inside a toast action", () => {
    const deleteButton = readFileSync(
      "src/components/admin/knowledge-item-delete-button.tsx",
      "utf8",
    );

    assert.match(deleteButton, /toast\("确认删除知识项"/);
    assert.match(deleteButton, /action:\s*\{[\s\S]*label:\s*"删除"/);
    assert.match(deleteButton, /toast\.success\("已删除"\)/);
    assert.match(deleteButton, /toast\.error/);
  });
});
