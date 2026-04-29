import { NextResponse } from "next/server";

import { withAdminApi } from "@/server/admin/admin-auth";
import {
  createKnowledgeDedupeRunForAdmin,
  listKnowledgeDedupeRunsForAdmin,
} from "@/server/admin/admin-knowledge-dedupe-scan-service";

export async function GET() {
  return withAdminApi(async () =>
    NextResponse.json({ data: await listKnowledgeDedupeRunsForAdmin() }),
  );
}

export async function POST(request: Request) {
  return withAdminApi(async (admin) => {
    try {
      const run = await createKnowledgeDedupeRunForAdmin({
        adminUserId: admin.id,
        input: await request.json().catch(() => null),
      });

      return NextResponse.json({ data: run });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "去重扫描失败。" },
        { status: 400 },
      );
    }
  });
}
