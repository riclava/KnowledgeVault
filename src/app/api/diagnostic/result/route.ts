import { NextResponse } from "next/server";

import { withAuthenticatedApi } from "@/server/auth/current-learner";
import { resolveLearningDomain } from "@/server/learning-domain";
import { getLatestDiagnosticResult } from "@/server/services/diagnostic-service";

export async function GET(request: Request) {
  const url = new URL(request.url);

  return withAuthenticatedApi(async (current) => {
    const learningDomain = await resolveLearningDomain(url.searchParams.get("domain"));
    const result = await getLatestDiagnosticResult({
      userId: current.learner.id,
      domain: learningDomain.currentDomain,
    });

    if (!result) {
      return NextResponse.json(
        {
          error: "Diagnostic result not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: result,
    });
  });
}
