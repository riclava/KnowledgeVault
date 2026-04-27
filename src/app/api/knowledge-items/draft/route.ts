import { NextResponse } from "next/server";

import { withAuthenticatedApi } from "@/server/auth/current-learner";
import { generateKnowledgeItemDraft } from "@/server/services/knowledge-item-draft-service";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    prompt?: string;
  };
  const prompt = payload.prompt?.trim();

  if (!prompt) {
    return NextResponse.json(
      {
        error: "prompt is required",
      },
      { status: 400 },
    );
  }

  return withAuthenticatedApi(async () => {
    try {
      const draft = await generateKnowledgeItemDraft({
        prompt,
      });

      return NextResponse.json({
        data: draft,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to generate knowledgeItem draft",
        },
        { status: 503 },
      );
    }
  });
}
