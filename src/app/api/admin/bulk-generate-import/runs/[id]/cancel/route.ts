import { NextResponse } from "next/server";

import { normalizeRouteParam } from "@/lib/route-params";
import { withAdminApi } from "@/server/admin/admin-auth";
import { cancelAdminBulkGenerateImportRunForAdmin } from "@/server/admin/admin-bulk-generate-import-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const runId = normalizeRouteParam(rawId);

  return withAdminApi(async (admin) => {
    const result = await cancelAdminBulkGenerateImportRunForAdmin({
      adminUserId: admin.id,
      runId,
    });

    return NextResponse.json({ data: result });
  });
}
