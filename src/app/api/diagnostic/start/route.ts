import { NextResponse } from "next/server";

import { withAuthenticatedApi } from "@/server/auth/current-learner";
import { resolveLearningDomain } from "@/server/learning-domain";
import { startDiagnostic } from "@/server/services/diagnostic-service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return withAuthenticatedApi(async () => {
    const learningDomain = await resolveLearningDomain(url.searchParams.get("domain"));
    const diagnostic = await startDiagnostic({
      domain: learningDomain.currentDomain,
    });

    return NextResponse.json({
      data: diagnostic,
    });
  });
}
