"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MagicLinkSignInForm } from "@/components/account/magic-link-sign-in-form";
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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <section className="rounded-lg border bg-background p-6 shadow-sm">
      {authenticated ? (
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Badge variant="secondary" className="w-fit">
              已连接账号
            </Badge>
            <h2 className="text-xl font-semibold">已登录</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              当前登录邮箱：<span className="font-medium text-foreground">{email}</span>
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
            <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
              <ShieldCheck data-icon="inline-start" />
              当前状态
            </div>
            当前训练记录已绑定到这个账号。
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);

                  const result = await authClient.signOut();

                  if (result?.error) {
                    setError(result.error.message ?? "退出登录失败");
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
            <Badge variant="secondary" className="w-fit">
              登录
            </Badge>
            <h2 className="text-xl font-semibold">输入邮箱继续</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              使用 magic link 登录。登录后进入训练页。
            </p>
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <MagicLinkSignInForm callbackURL={returnTo} />
        </div>
      )}
    </section>
  );
}
