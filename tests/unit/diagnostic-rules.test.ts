import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateBestDiagnosticAssessmentsByKnowledgeItem,
  calculateDiagnosticWeakKnowledgeItemIds,
  getDiagnosticAssessmentPriority,
} from "../../src/server/services/diagnostic-rules";

const reviewItems = [
  { id: "r1", knowledgeItemId: "f1" },
  { id: "r2", knowledgeItemId: "f1" },
  { id: "r3", knowledgeItemId: "f2" },
  { id: "r4", knowledgeItemId: "f3" },
];

describe("diagnostic rules", () => {
  it("marks none and partial answers as weak knowledgeItems once", () => {
    const weakKnowledgeItemIds = calculateDiagnosticWeakKnowledgeItemIds({
      reviewItems,
      answers: [
        { reviewItemId: "r1", assessment: "none" },
        { reviewItemId: "r2", assessment: "partial" },
        { reviewItemId: "r3", assessment: "clear" },
      ],
    });

    assert.deepEqual(weakKnowledgeItemIds, ["f1"]);
  });

  it("keeps the strongest assessment for each knowledgeItem", () => {
    const assessments = calculateBestDiagnosticAssessmentsByKnowledgeItem({
      reviewItems,
      answers: [
        { reviewItemId: "r1", assessment: "none" },
        { reviewItemId: "r2", assessment: "clear" },
        { reviewItemId: "r3", assessment: "partial" },
      ],
    });

    assert.equal(assessments.get("f1"), "clear");
    assert.equal(assessments.get("f2"), "partial");
    assert.equal(assessments.get("f3"), "none");
  });

  it("orders assessments by learning confidence", () => {
    assert.ok(
      getDiagnosticAssessmentPriority("clear") >
        getDiagnosticAssessmentPriority("partial"),
    );
    assert.ok(
      getDiagnosticAssessmentPriority("partial") >
        getDiagnosticAssessmentPriority("none"),
    );
  });
});
