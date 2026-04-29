import { NextResponse } from "next/server";

import { withAdminApi } from "@/server/admin/admin-auth";
import {
  normalizeAdminImportActionRequest,
  previewAdminImport,
  savePreviewedAdminImport,
} from "@/server/admin/admin-import-service";

export async function POST(request: Request) {
  return withAdminApi(async (admin) => {
    let action;

    try {
      action = normalizeAdminImportActionRequest(await request.json());
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "请求参数无效。",
        },
        { status: 400 },
      );
    }

    let result;

    try {
      result = action.mode === "preview"
        ? await previewAdminImport({
            adminUserId: admin.id,
            input: action.input,
          })
        : await savePreviewedAdminImport({
            adminUserId: admin.id,
            importRunId: action.importRunId,
            batch: action.batch,
            allowDedupeOverride: action.allowDedupeOverride,
          });
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "导入请求失败。",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ data: result });
  });
}
