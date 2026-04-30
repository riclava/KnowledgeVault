import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeKnowledgeItemRenderPayload,
  parseKnowledgeItemType,
} from "@/lib/knowledge-item-render-payload";

describe("knowledge item render payloads", () => {
  it("normalizes math formula payloads", () => {
    assert.deepEqual(
      normalizeKnowledgeItemRenderPayload("math_formula", {
        latex: " E = mc^2 ",
        explanation: " Energy mass equivalence ",
        variables: [
          { symbol: " E ", name: " Energy ", meaning: " Total energy " },
          { symbol: "", name: "blank", meaning: "ignored" },
        ],
      }),
      {
        latex: "E = mc^2",
        explanation: "Energy mass equivalence",
        variables: [{ symbol: "E", name: "Energy", meaning: "Total energy" }],
      },
    );
  });

  it("normalizes vocabulary payloads", () => {
    assert.deepEqual(
      normalizeKnowledgeItemRenderPayload("vocabulary", {
        term: " aberration ",
        definition: " a departure from what is normal ",
        examples: "A short spike was an aberration.\nA data aberration",
      }),
      {
        term: "aberration",
        definition: "a departure from what is normal",
        examples: ["A short spike was an aberration.", "A data aberration"],
      },
    );
  });

  it("normalizes plain text payloads", () => {
    assert.deepEqual(
      normalizeKnowledgeItemRenderPayload("plain_text", {
        text: "  First line\nSecond line  ",
      }),
      { text: "First line\nSecond line" },
    );
  });

  it("normalizes concept card payloads", () => {
    assert.deepEqual(
      normalizeKnowledgeItemRenderPayload("concept_card", {
        definition: " A limit describes the value approached by a function. ",
        keyPoints: "approach\nneighborhood",
        misconceptions: ["The function must be defined at the point."],
      }),
      {
        definition: "A limit describes the value approached by a function.",
        keyPoints: ["approach", "neighborhood"],
        misconceptions: ["The function must be defined at the point."],
      },
    );
  });

  it("normalizes comparison table payloads", () => {
    assert.deepEqual(
      normalizeKnowledgeItemRenderPayload("comparison_table", {
        subjects: ["DFS", "BFS"],
        aspects: [
          {
            label: "Order",
            values: ["Depth first", "Breadth first", "ignored"],
          },
          {
            label: "Memory",
            values: ["Stack"],
          },
        ],
      }),
      {
        subjects: ["DFS", "BFS"],
        aspects: [
          {
            label: "Order",
            values: ["Depth first", "Breadth first"],
          },
          {
            label: "Memory",
            values: ["Stack", ""],
          },
        ],
      },
    );
  });

  it("normalizes procedure payloads", () => {
    assert.deepEqual(
      normalizeKnowledgeItemRenderPayload("procedure", {
        steps: [
          {
            title: " Read ",
            detail: " Identify inputs. ",
          },
          {
            title: "Plan",
          },
        ],
        pitfalls: "Skip constraints\nAssume sorted input",
      }),
      {
        steps: [
          {
            title: "Read",
            detail: "Identify inputs.",
          },
          {
            title: "Plan",
            detail: "",
          },
        ],
        pitfalls: ["Skip constraints", "Assume sorted input"],
      },
    );
  });

  it("rejects invalid payloads", () => {
    assert.throws(
      () => normalizeKnowledgeItemRenderPayload("plain_text", { text: "" }),
      /plain text/i,
    );
    assert.throws(
      () => normalizeKnowledgeItemRenderPayload("vocabulary", { term: "word" }),
      /definition/i,
    );
    assert.throws(
      () => normalizeKnowledgeItemRenderPayload("concept_card", { definition: "" }),
      /concept card/i,
    );
    assert.throws(
      () =>
        normalizeKnowledgeItemRenderPayload("comparison_table", {
          subjects: ["Only one"],
          aspects: [{ label: "Use", values: ["Too narrow"] }],
        }),
      /at least two subjects/i,
    );
    assert.throws(
      () =>
        normalizeKnowledgeItemRenderPayload("comparison_table", {
          mode: "table",
          columns: ["Step"],
          rows: [["Read"]],
        }),
      /subjects/i,
    );
    assert.throws(
      () =>
        normalizeKnowledgeItemRenderPayload("procedure", {
          mode: "flowchart",
          nodes: [],
          edges: [],
        }),
      /steps/i,
    );
    assert.equal(parseKnowledgeItemType("formula"), null);
    assert.equal(parseKnowledgeItemType("concept_card"), "concept_card");
    assert.equal(parseKnowledgeItemType("comparison_table"), "comparison_table");
    assert.equal(parseKnowledgeItemType("procedure"), "procedure");
  });
});
