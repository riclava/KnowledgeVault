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
  const id = normalizeRouteParam(rawId);

  return withAdminApi(async (admin) => {
    const knowledgeItem = await getAdminKnowledgeItem(id);

    if (!knowledgeItem) {
      return NextResponse.json(
        { error: "Knowledge item not found" },
        { status: 404 },
      );
    }

    const body = await request.json();

    if (!isRecord(body)) {
      return NextResponse.json({ error: "请求参数无效。" }, { status: 400 });
    }

    if (body.slug !== knowledgeItem.slug) {
      return NextResponse.json(
        { error: "Slug 与当前知识项不匹配。" },
        { status: 400 },
      );
    }

    const result = await saveAdminKnowledgeItemAggregate({
      adminUserId: admin.id,
      input: body,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
