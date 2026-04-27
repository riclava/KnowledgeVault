import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;

export type CurrentLearner = {
  learner: {
    id: string;
    email: string | null;
    displayName: string | null;
    role: "learner" | "admin";
  };
  anonymous: boolean;
  authSession: AuthSession;
  authUser: {
    id: string;
    email: string;
    name: string;
    learnerId: string | null;
  } | null;
};

export async function getCurrentAuthSession() {
  const requestHeaders = new Headers(await headers());

  return auth.api.getSession({
    headers: requestHeaders,
  });
}

export async function getCurrentLearner(): Promise<CurrentLearner | null> {
  const authSession = await getCurrentAuthSession();

  if (!authSession?.user?.id) {
    return null;
  }

  const authUser = await ensureLearnerForAuthUser({
    authUserId: authSession.user.id,
  });

  return {
    learner: {
      id: authUser.learner!.id,
      email: authUser.learner!.email,
      displayName: authUser.learner!.displayName,
      role: authUser.learner!.role,
    },
    anonymous: false,
    authSession,
    authUser: {
      id: authUser.id,
      email: authUser.email,
      name: authUser.name,
      learnerId: authUser.learnerId,
    },
  };
}

export async function requireCurrentLearner() {
  const current = await getCurrentLearner();

  if (!current) {
    redirect("/");
  }

  return current;
}

export async function withAuthenticatedApi<T>(
  handler: (current: CurrentLearner) => Promise<T> | T,
) {
  const current = await getCurrentLearner();

  if (!current) {
    return NextResponse.json(
      {
        error: "请先登录后再继续。",
      },
      { status: 401 },
    );
  }

  return handler(current);
}

async function ensureLearnerForAuthUser({
  authUserId,
}: {
  authUserId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const authUser = await tx.authUser.findUnique({
      where: {
        id: authUserId,
      },
      include: {
        learner: true,
      },
    });

    if (!authUser) {
      throw new Error("Authenticated user not found");
    }

    if (authUser.learner) {
      return authUser;
    }

    const learnerDisplayName = authUser.name.trim() || authUser.email.split("@")[0];
    const candidateLearner =
      (await tx.user.findFirst({
        where: {
          email: authUser.email,
          authIdentity: {
            is: null,
          },
        },
      })) ??
      (await tx.user.create({
        data: {
          email: authUser.email,
          displayName: learnerDisplayName,
        },
      }));

    if (
      candidateLearner.email !== authUser.email ||
      candidateLearner.displayName !== learnerDisplayName
    ) {
      await tx.user.update({
        where: {
          id: candidateLearner.id,
        },
        data: {
          email: authUser.email,
          displayName: learnerDisplayName,
        },
      });
    }

    return tx.authUser.update({
      where: {
        id: authUser.id,
      },
      data: {
        learnerId: candidateLearner.id,
      },
      include: {
        learner: true,
      },
    });
  });
}
