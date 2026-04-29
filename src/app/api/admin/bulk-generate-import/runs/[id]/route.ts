import { NextResponse } from "next/server";

import { normalizeRouteParam } from "@/lib/route-params";
import { withAdminApi } from "@/server/admin/admin-auth";
import {
  deleteAdminBulkGenerateImportRunForAdmin,
  getAdminBulkGenerateImportRunDetailForAdmin,
} from "@/server/admin/admin-bulk-generate-import-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const runId = normalizeRouteParam(rawId);

  return withAdminApi(async (admin) => {
    const run = await getAdminBulkGenerateImportRunDetailForAdmin({
      adminUserId: admin.id,
      runId,
    });

    if (!run) {
      return NextResponse.json(
        { error: "批量生成任务不存在。" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: run });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const runId = normalizeRouteParam(rawId);

  return withAdminApi(async (admin) => {
    const result = await deleteAdminBulkGenerateImportRunForAdmin({
      adminUserId: admin.id,
      runId,
    });

    if (!result.deleted) {
      return NextResponse.json(
        { error: "只能删除已完成、失败或已取消且没有处理中行的任务。" },
        { status: 409 },
      );
    }

    return NextResponse.json({ data: result });
  });
}
