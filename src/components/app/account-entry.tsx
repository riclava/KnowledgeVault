import Link from "next/link";
import { LayoutDashboard, LogIn, UserRound } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCurrentLearner } from "@/server/auth/current-learner";

export async function AccountEntry({ returnTo }: { returnTo: string }) {
  const current = await getCurrentLearner();
  const href = `/account?returnTo=${encodeURIComponent(returnTo)}`;

  if (current) {
    const accountLabel = current.authUser?.email ?? current.learner.email ?? "账户";

    return (
      <>
        {current.learner.role === "admin" ? (
          <Link
            href="/admin"
            className={buttonVariants({
              size: "sm",
              variant: "secondary",
            })}
          >
            <LayoutDashboard data-icon="inline-start" />
            管理后台
          </Link>
        ) : null}
        <Link
          href={href}
          className={cn(
            buttonVariants({
              size: "sm",
              variant: "outline",
            }),
            "max-w-56 justify-start",
          )}
        >
          <UserRound data-icon="inline-start" />
          <span className="truncate">{accountLabel}</span>
        </Link>
      </>
    );
  }

  return (
    <Link
      href={href}
      className={buttonVariants({
        size: "sm",
        variant: "outline",
      })}
    >
      <LogIn data-icon="inline-start" />
      登录
    </Link>
  );
}
