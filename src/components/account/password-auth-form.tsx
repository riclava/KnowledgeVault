"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2, LogIn, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type PasswordAuthMode = "sign-in" | "sign-up";
type AuthField = "name" | "email" | "password";

export function PasswordAuthForm({
  callbackURL,
  className,
  fieldClassName,
  buttonClassName,
  inputClassName,
}: {
  callbackURL: string;
  className?: string;
  fieldClassName?: string;
  buttonClassName?: string;
  inputClassName?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<PasswordAuthMode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<AuthField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const nameFieldId = useId();
  const emailFieldId = useId();
  const passwordFieldId = useId();
  const nameErrorId = useId();
  const emailErrorId = useId();
  const passwordErrorId = useId();
  const isSignUp = mode === "sign-up";

  return (
    <form
      className={cn("grid gap-4", className)}
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setError(null);
          setFieldErrors({});

          const normalizedName = name.trim();
          const normalizedEmail = email.trim().toLowerCase();

          if (isSignUp && !normalizedName) {
            setFieldErrors({ name: "请输入昵称" });
            return;
          }

          if (!normalizedEmail) {
            setFieldErrors({ email: "请输入邮箱地址" });
            return;
          }

          if (!password) {
            setFieldErrors({ password: "请输入密码" });
            return;
          }

          if (password.length < 8) {
            setFieldErrors({ password: "密码至少需要 8 位" });
            return;
          }

          const result = isSignUp
            ? await authClient.signUp.email({
                name: normalizedName,
                email: normalizedEmail,
                password,
                callbackURL,
              })
            : await authClient.signIn.email({
                email: normalizedEmail,
                password,
                callbackURL,
              });

          if (result?.error) {
            setError(friendlyAuthError(result.error.message, isSignUp));
            return;
          }

          router.push(callbackURL);
          router.refresh();
        });
      }}
    >
      <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-1">
        <Button
          type="button"
          variant={isSignUp ? "ghost" : "secondary"}
          disabled={isPending}
          onClick={() => {
            setMode("sign-in");
            setError(null);
            setFieldErrors({});
          }}
          className="h-9"
        >
          <LogIn data-icon="inline-start" />
          登录
        </Button>
        <Button
          type="button"
          variant={isSignUp ? "secondary" : "ghost"}
          disabled={isPending}
          onClick={() => {
            setMode("sign-up");
            setError(null);
            setFieldErrors({});
          }}
          className="h-9"
        >
          <UserPlus data-icon="inline-start" />
          注册
        </Button>
      </div>

      {isSignUp ? (
        <div className={cn("grid gap-2", fieldClassName)}>
          <Label htmlFor={nameFieldId}>昵称</Label>
          <Input
            id={nameFieldId}
            type="text"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setFieldErrors((previous) => ({ ...previous, name: undefined }));
            }}
            placeholder="你的名字"
            required={isSignUp}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? nameErrorId : undefined}
            className={inputClassName}
          />
          {fieldErrors.name ? (
            <p id={nameErrorId} className="text-sm text-destructive">
              {fieldErrors.name}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className={cn("grid gap-2", fieldClassName)}>
        <Label htmlFor={emailFieldId}>邮箱地址</Label>
        <Input
          id={emailFieldId}
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setFieldErrors((previous) => ({ ...previous, email: undefined }));
          }}
          placeholder="you@example.com"
          required
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? emailErrorId : undefined}
          className={inputClassName}
        />
        {fieldErrors.email ? (
          <p id={emailErrorId} className="text-sm text-destructive">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div className={cn("grid gap-2", fieldClassName)}>
        <Label htmlFor={passwordFieldId}>密码</Label>
        <div className="relative">
          <Input
            id={passwordFieldId}
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldErrors((previous) => ({ ...previous, password: undefined }));
            }}
            placeholder="至少 8 位"
            minLength={8}
            required
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? passwordErrorId : undefined}
            className={cn("pr-12", inputClassName)}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-1 flex min-w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
          >
            {showPassword ? (
              <EyeOff data-icon="inline-start" />
            ) : (
              <Eye data-icon="inline-start" />
            )}
          </button>
        </div>
        {fieldErrors.password ? (
          <p id={passwordErrorId} className="text-sm text-destructive">
            {fieldErrors.password}
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Button type="submit" disabled={isPending} className={buttonClassName}>
        {isPending ? (
          <Loader2 data-icon="inline-start" className="animate-spin" />
        ) : (
          <KeyRound data-icon="inline-start" />
        )}
        {isSignUp ? "注册并进入训练" : "登录并进入训练"}
      </Button>
    </form>
  );
}

function friendlyAuthError(message: string | undefined, isSignUp: boolean) {
  if (!message) {
    return isSignUp ? "注册失败，请稍后重试。" : "登录失败，请检查邮箱和密码。";
  }

  if (/invalid|password|credential/i.test(message)) {
    return "邮箱或密码不正确。";
  }

  if (/already|exist/i.test(message)) {
    return "这个邮箱已经注册，可以直接登录。";
  }

  return message;
}
