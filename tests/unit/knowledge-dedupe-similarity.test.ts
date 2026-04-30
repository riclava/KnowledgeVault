import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clusterKnowledgeDedupePairs,
  findKnowledgeDedupePairs,
  scoreKnowledgeDedupePair,
  type KnowledgeDedupeScoredItem,
} from "@/server/admin/knowledge-dedupe-similarity";

const algebraA: KnowledgeDedupeScoredItem = {
  id: "algebra-a",
  title: "一元二次方程求根公式",
  slug: "quadratic-formula",
  summary: "一元二次方程 ax^2 + bx + c = 0 的求根公式。",
  body: "当判别式 b^2 - 4ac 大于等于 0 时，可以用求根公式得到两个实数根。",
  contentType: "math_formula",
  tags: ["代数", "方程", "求根公式"],
};

const algebraB: KnowledgeDedupeScoredItem = {
  id: "algebra-b",
  title: "二次方程的求根公式",
  slug: "quadratic-equation-root-formula",
  summary: "求解一元二次方程时使用的公式，与判别式有关。",
  body: "对于 ax^2 + bx + c = 0，可根据 b^2 - 4ac 判断根并使用求根公式。",
  contentType: "math_formula",
  tags: ["代数", "二次方程", "求根公式"],
};

const geometry: KnowledgeDedupeScoredItem = {
  id: "geometry",
  title: "三角形内角和",
  slug: "triangle-angle-sum",
  summary: "任意三角形三个内角之和为 180 度。",
  body: "三角形内角和定理常用于几何角度计算。",
  contentType: "concept_card",
  tags: ["几何", "三角形"],
};

describe("knowledge dedupe similarity", () => {
  it("scores likely duplicate knowledge items above the default scan threshold", () => {
    const pair = scoreKnowledgeDedupePair(algebraA, algebraB);

    assert.equal(pair.itemIds[0], "algebra-a");
    assert.equal(pair.itemIds[1], "algebra-b");
    assert.ok(pair.score >= 0.6, `expected high score, got ${pair.score}`);
    assert.ok(pair.reasons.some((reason) => reason.kind === "title"));
  });

  it("keeps unrelated knowledge items below the scan threshold", () => {
    const pair = scoreKnowledgeDedupePair(algebraA, geometry);

    assert.ok(pair.score < 0.35, `expected low score, got ${pair.score}`);
  });

  it("finds only pairs above the requested threshold", () => {
    const pairs = findKnowledgeDedupePairs([algebraA, algebraB, geometry], 0.55);

    assert.deepEqual(
      pairs.map((pair) => pair.itemIds),
      [["algebra-a", "algebra-b"]],
    );
  });

  it("clusters connected duplicate pairs into candidate groups", () => {
    const groups = clusterKnowledgeDedupePairs([
      { itemIds: ["a", "b"], score: 0.8, reasons: [] },
      { itemIds: ["b", "c"], score: 0.7, reasons: [] },
      { itemIds: ["d", "e"], score: 0.9, reasons: [] },
    ]);

    assert.deepEqual(
      groups.map((group) => group.itemIds),
      [
        ["a", "b", "c"],
        ["d", "e"],
      ],
    );
    assert.equal(groups[0]?.score, 0.75);
  });
});
