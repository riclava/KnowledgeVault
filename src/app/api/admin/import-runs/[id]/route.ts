import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { normalizeRouteParam } from "@/lib/route-params";
import { withAdminApi } from "@/server/admin/admin-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = normalizeRouteParam(rawId);

  return withAdminApi(async () => {
    const importRun = await prisma.adminImportRun.findUnique({
      where: { id },
    });

    if (!importRun) {
      return NextResponse.json({ error: "Import run not found" }, { status: 404 });
    }

    return NextResponse.json({ data: importRun });
  });
}
