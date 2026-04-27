import { NextResponse } from "next/server";

import { withAuthenticatedApi } from "@/server/auth/current-learner";
import { removeMemoryHook } from "@/server/services/knowledge-item-service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuthenticatedApi(async (current) => {
    const result = await removeMemoryHook({
      hookId: id,
      userId: current.learner.id,
    });

    if (!result) {
      return NextResponse.json(
        {
          error: "Memory hook not found",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: {
        id: result.id,
      },
    });
  });
}
