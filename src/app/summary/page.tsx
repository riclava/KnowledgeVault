import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Lightbulb,
  Route,
  Sparkles,
  Target,
} from "lucide-react";

import { PhaseShell } from "@/components/app/phase-shell";
import { WeakKnowledgeItemList } from "@/components/summary/weak-knowledge-item-list";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireCurrentLearner } from "@/server/auth/current-learner";
import { resolveLearningDomain } from "@/server/learning-domain";
import {
  getProgressStats,
  getSummaryStats,
} from "@/server/services/stats-service";
import type { ProgressStats, SummaryStats } from "@/types/stats";

export const dynamic = "force-dynamic";

export default async function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const current = await requireCurrentLearner();
  const params = await searchParams;
  const learningDomain = await resolveLearningDomain(params.domain);
  const [summary, progress] = await Promise.all([
    getSummaryStats({
      userId: current.learner.id,
      domain: learningDomain.currentDomain,
    }),
    getProgressStats({
      userId: current.learner.id,
      domain: learningDomain.currentDomain,
    }),
  ]);
  const latestSession = summary.latestSession;
  const primaryAction = addDomainToAction(
    buildPrimaryAction(summary, progress),
    learningDomain.currentDomain,
  );
  const completionMessage = buildCompletionMessage(summary, progress);

  return (
    <PhaseShell
      activePath="/summary"
      eyebrow="复习总结"
      title="结果与下一步"
      learningDomain={learningDomain}
    >
      <div className="grid gap-6">
        <section className="rounded-lg border bg-background p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="grid max-w-3xl gap-3">
              <Badge
                variant={primaryAction.priority === "high" ? "destructive" : "secondary"}
                className="w-fit"
              >
                {primaryAction.badge}
              </Badge>
              <h2 className="text-2xl font-semibold">{completionMessage.title}</h2>
            </div>
            <Link href={primaryAction.href} className={buttonVariants()}>
              {primaryAction.label}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="rounded-lg border p-5">
              {latestSession ? (
                <div className="grid gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="grid gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex size-10 items-center justify-center rounded-md bg-muted">
                          <BarChart3 data-icon="inline-start" />
                        </span>
                        <div>
                          <h3 className="text-lg font-semibold">本轮训练结果</h3>
                          <p className="text-sm text-muted-foreground">
                            共完成 {latestSession.reviewCount} 题，用时{" "}
                            {latestSession.durationMinutes} 分钟。
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border px-4 py-3 text-sm text-muted-foreground">
                      平均单题耗时{" "}
                      <span className="font-medium text-foreground">
                        {latestSession.averageResponseTimeMs
                          ? `${Math.round(latestSession.averageResponseTimeMs / 1000)} 秒`
                          : "暂无记录"}
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    {(
                      [
                        ["again", "想不起来"],
                        ["hard", "有点吃力"],
                        ["good", "基本记住"],
                        ["easy", "很轻松"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key} className="rounded-lg border p-4">
                        <p className="text-2xl font-semibold">
                          {latestSession.grades[key]}
                        </p>
                        <p className="text-sm text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  <h3 className="text-lg font-semibold">还没有可总结的复习记录</h3>
                </div>
              )}
            </div>

            <div className="grid gap-4">
              <div className="rounded-lg border p-5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 data-icon="inline-start" />
                  <h3 className="font-semibold">下一步只做这一件事</h3>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={primaryAction.href} className={buttonVariants({ size: "sm" })}>
                    {primaryAction.label}
                  </Link>
                  {summary.immediateWeakKnowledgeItems[0] ? (
                    <Link
                      href={`/knowledge-items/${summary.immediateWeakKnowledgeItems[0].slug}?from=summary&focus=anti-patterns`}
                      className={buttonVariants({ size: "sm", variant: "outline" })}
                    >
                      打开最弱一条
                    </Link>
                  ) : null}
                  <Link
                    href="/knowledge-items"
                    className={buttonVariants({ size: "sm", variant: "outline" })}
                  >
                    浏览知识项
                  </Link>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ProgressCard label="已纳入训练知识项" value={progress.trackedKnowledgeItemCount} />
                <ProgressCard label="当前到期" value={progress.dueNowCount} />
                <ProgressCard label="稳定中" value={progress.stableCount} />
                <ProgressCard label="需要补弱" value={progress.weakCount} />
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="rounded-lg border bg-background p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Target data-icon="inline-start" />
              <h2 className="font-semibold">建议立刻补弱</h2>
            </div>
            <WeakKnowledgeItemList knowledgeItems={summary.immediateWeakKnowledgeItems} />
          </section>

          <section className="rounded-lg border bg-background p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <CalendarClock data-icon="inline-start" />
              <h2 className="font-semibold">下一次计划</h2>
            </div>

            <div className="grid gap-4">
              <div className="rounded-lg border p-4">
                <Badge variant="secondary" className="mb-2">
                  下次建议复习时间
                </Badge>
                <p className="font-medium">
                  {summary.nextSuggestedReviewAt
                    ? formatDateTime(summary.nextSuggestedReviewAt)
                    : "当前没有待安排的下次复习"}
                </p>
              </div>

              <div className="grid gap-3">
                {summary.learningRecommendations.slice(0, 3).map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="grid gap-2 rounded-lg border p-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          item.priority === "high"
                            ? "destructive"
                            : item.priority === "medium"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {item.priority === "high"
                          ? "优先"
                          : item.priority === "medium"
                            ? "建议"
                            : "可选"}
                      </Badge>
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {item.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </div>

        <details className="rounded-lg border bg-background p-6 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Route data-icon="inline-start" />
              <h2 className="font-semibold">长期统计</h2>
            </div>
            <span className="text-sm text-muted-foreground">展开查看</span>
          </summary>
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <ProgressCard label="总复习题数" value={summary.advancedStats.totalReviews} />
                <ProgressCard
                  label="总正确率"
                  value={
                    summary.advancedStats.correctRate === null
                      ? 0
                      : Math.round(summary.advancedStats.correctRate * 100)
                  }
                  suffix={summary.advancedStats.correctRate === null ? "" : "%"}
                />
                <ProgressCard
                  label="平均耗时"
                  value={
                    summary.advancedStats.averageResponseTimeMs === null
                      ? 0
                      : Math.round(summary.advancedStats.averageResponseTimeMs / 1000)
                  }
                  suffix={
                    summary.advancedStats.averageResponseTimeMs === null ? "" : " 秒"
                  }
                />
              </div>
              {summary.advancedStats.reviewTypeBreakdown.map((item) => (
                <div key={item.type} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{item.label}</p>
                    <span className="text-sm text-muted-foreground">
                      {item.weakCount}/{item.count} 需要补弱
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{
                        width:
                          item.count > 0
                            ? `${Math.round(((item.count - item.weakCount) / item.count) * 100)}%`
                            : "0%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </section>

            <section className="grid gap-3">
              {summary.memoryHookActivity.length > 0 ? (
                <>
                  <div className="flex items-center gap-2">
                    <Sparkles data-icon="inline-start" />
                    <h3 className="font-semibold">本轮联想活动</h3>
                  </div>
                  {summary.memoryHookActivity.map((activity) => (
                    <div
                      key={`${activity.source}-${activity.id}-${activity.timestamp}`}
                      className="rounded-lg border p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={activity.source === "created" ? "secondary" : "outline"}
                        >
                          {activity.source === "created" ? "新创建" : "被使用"}
                        </Badge>
                        <span className="font-medium">{activity.knowledgeItemTitle}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6">{activity.content}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDateTime(activity.timestamp)}
                      </p>
                    </div>
                  ))}
                </>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  这一轮还没有新的下次提示创建或使用记录。
                </div>
              )}
            </section>
          </div>
        </details>

        <details className="rounded-lg border bg-background p-6 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Lightbulb data-icon="inline-start" />
              <h2 className="font-semibold">V1 指标</h2>
            </div>
            <span className="text-sm text-muted-foreground">展开查看</span>
          </summary>
          <div className="mt-5 grid gap-3">
            {summary.metrics.map((metric) => (
              <div key={metric.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{metric.label}</p>
                  <span className="text-sm font-medium">
                    {metric.value === null ? "暂无数据" : `${Math.round(metric.value * 100)}%`}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {metric.description}
                </p>
              </div>
            ))}
          </div>
        </details>
      </div>
    </PhaseShell>
  );
}

function ProgressCard({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-2xl font-semibold">
        {value}
        {suffix}
      </p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function buildPrimaryAction(summary: SummaryStats, progress: ProgressStats) {
  if (!summary.latestSession) {
    if (progress.latestDiagnosticAt) {
    return {
      href: progress.dueNowCount > 0 ? "/review" : "/knowledge-items",
      label: progress.dueNowCount > 0 ? "回到今日复习" : "浏览知识项",
      badge: progress.dueNowCount > 0 ? "待完成" : "可开始",
      priority: progress.dueNowCount > 0 ? "high" : "medium",
    } as const;
  }

  return {
    href: "/diagnostic",
    label: "开始诊断",
    badge: "未诊断",
    priority: "high",
  } as const;
  }

  const difficultCount =
    summary.latestSession.grades.again + summary.latestSession.grades.hard;

  if (summary.immediateWeakKnowledgeItems.length > 0 && difficultCount > 0) {
    return {
      href: "/review?mode=weak",
      label: "补弱项",
      badge: "优先处理",
      priority: "high",
    } as const;
  }

  if (progress.dueNowCount > 0) {
    return {
      href: "/review",
      label: "继续今日复习",
      badge: "继续",
      priority: "medium",
    } as const;
  }

  if (summary.memoryHookActivity.some((activity) => activity.source === "created")) {
    return {
      href: "/memory-hooks",
      label: "整理这轮写下的提示",
      badge: "可整理",
      priority: "medium",
    } as const;
  }

  return {
    href: "/review",
    label: "回到今日复习",
    badge: "已完成",
    priority: "low",
  } as const;
}

function addDomainToAction<T extends { href: string }>(action: T, domain: string): T {
  if (action.href.startsWith("/knowledge-items")) {
    return action;
  }

  const [pathname, search = ""] = action.href.split("?");
  const params = new URLSearchParams(search);
  params.set("domain", domain);

  return {
    ...action,
    href: `${pathname}?${params.toString()}`,
  };
}

function buildCompletionMessage(summary: SummaryStats, progress: ProgressStats) {
  if (!summary.latestSession) {
    return {
      title: "还没有最近一次复习。",
    };
  }

  const difficultCount =
    summary.latestSession.grades.again + summary.latestSession.grades.hard;

  if (summary.immediateWeakKnowledgeItems.length > 0 && difficultCount > 0) {
    return {
      title: "本轮有弱项待处理。",
    };
  }

  if (progress.dueNowCount > 0) {
    return {
      title: "今天还有到期内容。",
    };
  }

  return {
    title: "今天这轮已完成。",
  };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
