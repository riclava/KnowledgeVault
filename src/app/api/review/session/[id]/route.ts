import { NextResponse } from "next/server";

import { withAuthenticatedApi } from "@/server/auth/current-learner";
import { getReviewSessionSnapshot } from "@/server/services/review-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuthenticatedApi(async (current) => {
    const snapshot = await getReviewSessionSnapshot({
      userId: current.learner.id,
      sessionId: id,
    });

    if (!snapshot) {
      return NextResponse.json(
        {
          error: "Review session not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: snapshot,
    });
  });
}
