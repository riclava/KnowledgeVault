import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateBestDiagnosticAssessmentsByKnowledgeItem,
  calculateDiagnosticWeakKnowledgeItemIds,
  getDiagnosticAssessmentPriority,
} from "../../src/server/services/diagnostic-rules";

const questions = [
  { id: "q1", knowledgeItemIds: ["f1"] },
  { id: "q2", knowledgeItemIds: ["f1"] },
  { id: "q3", knowledgeItemIds: ["f2"] },
  { id: "q4", knowledgeItemIds: ["f3", "f4"] },
];

describe("diagnostic rules", () => {
  it("marks none and partial answers as weak knowledgeItems once", () => {
    const weakKnowledgeItemIds = calculateDiagnosticWeakKnowledgeItemIds({
      questions,
      answers: [
        { questionId: "q1", assessment: "none" },
        { questionId: "q2", assessment: "partial" },
        { questionId: "q3", assessment: "clear" },
      ],
    });

    assert.deepEqual(weakKnowledgeItemIds, ["f1"]);
  });

  it("keeps the strongest assessment for each knowledgeItem", () => {
    const assessments = calculateBestDiagnosticAssessmentsByKnowledgeItem({
      questions,
      answers: [
        { questionId: "q1", assessment: "none" },
        { questionId: "q2", assessment: "clear" },
        { questionId: "q3", assessment: "partial" },
      ],
    });

    assert.equal(assessments.get("f1"), "clear");
    assert.equal(assessments.get("f2"), "partial");
    assert.equal(assessments.get("f3"), "none");
    assert.equal(assessments.get("f4"), "none");
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
