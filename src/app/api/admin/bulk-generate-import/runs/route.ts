import { NextResponse } from "next/server";

import { withAdminApi } from "@/server/admin/admin-auth";
import {
  createAdminBulkGenerateImportRunForAdmin,
  listAdminBulkGenerateImportRunsForAdmin,
} from "@/server/admin/admin-bulk-generate-import-service";

export async function GET() {
  return withAdminApi(async (admin) => {
    const runs = await listAdminBulkGenerateImportRunsForAdmin({
      adminUserId: admin.id,
    });

    return NextResponse.json({ data: runs });
  });
}

export async function POST(request: Request) {
  return withAdminApi(async (admin) => {
    try {
      const result = await createAdminBulkGenerateImportRunForAdmin({
        adminUserId: admin.id,
        input: await request.json(),
      });

      return NextResponse.json({ data: result }, { status: 201 });
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "批量生成任务创建失败。",
        },
        { status: 400 },
      );
    }
  });
}
