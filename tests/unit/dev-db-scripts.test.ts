import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("development database scripts", () => {
  it("regenerates the Prisma client before resetting and seeding the baseline database", () => {
    const baselineScript = readFileSync("scripts/dev-db-baseline.mjs", "utf8");
    const resetScript = readFileSync("scripts/dev-db-reset.mjs", "utf8");

    const delegatedResetIndex = baselineScript.indexOf("scripts/dev-db-reset.mjs");
    const generateIndex = resetScript.indexOf('"generate"');
    const resetIndex = resetScript.indexOf('"reset"');

    assert.notEqual(delegatedResetIndex, -1);
    assert.notEqual(generateIndex, -1);
    assert.notEqual(resetIndex, -1);
    assert.ok(generateIndex < resetIndex);
  });
});
