import { NextResponse } from "next/server";

import { withAuthenticatedApi } from "@/server/auth/current-learner";
import { submitDiagnostic } from "@/server/services/diagnostic-service";
import type {
  DiagnosticAssessment,
  DiagnosticSubmission,
} from "@/types/diagnostic";

const assessmentValues = new Set<DiagnosticAssessment>([
  "none",
  "partial",
  "clear",
]);

export async function POST(request: Request) {
  const payload = await request.json();
  const validationError = validateSubmission(payload);

  if (validationError) {
    return NextResponse.json(
      {
        error: validationError,
      },
      { status: 400 },
    );
  }

  return withAuthenticatedApi(async (current) => {
    const result = await submitDiagnostic({
      userId: current.learner.id,
      submission: payload as DiagnosticSubmission,
    });

    return NextResponse.json({
      data: result,
    });
  });
}

function validateSubmission(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return "Invalid JSON payload";
  }

  const submission = payload as DiagnosticSubmission;

  if (typeof submission.domain !== "string" || submission.domain.length === 0) {
    return "domain is required";
  }

  if (!Array.isArray(submission.answers) || submission.answers.length === 0) {
    return "answers must contain at least one answer";
  }

  const validAnswers = submission.answers.every(
    (answer) =>
      typeof answer.reviewItemId === "string" &&
      answer.reviewItemId.length > 0 &&
      assessmentValues.has(answer.assessment),
  );

  return validAnswers ? null : "answers contain invalid reviewItemId or assessment";
}
