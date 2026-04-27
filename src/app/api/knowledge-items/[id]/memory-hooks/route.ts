import { NextResponse } from "next/server";

import { normalizeRouteParam } from "@/lib/route-params";
import { withAuthenticatedApi } from "@/server/auth/current-learner";
import {
  getKnowledgeItemMemoryHooks,
  saveKnowledgeItemMemoryHook,
} from "@/server/services/knowledge-item-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = normalizeRouteParam(rawId);
  return withAuthenticatedApi(async (current) => {
    const hooks = await getKnowledgeItemMemoryHooks({
      knowledgeItemIdOrSlug: id,
      userId: current.learner.id,
    });

    if (!hooks) {
      return NextResponse.json(
        {
          error: "KnowledgeItem not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: hooks,
    });
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = normalizeRouteParam(rawId);
  const payload = (await request.json()) as {
    content?: string;
  };

  if (!payload.content?.trim()) {
    return NextResponse.json(
      {
        error: "content is required",
      },
      { status: 400 },
    );
  }

  const content = payload.content?.trim();

  return withAuthenticatedApi(async (current) => {
    const hook = await saveKnowledgeItemMemoryHook({
      knowledgeItemIdOrSlug: id,
      userId: current.learner.id,
      content: content!,
    });

    if (!hook) {
      return NextResponse.json(
        {
          error: "KnowledgeItem not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        data: hook,
      },
      { status: 201 },
    );
  });
}
