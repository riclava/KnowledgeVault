import { NextResponse } from "next/server";

import { withAuthenticatedApi } from "@/server/auth/current-learner";
import { resolveLearningDomain } from "@/server/learning-domain";
import { getWeakKnowledgeItems } from "@/server/services/stats-service";

export async function GET(request: Request) {
  const url = new URL(request.url);

  return withAuthenticatedApi(async (current) => {
    const learningDomain = await resolveLearningDomain(url.searchParams.get("domain"));
    const knowledgeItems = await getWeakKnowledgeItems({
      userId: current.learner.id,
      domain: learningDomain.currentDomain,
    });

    return NextResponse.json({
      data: knowledgeItems,
    });
  });
}
