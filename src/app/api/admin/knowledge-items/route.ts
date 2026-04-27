import { NextResponse } from "next/server";

import {
  listAdminKnowledgeItems,
  normalizeAdminKnowledgeItemSearchParams,
  saveAdminKnowledgeItemAggregate,
} from "@/server/admin/admin-knowledge-item-service";
import { withAdminApi } from "@/server/admin/admin-auth";

export async function GET(request: Request) {
  return withAdminApi(async () => {
    const searchParams = new URL(request.url).searchParams;
    const params = normalizeAdminKnowledgeItemSearchParams(searchParams);

    return NextResponse.json({
      data: await listAdminKnowledgeItems(params),
    });
  });
}

export async function POST(request: Request) {
  return withAdminApi(async (admin) => {
    const result = await saveAdminKnowledgeItemAggregate({
      adminUserId: admin.id,
      input: await request.json(),
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: "校验失败", errors: result.errors },
        { status: 400 },
      );
    }

    return NextResponse.json({ data: result.importRun });
  });
}
