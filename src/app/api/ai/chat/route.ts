import { NextResponse } from "next/server";

import { withAuthenticatedApi } from "@/server/auth/current-learner";
import { generateAiChatReply } from "@/server/services/ai-chat-service";

export async function POST(request: Request) {
  return withAuthenticatedApi(async () => {
    let input: unknown;

    try {
      input = await request.json();
    } catch {
      return NextResponse.json({ error: "请求参数无效。" }, { status: 400 });
    }

    try {
      const reply = await generateAiChatReply({ input });

      return NextResponse.json({ data: reply });
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "AI 助手暂时不可用。",
        },
        { status: 400 },
      );
    }
  });
}
