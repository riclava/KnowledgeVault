import { NextResponse } from "next/server";

import { normalizeRouteParam } from "@/lib/route-params";
import { withAuthenticatedApi } from "@/server/auth/current-learner";
import { getKnowledgeItemRelationDetails } from "@/server/services/knowledge-item-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = normalizeRouteParam(rawId);
  return withAuthenticatedApi(async () => {
    const relations = await getKnowledgeItemRelationDetails(id);

    if (!relations) {
      return NextResponse.json(
        {
          error: "KnowledgeItem not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: relations,
    });
  });
}
