import { NextResponse } from "next/server";

import { withAdminApi } from "@/server/admin/admin-auth";
import {
  normalizeAdminImportRequest,
  runAdminImport,
} from "@/server/admin/admin-import-service";

export async function POST(request: Request) {
  return withAdminApi(async (admin) => {
    let input;

    try {
      input = normalizeAdminImportRequest(await request.json());
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "请求参数无效。",
        },
        { status: 400 },
      );
    }

    const result = await runAdminImport({
      adminUserId: admin.id,
      input,
    });

    return NextResponse.json({ data: result });
  });
}
