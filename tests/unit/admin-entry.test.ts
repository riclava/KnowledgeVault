import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("admin entry point", () => {
  it("shows an admin backstage link from the signed-in account entry", () => {
    const accountEntry = readFileSync(
      "src/components/app/account-entry.tsx",
      "utf8",
    );

    assert.match(accountEntry, /getCurrentLearner/);
    assert.match(accountEntry, /learner\.role\s*===\s*"admin"/);
    assert.match(accountEntry, /href="\/admin"/);
    assert.match(accountEntry, /管理后台/);
  });
});
