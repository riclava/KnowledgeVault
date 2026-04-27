import Link from "next/link";
import { LogIn, UserRound } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCurrentAuthSession } from "@/server/auth/current-learner";

export async function AccountEntry({ returnTo }: { returnTo: string }) {
  const session = await getCurrentAuthSession();
  const href = `/account?returnTo=${encodeURIComponent(returnTo)}`;

  if (session?.user) {
    return (
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
        <span className="truncate">{session.user.email}</span>
      </Link>
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
