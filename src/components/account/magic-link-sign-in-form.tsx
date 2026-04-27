"use client";

import { useId, useState, useTransition } from "react";
import { Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export function MagicLinkSignInForm({
  callbackURL,
  className,
  fieldClassName,
  buttonClassName,
  inputClassName,
  submitLabel = "发送登录链接",
  successMessage = "登录链接已发送。开发环境未配置邮件服务时，可以在服务端日志里查看 magic link。",
}: {
  callbackURL: string;
  className?: string;
  fieldClassName?: string;
  buttonClassName?: string;
  inputClassName?: string;
  submitLabel?: string;
  successMessage?: string;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const emailFieldId = useId();

  return (
    <form
      className={cn("grid gap-4", className)}
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setError(null);
          setMessage(null);

          const normalizedEmail = email.trim();

          if (!normalizedEmail) {
            setError("请输入邮箱地址");
            return;
          }

          const result = await authClient.signIn.magicLink({
            email: normalizedEmail,
            callbackURL,
            newUserCallbackURL: callbackURL,
          });

          if (result?.error) {
            setError(result.error.message ?? "发送登录链接失败");
            return;
          }

          setMessage(successMessage);
        });
      }}
    >
      <div className={cn("grid gap-2", fieldClassName)}>
        <Label htmlFor={emailFieldId}>邮箱地址</Label>
        <Input
          id={emailFieldId}
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          className={inputClassName}
        />
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
          {message}
        </div>
      ) : null}

      <Button type="submit" disabled={isPending} className={buttonClassName}>
        {isPending ? (
          <Loader2 data-icon="inline-start" className="animate-spin" />
        ) : (
          <Mail data-icon="inline-start" />
        )}
        {submitLabel}
      </Button>
    </form>
  );
}
