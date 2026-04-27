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

import { MagicLinkSignInForm } from "@/components/account/magic-link-sign-in-form";
import { KnowledgeItemRenderer } from "@/components/knowledge-item/renderers/knowledge-item-renderer";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCurrentLearner } from "@/server/auth/current-learner";
import type {
  KnowledgeItemRenderPayloadByType,
  KnowledgeItemType,
} from "@/types/knowledge-item";

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

type SampleKnowledgeItem = {
  eyebrow: string;
  title: string;
  description: string;
} & {
  [TType in KnowledgeItemType]: {
    contentType: TType;
    renderPayload: KnowledgeItemRenderPayloadByType[TType];
  };
}[KnowledgeItemType];

const sampleKnowledgeItems: SampleKnowledgeItem[] = [
  {
    eyebrow: "学习方法",
    title: "费曼学习法复盘",
    contentType: "plain_text",
    renderPayload: {
      text: "用自己的话讲一遍，再定位讲不清楚的缺口。",
    },
    description: "用输出暴露理解缺口。",
  },
  {
    eyebrow: "英语词汇",
    title: "aberration",
    contentType: "vocabulary",
    renderPayload: {
      term: "aberration",
      definition: "偏离常态的事物或异常情况。",
      phonetic: "/ab-er-ay-shun/",
      partOfSpeech: "noun",
      examples: ["The sudden spike was an aberration, not a trend."],
    },
    description: "表示异常、偏离常态的情况。",
  },
];

export default async function Home() {
  const current = await getCurrentLearner();

  if (current) {
    redirect("/review");
  }

  return (
    <main className="min-h-svh overflow-hidden bg-[radial-gradient(circle_at_top,rgba(189,221,202,0.35),transparent_32%),linear-gradient(180deg,#f7f5ef_0%,#f2efe6_44%,#ebe7db_100%)] text-slate-950">
      <div className="relative isolate">
        <div className="absolute inset-x-0 top-0 -z-10 h-[36rem] bg-[linear-gradient(120deg,rgba(22,61,44,0.12),rgba(123,92,39,0.08)_42%,transparent_75%)]" />
        <div className="absolute right-[-8rem] top-20 -z-10 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute left-[-10rem] top-40 -z-10 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl" />

        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-slate-950 text-slate-50 shadow-[0_12px_30px_rgba(15,23,42,0.16)]">
              <FlaskConical data-icon="inline-start" />
            </span>
            <span>
              <span className="block text-base font-semibold tracking-tight">KnowledgeVault</span>
              <span className="block text-xs text-slate-600">
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
              "border-slate-300/80 bg-white/70 backdrop-blur-sm",
            )}
          >
            账号中心
          </Link>
        </header>

        <section className="mx-auto grid min-h-[calc(100svh-5rem)] w-full max-w-6xl gap-8 px-5 pb-10 pt-2 md:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)] lg:items-center lg:pb-16">
          <div className="grid gap-6">
            <div className="grid gap-4">
              <Badge className="w-fit rounded-full border border-slate-900/10 bg-white/70 px-3 py-1 text-slate-700 shadow-sm">
                Review-first
              </Badge>
              <div className="grid max-w-3xl gap-3">
                <h1 className="text-4xl font-semibold tracking-[-0.05em] text-balance md:text-6xl">
                  登录后开始今天的复习
                </h1>
                <p className="max-w-xl text-sm leading-6 text-slate-700 md:text-base">
                  进入诊断、复习、补弱，并把提示逐步写成自己的话。
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="#login"
                  className={cn(
                    buttonVariants({
                      size: "lg",
                    }),
                    "h-11 rounded-full bg-slate-950 px-5 text-sm shadow-[0_18px_40px_rgba(15,23,42,0.18)] hover:bg-slate-800",
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
                    "h-11 rounded-full border-slate-300/80 bg-white/60 px-5 text-sm backdrop-blur-sm",
                  )}
                >
                  看训练流程
                </Link>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {sampleKnowledgeItems.map((item) => (
                <article
                  key={item.title}
                  className="rounded-[1.5rem] border border-white/70 bg-white/70 p-4 shadow-[0_18px_40px_rgba(54,57,42,0.07)] backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1"
                >
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                    {item.eyebrow}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold tracking-tight">{item.title}</h2>
                  <KnowledgeItemRenderer
                    block
                    contentType={item.contentType}
                    payload={item.renderPayload}
                  />
                  <p className="mt-3 text-sm leading-5 text-slate-600">{item.description}</p>
                </article>
              ))}
            </div>
          </div>

          <aside
            id="login"
            className="relative overflow-hidden rounded-[1.75rem] border border-slate-900/10 bg-slate-950 px-5 py-5 text-slate-50 shadow-[0_26px_60px_rgba(15,23,42,0.22)] md:px-6 md:py-6"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_55%)]" />
            <div className="relative grid gap-5">
              <div className="grid gap-2">
                <Badge className="w-fit rounded-full bg-white/12 px-3 py-1 text-slate-100">
                  Magic link 登录
                </Badge>
                <div className="grid gap-1.5">
                  <h2 className="text-xl font-semibold tracking-tight">输入邮箱继续</h2>
                  <p className="text-sm leading-5 text-slate-300">
                    使用 magic link 登录。训练记录会保存在账号下。
                  </p>
                </div>
              </div>

              <MagicLinkSignInForm
                callbackURL="/review"
                fieldClassName="gap-3"
                inputClassName="h-11 border-white/15 bg-white/8 text-slate-50 placeholder:text-slate-400"
                buttonClassName="h-11 rounded-full bg-[#d5b36f] text-slate-950 hover:bg-[#ddb96e]"
                submitLabel="发送登录链接"
                successMessage="登录链接已发送。开发环境未配置邮件服务时，可以在服务端日志里查看 magic link。"
              />

              <div className="grid gap-2 border-t border-white/10 pt-4 text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-300" />
                  <p>登录后进入训练页。</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" />
                  <p>开发环境可在服务端日志查看 magic link。</p>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>

      <section
        id="loop"
        className="border-y border-slate-900/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.62),rgba(255,255,255,0.3))]"
      >
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-5 py-10 md:px-8 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
          <div className="grid gap-3">
            <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
              流程
            </Badge>
            <h2 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">
              登录后先做训练。
            </h2>
            <p className="max-w-md text-sm leading-6 text-slate-700">
              首页只保留登录和流程说明。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {loopSteps.map((step, index) => {
              const Icon = step.icon;

              return (
                <article
                  key={step.title}
                  className="grid gap-2 rounded-[1.4rem] border border-slate-900/8 bg-white/70 p-4 shadow-[0_16px_36px_rgba(54,57,42,0.06)] backdrop-blur-sm transition-colors duration-300 hover:border-slate-900/18"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-slate-950 text-slate-50">
                      <Icon data-icon="inline-start" />
                    </span>
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        Step {index + 1}
                      </p>
                      <h3 className="text-base font-semibold">{step.title}</h3>
                    </div>
                  </div>
                  <p className="max-w-2xl text-sm leading-5 text-slate-600">
                    {step.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-900/8 bg-slate-950 text-slate-50">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-5 py-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="grid gap-2">
            <p className="text-sm text-slate-300">准备好了就登录。</p>
          </div>

          <Link
            href="#login"
            className={cn(
              buttonVariants({
                size: "lg",
              }),
              "h-10 rounded-full bg-[#d5b36f] px-5 text-slate-950 hover:bg-[#ddb96e]",
            )}
          >
            去登录
            <ArrowRight data-icon="inline-end" />
          </Link>
        </div>
      </section>
    </main>
  );
}
