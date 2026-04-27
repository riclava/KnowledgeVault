import { NextResponse } from "next/server";

import { withAuthenticatedApi } from "@/server/auth/current-learner";
import { recordStatsEvents } from "@/server/services/stats-service";

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    events?: Array<{
      knowledgeItemId?: string;
      studySessionId?: string;
      type?: "weak_item_impression" | "weak_item_opened";
    }>;
  };

  if (!payload.events || payload.events.length === 0) {
    return NextResponse.json(
      {
        error: "events are required",
      },
      { status: 400 },
    );
  }

  const validEvents = payload.events.filter(
    (event) =>
      event.type === "weak_item_impression" ||
      event.type === "weak_item_opened",
  ) as Array<{
    knowledgeItemId?: string;
    studySessionId?: string;
    type: "weak_item_impression" | "weak_item_opened";
  }>;

  return withAuthenticatedApi(async (current) => {
    await recordStatsEvents({
      userId: current.learner.id,
      events: validEvents,
    });

    return NextResponse.json({
      data: {
        recorded: validEvents.length,
      },
    });
  });
}
