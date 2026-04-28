import { NextResponse } from "next/server";

import { withAuthenticatedApi } from "@/server/auth/current-learner";
import {
  normalizeAdminImportActionRequest,
  previewLearnerImport,
  savePreviewedLearnerImport,
} from "@/server/admin/admin-import-service";

export async function POST(request: Request) {
  return withAuthenticatedApi(async (current) => {
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
        ? await previewLearnerImport({
            userId: current.learner.id,
            input: action.input,
          })
        : await savePreviewedLearnerImport({
            userId: current.learner.id,
            importRunId: action.importRunId,
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
