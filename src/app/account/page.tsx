import Link from "next/link";
import { ArrowRight, Database, Mail, ShieldCheck } from "lucide-react";

import { PhaseShell } from "@/components/app/phase-shell";
import { AccountPanel } from "@/components/account/account-panel";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentLearner } from "@/server/auth/current-learner";

function sanitizeReturnTo(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/review";
  }

  return value;
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const current = await getCurrentLearner();
  const returnTo = sanitizeReturnTo(params.returnTo);
  const signedInEmail = current?.authSession?.user.email ?? null;

  return (
    <PhaseShell
      activePath="/account"
      eyebrow="账号"
      title="登录与会话"
      description="管理当前登录状态。"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <AccountPanel
          authenticated={Boolean(current)}
          email={signedInEmail}
          returnTo={returnTo}
        />

        <section className="grid gap-4 rounded-lg border bg-background p-6 shadow-sm">
          <div className="grid gap-3">
            <Badge variant="secondary" className="w-fit">
              当前状态
            </Badge>
            <h2 className="text-xl font-semibold">
              {current ? "已登录" : "未登录"}
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {current ? (
                <>
                  当前 learner ID：
                  <span className="font-mono text-foreground">{current.learner.id}</span>
                </>
              ) : (
                "登录后会创建对应的 learner 记录。"
              )}
            </p>
          </div>

          <div className="grid gap-3">
            <StatusCard
              icon={Mail}
              title="邮箱登录"
              description="使用 magic link 登录。"
            />
            <StatusCard
              icon={Database}
              title="训练记录"
              description="诊断、复习和个人提示都会写到当前账号。"
            />
            <StatusCard
              icon={ShieldCheck}
              title="跨设备继续"
              description="同一邮箱可在新设备继续。"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {current ? (
              <Link href={returnTo} className={buttonVariants({ variant: "outline" })}>
                回到当前训练
              </Link>
            ) : null}
            <Link href={current ? "/review" : "/#login"} className={buttonVariants()}>
              {current ? "去今日复习" : "回首页登录"}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </div>
        </section>
      </div>
    </PhaseShell>
  );
}

function StatusCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Mail;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-lg border p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon data-icon="inline-start" />
        <h3 className="font-medium">{title}</h3>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </article>
  );
}
