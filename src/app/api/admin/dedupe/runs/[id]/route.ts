import { NextResponse } from "next/server";

import { normalizeRouteParam } from "@/lib/route-params";
import { withAdminApi } from "@/server/admin/admin-auth";
import { getKnowledgeDedupeRunDetailForAdmin } from "@/server/admin/admin-knowledge-dedupe-scan-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = normalizeRouteParam(rawId);

  return withAdminApi(async () => {
    const run = await getKnowledgeDedupeRunDetailForAdmin(id);

    if (!run) {
      return NextResponse.json({ error: "Dedupe run not found" }, { status: 404 });
    }

    return NextResponse.json({ data: run });
  });
}
