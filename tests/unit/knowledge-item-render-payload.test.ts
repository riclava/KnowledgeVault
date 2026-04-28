import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeKnowledgeItemRenderPayload,
  parseKnowledgeItemType,
} from "@/lib/knowledge-item-render-payload";

describe("knowledge item render payloads", () => {
  it("normalizes math formula payloads", () => {
    assert.deepEqual(
      normalizeKnowledgeItemRenderPayload("math_formula", { latex: "x^2" }),
      { latex: "x^2" },
    );
  });

  it("normalizes vocabulary payloads", () => {
    assert.deepEqual(
      normalizeKnowledgeItemRenderPayload("vocabulary", {
        term: "aberration",
        definition: "a departure from what is normal",
        phonetic: " /ab-er-ay-shun/ ",
        examples: ["A short spike was an aberration."],
      }),
      {
        term: "aberration",
        definition: "a departure from what is normal",
        phonetic: "/ab-er-ay-shun/",
        partOfSpeech: "",
        examples: ["A short spike was an aberration."],
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
        intuition: " It is about getting close, not necessarily arriving. ",
        keyPoints: "approach\nneighborhood",
        examples: ["lim x->0 sin(x)/x = 1"],
        misconceptions: ["The function must be defined at the point."],
      }),
      {
        definition: "A limit describes the value approached by a function.",
        intuition: "It is about getting close, not necessarily arriving.",
        keyPoints: ["approach", "neighborhood"],
        examples: ["lim x->0 sin(x)/x = 1"],
        misconceptions: ["The function must be defined at the point."],
      },
    );
  });

  it("normalizes comparison table matrix payloads", () => {
    assert.deepEqual(
      normalizeKnowledgeItemRenderPayload("comparison_table", {
        mode: "matrix",
        subjects: ["Bayes", "Total probability"],
        aspects: [
          {
            label: "Use",
            values: ["Reverse conditional", "Marginalize cases", "ignored"],
          },
          {
            label: "Question",
            values: ["P(A|B)"],
          },
        ],
      }),
      {
        mode: "matrix",
        subjects: ["Bayes", "Total probability"],
        aspects: [
          {
            label: "Use",
            values: ["Reverse conditional", "Marginalize cases"],
          },
          {
            label: "Question",
            values: ["P(A|B)", ""],
          },
        ],
      },
    );
  });

  it("normalizes comparison table generic table payloads", () => {
    assert.deepEqual(
      normalizeKnowledgeItemRenderPayload("comparison_table", {
        mode: "table",
        columns: ["Step", "Action"],
        rows: [
          ["1", "Read", "ignored"],
          ["2"],
        ],
      }),
      {
        mode: "table",
        columns: ["Step", "Action"],
        rows: [
          ["1", "Read"],
          ["2", ""],
        ],
      },
    );
  });

  it("normalizes procedure payloads", () => {
    assert.deepEqual(
      normalizeKnowledgeItemRenderPayload("procedure", {
        mode: "flowchart",
        title: " Solve linear equation ",
        overview: " Isolate the unknown. ",
        steps: [
          {
            id: "isolate",
            title: "Isolate",
            description: "Move constants away.",
            tips: "Keep balance",
            pitfalls: ["Forgetting signs"],
          },
        ],
        nodes: [
          { id: "start", label: "Start", kind: "start" },
          { id: "isolate", label: "Isolate x", kind: "step" },
        ],
        edges: [{ from: "start", to: "isolate", label: "" }],
        mermaid: "flowchart TD\n  start([Start]) --> isolate[Isolate x]",
      }),
      {
        mode: "flowchart",
        title: "Solve linear equation",
        overview: "Isolate the unknown.",
        steps: [
          {
            id: "isolate",
            title: "Isolate",
            description: "Move constants away.",
            tips: ["Keep balance"],
            pitfalls: ["Forgetting signs"],
          },
        ],
        nodes: [
          { id: "start", label: "Start", kind: "start" },
          { id: "isolate", label: "Isolate x", kind: "step" },
        ],
        edges: [{ from: "start", to: "isolate", label: null }],
        mermaid: "flowchart TD\n  start([Start]) --> isolate[Isolate x]",
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
          mode: "matrix",
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
          rows: [],
        }),
      /at least one row/i,
    );
    assert.throws(
      () =>
        normalizeKnowledgeItemRenderPayload("procedure", {
          mode: "flowchart",
          title: "Broken flow",
          overview: "",
          steps: [
            {
              id: "step",
              title: "Step",
              description: "Do it.",
              tips: [],
              pitfalls: [],
            },
          ],
          nodes: [
            { id: "start", label: "Start", kind: "start" },
            { id: "step", label: "Step", kind: "step" },
          ],
          edges: [{ from: "start", to: "missing", label: null }],
          mermaid: "flowchart TD\n  start --> missing",
        }),
      /unknown procedure node/i,
    );
    assert.equal(parseKnowledgeItemType("formula"), null);
    assert.equal(parseKnowledgeItemType("concept_card"), "concept_card");
    assert.equal(parseKnowledgeItemType("comparison_table"), "comparison_table");
    assert.equal(parseKnowledgeItemType("procedure"), "procedure");
  });
});
