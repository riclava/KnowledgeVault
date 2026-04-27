import { NextResponse } from "next/server";

import { withAuthenticatedApi } from "@/server/auth/current-learner";
import { deferReview } from "@/server/services/review-service";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    knowledgeItemId?: string;
    minutes?: number;
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
    const result = await deferReview({
      userId: current.learner.id,
      knowledgeItemId,
      minutes: payload.minutes,
    });

    return NextResponse.json({
      data: result,
    });
  });
}
