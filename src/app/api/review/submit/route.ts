import { NextResponse } from "next/server";

import { withAuthenticatedApi } from "@/server/auth/current-learner";
import { submitReview } from "@/server/services/review-service";
import type { ReviewSubmitInput } from "@/types/review";

export async function POST(request: Request) {
  const payload = (await request.json()) as Partial<ReviewSubmitInput>;
  const error = validateSubmitPayload(payload);

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return withAuthenticatedApi(async (current) => {
    const result = await submitReview({
      userId: current.learner.id,
      input: payload as ReviewSubmitInput,
    });

    return NextResponse.json({
      data: result,
    });
  });
}

function validateSubmitPayload(payload: Partial<ReviewSubmitInput>) {
  if (!payload.sessionId) {
    return "sessionId is required";
  }

  if (!payload.reviewItemId) {
    return "reviewItemId is required";
  }

  if (!payload.knowledgeItemId) {
    return "knowledgeItemId is required";
  }

  if (!payload.result) {
    return "result is required";
  }

  if (!["again", "hard", "good", "easy"].includes(payload.result)) {
    return "result is invalid";
  }

  return null;
}
