import { NextResponse } from "next/server";

import { withAuthenticatedApi } from "@/server/auth/current-learner";
import { approveContentAssistDraft } from "@/server/services/content-assist-service";

export async function POST(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  return withAuthenticatedApi(async () => {
    const draft = await approveContentAssistDraft(slug);

    if (!draft) {
      return NextResponse.json(
        {
          error: "Draft not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: draft,
    });
  });
}
