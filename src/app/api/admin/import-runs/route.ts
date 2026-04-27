import { NextResponse } from "next/server";

import { withAdminApi } from "@/server/admin/admin-auth";
import { getRecentAdminImportRuns } from "@/server/admin/admin-import-service";

export async function GET() {
  return withAdminApi(async () => {
    return NextResponse.json({
      data: await getRecentAdminImportRuns(),
    });
  });
}
