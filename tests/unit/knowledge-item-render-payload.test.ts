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

  it("rejects invalid payloads", () => {
    assert.throws(
      () => normalizeKnowledgeItemRenderPayload("plain_text", { text: "" }),
      /plain text/i,
    );
    assert.throws(
      () => normalizeKnowledgeItemRenderPayload("vocabulary", { term: "word" }),
      /definition/i,
    );
    assert.equal(parseKnowledgeItemType("formula"), null);
  });
});
