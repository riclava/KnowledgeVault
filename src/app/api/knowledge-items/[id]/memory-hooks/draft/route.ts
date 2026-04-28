import { NextResponse } from "next/server";

import { normalizeRouteParam } from "@/lib/route-params";
import { withAuthenticatedApi } from "@/server/auth/current-learner";
import { draftKnowledgeItemMemoryHook } from "@/server/services/knowledge-item-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = normalizeRouteParam(rawId);

  return withAuthenticatedApi(async (current) => {
    try {
      const draft = await draftKnowledgeItemMemoryHook({
        knowledgeItemIdOrSlug: id,
        userId: current.learner.id,
      });

      if (!draft) {
        return NextResponse.json(
          {
            error: "KnowledgeItem not found",
          },
          { status: 404 },
        );
      }

      return NextResponse.json({
        data: draft,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "AI 提示生成失败。",
        },
        { status: 502 },
      );
    }
  });
}
