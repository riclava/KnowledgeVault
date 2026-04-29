import { NextResponse } from "next/server";

import { normalizeRouteParam } from "@/lib/route-params";
import { withAdminApi } from "@/server/admin/admin-auth";
import { mergeKnowledgeDedupeCandidateForAdmin } from "@/server/admin/admin-knowledge-dedupe-merge-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = normalizeRouteParam(rawId);

  return withAdminApi(async () => {
    try {
      const result = await mergeKnowledgeDedupeCandidateForAdmin({
        candidateId: id,
        input: await request.json().catch(() => null),
      });

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ data: result });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "合并失败。" },
        { status: 400 },
      );
    }
  });
}
