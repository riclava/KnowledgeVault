import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import {
  getCurrentLearner,
  type CurrentLearner,
} from "@/server/auth/current-learner";

export type AdminPrincipal = {
  id: string;
  email: string | null;
  displayName: string | null;
  role: "admin";
};

export class AdminAccessError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AdminAccessError";
  }
}

export function assertAdminCurrentLearner(
  current: CurrentLearner,
): AdminPrincipal {
  if (current.learner.role !== "admin") {
    throw new AdminAccessError(403, "需要管理员权限。");
  }

  return {
    id: current.learner.id,
    email: current.learner.email,
    displayName: current.learner.displayName,
    role: "admin",
  };
}

export async function requireAdminPage() {
  const current = await getCurrentLearner();

  if (!current) {
    redirect("/account");
  }

  try {
    return assertAdminCurrentLearner(current);
  } catch (error) {
    if (error instanceof AdminAccessError) {
      redirect("/");
    }

    throw error;
  }
}

export async function withAdminApi<T>(
  handler: (admin: AdminPrincipal) => Promise<T> | T,
) {
  const current = await getCurrentLearner();

  if (!current) {
    return NextResponse.json({ error: "请先登录后再继续。" }, { status: 401 });
  }

  try {
    return await handler(assertAdminCurrentLearner(current));
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    throw error;
  }
}
