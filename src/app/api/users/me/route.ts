import { NextResponse } from "next/server";

import { withAuthenticatedApi } from "@/server/auth/current-learner";

export async function GET() {
  return withAuthenticatedApi(async (current) => {
    return NextResponse.json({
      data: {
        id: current.learner.id,
        displayName: current.learner.displayName,
        email: current.learner.email,
        anonymous: current.anonymous,
        auth: current.authUser
          ? {
              id: current.authUser.id,
              email: current.authUser.email,
              name: current.authUser.name,
            }
          : null,
      },
    });
  });
}
