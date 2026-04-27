import { NextResponse } from "next/server";

import { normalizeRouteParam } from "@/lib/route-params";
import { withAdminApi } from "@/server/admin/admin-auth";
import {
  deleteAdminKnowledgeItem,
  getAdminKnowledgeItem,
  saveAdminKnowledgeItemAggregate,
} from "@/server/admin/admin-knowledge-item-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = normalizeRouteParam(rawId);

  return withAdminApi(async () => {
    const knowledgeItem = await getAdminKnowledgeItem(id);

    if (!knowledgeItem) {
      return NextResponse.json(
        { error: "Knowledge item not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: knowledgeItem });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = normalizeRouteParam(rawId);

  return withAdminApi(async () => {
    const knowledgeItem = await getAdminKnowledgeItem(id);

    if (!knowledgeItem) {
      return NextResponse.json(
        { error: "Knowledge item not found" },
        { status: 404 },
      );
    }

    await deleteAdminKnowledgeItem(knowledgeItem.id);

    return NextResponse.json({ data: { deleted: true } });
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  normalizeRouteParam(rawId);

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
