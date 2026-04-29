import { NextResponse } from "next/server";

import { normalizeRouteParam } from "@/lib/route-params";
import { withAdminApi } from "@/server/admin/admin-auth";
import { ignoreKnowledgeDedupeCandidateForAdmin } from "@/server/admin/admin-knowledge-dedupe-scan-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = normalizeRouteParam(rawId);

  return withAdminApi(async () =>
    NextResponse.json({
      data: await ignoreKnowledgeDedupeCandidateForAdmin({
        id,
        input: await request.json().catch(() => null),
      }),
    }),
  );
}
