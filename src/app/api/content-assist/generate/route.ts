import { NextResponse } from "next/server";

import { withAuthenticatedApi } from "@/server/auth/current-learner";
import { regenerateContentAssistDraft } from "@/server/services/content-assist-service";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    knowledgeItemIdOrSlug?: string;
  };

  if (!payload.knowledgeItemIdOrSlug?.trim()) {
    return NextResponse.json(
      {
        error: "knowledgeItemIdOrSlug is required",
      },
      { status: 400 },
    );
  }

  const knowledgeItemIdOrSlug = payload.knowledgeItemIdOrSlug.trim();

  return withAuthenticatedApi(async () => {
    const result = await regenerateContentAssistDraft({
      knowledgeItemIdOrSlug,
    });

    if (!result) {
      return NextResponse.json(
        {
          error: "KnowledgeItem not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: result.draft,
    });
  });
}
