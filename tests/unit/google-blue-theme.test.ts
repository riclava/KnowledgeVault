import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("scholar garden theme", () => {
  it("defines the app theme around the Scholar Garden semantic tokens", () => {
    const globals = readFileSync("src/app/globals.css", "utf8");

    assert.match(globals, /--background:\s*#f7faf8;/);
    assert.match(globals, /--primary:\s*#315c7c;/);
    assert.match(globals, /--secondary:\s*#e7f0ea;/);
    assert.match(globals, /--success:\s*#2f7d5a;/);
    assert.match(globals, /--warning:\s*#9a5f13;/);
  });

  it("keeps the homepage auth surface on semantic theme styles", () => {
    const home = readFileSync("src/app/page.tsx", "utf8");

    assert.doesNotMatch(home, /bg-slate-950/);
    assert.doesNotMatch(home, /#d5b36f|#ddb96e/);
    assert.match(home, /buttonClassName="h-10 rounded-full"/);
  });

  it("uses semantic status colors instead of hard-coded tone palettes", () => {
    const review = readFileSync("src/components/review/review-session.tsx", "utf8");
    const detail = readFileSync("src/components/knowledge-item/knowledge-item-detail-view.tsx", "utf8");
    const remediation = readFileSync("src/components/review/review-remediation-sheet.tsx", "utf8");

    for (const source of [review, detail, remediation]) {
      assert.doesNotMatch(source, /bg-(emerald|amber|red|blue)-/);
      assert.doesNotMatch(source, /border-(emerald|amber|red|blue)-/);
      assert.doesNotMatch(source, /text-(emerald|amber|red|blue)-/);
    }
  });
});
