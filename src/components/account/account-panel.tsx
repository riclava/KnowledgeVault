"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { PasswordAuthForm } from "@/components/account/password-auth-form";
import { authClient } from "@/lib/auth-client";

export function AccountPanel({
  authenticated,
  email,
  returnTo,
}: {
  authenticated: boolean;
  email: string | null;
  returnTo: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <section className="rounded-lg border bg-background p-6 shadow-sm sm:p-7">
      {authenticated ? (
        <div className="grid gap-5">
          <div className="grid gap-2">
            <h2 className="text-xl font-semibold">已登录</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              当前登录邮箱：<span className="font-medium text-foreground">{email}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href={returnTo} className={buttonVariants()}>
              继续训练
              <ArrowRight data-icon="inline-end" />
            </Link>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await authClient.signOut();

                  if (result?.error) {
                    toast.error(result.error.message ?? "退出登录失败");
                    return;
                  }

                  router.push(returnTo);
                  router.refresh();
                })
              }
            >
              {isPending ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <LogOut data-icon="inline-start" />
              )}
              退出登录
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-2">
            <h2 className="text-xl font-semibold">登录或注册</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              使用邮箱和密码继续；没有账号时切到注册。
            </p>
          </div>

          <PasswordAuthForm callbackURL={returnTo} />
        </div>
      )}
    </section>
  );
}
