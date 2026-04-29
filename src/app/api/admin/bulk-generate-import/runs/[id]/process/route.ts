import { NextResponse } from "next/server";

import { normalizeRouteParam } from "@/lib/route-params";
import { withAdminApi } from "@/server/admin/admin-auth";
import { startAdminBulkGenerateImportRunForAdmin } from "@/server/admin/admin-bulk-generate-import-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const runId = normalizeRouteParam(rawId);

  return withAdminApi(async (admin) => {
    try {
      const result = await startAdminBulkGenerateImportRunForAdmin({
        adminUserId: admin.id,
        runId,
      });

      return NextResponse.json({ data: result }, { status: 202 });
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "批量生成任务启动失败。",
        },
        { status: 400 },
      );
    }
  });
}
