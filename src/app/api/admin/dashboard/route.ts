import { NextResponse } from "next/server";

import { withAdminApi } from "@/server/admin/admin-auth";
import { getAdminDashboard } from "@/server/admin/admin-dashboard-service";

export async function GET() {
  return withAdminApi(async () => {
    return NextResponse.json({
      data: await getAdminDashboard(),
    });
  });
}
