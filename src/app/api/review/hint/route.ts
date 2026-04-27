import { NextResponse } from "next/server";

import { withAuthenticatedApi } from "@/server/auth/current-learner";
import { getReviewHint } from "@/server/services/review-service";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    knowledgeItemId?: string;
  };

  if (!payload.knowledgeItemId) {
    return NextResponse.json(
      {
        error: "knowledgeItemId is required",
      },
      { status: 400 },
    );
  }

  const knowledgeItemId = payload.knowledgeItemId;

  return withAuthenticatedApi(async (current) => {
    const hint = await getReviewHint({
      userId: current.learner.id,
      knowledgeItemId,
    });

    return NextResponse.json({
      data: hint,
    });
  });
}
