import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Brain,
  ClipboardCheck,
  FlaskConical,
  Lightbulb,
  Orbit,
} from "lucide-react";

import { PasswordAuthForm } from "@/components/account/password-auth-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCurrentLearner } from "@/server/auth/current-learner";

export const dynamic = "force-dynamic";

const loopSteps = [
  {
    title: "诊断",
    description: "先找出薄弱知识项。",
    icon: Brain,
  },
  {
    title: "复习",
    description: "按队列完成今天的题目。",
    icon: ClipboardCheck,
  },
  {
    title: "补弱",
    description: "Again 和 Hard 会进入补弱。",
    icon: Orbit,
  },
  {
    title: "恢复线索",
    description: "把提示写成自己的话。",
    icon: Lightbulb,
  },
];

const sampleKnowledgeItems = [
  {
    eyebrow: "学习方法",
    title: "费曼学习法复盘",
    description: "用自己的话讲一遍，定位讲不清的缺口。",
  },
  {
    eyebrow: "英语词汇",
    title: "aberration",
    description: "偏离常态的事物或异常情况。",
  },
];

export default async function Home() {
  const current = await getCurrentLearner();

  if (current) {
    redirect("/review");
  }

  return (
    <main className="min-h-svh overflow-hidden bg-background text-foreground">
      <div className="relative isolate flex min-h-svh flex-col">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <FlaskConical data-icon="inline-start" />
            </span>
            <span>
              <span className="block text-base font-semibold tracking-tight">KnowledgeVault</span>
              <span className="hidden text-xs text-muted-foreground sm:block">
                登录后进入训练页
              </span>
            </span>
          </Link>

          <Link
            href="/account"
            className={cn(
              buttonVariants({
                size: "sm",
                variant: "outline",
              }),
              "bg-background",
            )}
          >
            账号中心
          </Link>
        </header>

        <section className="mx-auto grid w-full max-w-6xl flex-1 gap-4 px-4 pb-4 pt-4 md:px-6 lg:grid-cols-[minmax(0,1.02fr)_minmax(20rem,0.78fr)] lg:pt-16">
          <div className="grid self-start gap-4">
            <div className="grid gap-3">
              <div className="grid max-w-2xl gap-2">
                <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
                  Review-first
                </Badge>
                <h1 className="text-3xl font-semibold tracking-tight text-balance md:text-5xl">
                  登录后开始今天的复习
                </h1>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                  进入诊断、复习、补弱，把提示逐步写成自己的话。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="#login"
                  className={cn(
                    buttonVariants({
                      size: "lg",
                    }),
                    "h-10 rounded-full px-4 text-sm shadow-sm",
                  )}
                >
                  登录开始训练
                  <ArrowRight data-icon="inline-end" />
                </Link>
                <Link
                  href="#loop"
                  className={cn(
                    buttonVariants({
                      size: "lg",
                      variant: "outline",
                    }),
                    "hidden h-10 rounded-full bg-background px-4 text-sm sm:inline-flex",
                  )}
                >
                  看训练流程
                </Link>
              </div>
            </div>

            <div id="loop" className="hidden gap-2 sm:grid sm:grid-cols-2">
              {loopSteps.map((step, index) => {
                const Icon = step.icon;

                return (
                  <article
                    key={step.title}
                    className="flex items-start gap-3 rounded-lg border bg-background p-3 shadow-sm"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Icon data-icon="inline-start" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[0.68rem] uppercase text-muted-foreground">Step {index + 1}</p>
                      <h2 className="text-sm font-semibold">{step.title}</h2>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{step.description}</p>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden gap-2 sm:grid sm:grid-cols-2">
              {sampleKnowledgeItems.map((item) => (
                <article
                  key={item.title}
                  className="rounded-lg border bg-background p-3 shadow-sm"
                >
                  <p className="text-[0.68rem] font-medium uppercase text-muted-foreground">
                    {item.eyebrow}
                  </p>
                  <h2 className="mt-1 text-base font-semibold tracking-tight">{item.title}</h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
                </article>
              ))}
            </div>
          </div>

          <aside
            id="login"
            className="relative self-start overflow-hidden rounded-2xl border bg-background px-4 py-4 text-foreground shadow-sm md:px-5 md:py-5"
          >
            <div className="relative grid gap-4">
              <div className="grid gap-1.5">
                <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
                  账号密码
                </Badge>
                <div className="grid gap-1">
                  <h2 className="text-lg font-semibold tracking-tight">登录或注册</h2>
                  <p className="text-sm leading-5 text-muted-foreground">
                    使用邮箱和密码进入训练，新用户可以直接创建账号。
                  </p>
                </div>
              </div>

              <PasswordAuthForm
                callbackURL="/review"
                className="gap-3"
                fieldClassName="gap-2"
                inputClassName="h-10 bg-background"
                buttonClassName="h-10 rounded-full"
              />

              <div className="grid gap-1.5 border-t pt-3 text-xs leading-5 text-muted-foreground">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                  <p>登录后进入训练页。</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-secondary" />
                  <p>没有账号时可在同一个表单内注册。</p>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
