import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("knowledge item renderer registry", () => {
  it("registers renderers for every structured content type", () => {
    const registry = readFileSync(
      "src/components/knowledge-item/renderers/registry.ts",
      "utf8",
    );
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      dependencies?: Record<string, string>;
    };

    assert.match(registry, /conceptCardRenderer/);
    assert.match(registry, /comparisonTableRenderer/);
    assert.match(registry, /procedureRenderer/);
    assert.match(registry, /concept_card:\s*conceptCardRenderer/);
    assert.match(registry, /comparison_table:\s*comparisonTableRenderer/);
    assert.match(registry, /procedure:\s*procedureRenderer/);
    assert.ok(packageJson.dependencies?.mermaid);
  });
});
