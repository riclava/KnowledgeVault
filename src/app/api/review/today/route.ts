import { NextResponse } from "next/server";

import { withAuthenticatedApi } from "@/server/auth/current-learner";
import { resolveLearningDomain } from "@/server/learning-domain";
import { getTodayReviewSession } from "@/server/services/review-service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "weak" ? "weak" : "today";

  return withAuthenticatedApi(async (current) => {
    const learningDomain = await resolveLearningDomain(
      url.searchParams.get("domain"),
      current.learner.id,
    );
    const session = await getTodayReviewSession({
      userId: current.learner.id,
      domain: learningDomain.currentDomain,
      mode,
    });

    return NextResponse.json({
      data: session,
    });
  });
}
