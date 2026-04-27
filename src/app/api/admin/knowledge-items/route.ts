import { NextResponse } from "next/server";

import {
  listAdminKnowledgeItems,
  normalizeAdminKnowledgeItemSearchParams,
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
