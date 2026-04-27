import Link from "next/link";

import { PhaseShell } from "@/components/app/phase-shell";
import { ReviewSession } from "@/components/review/review-session";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireCurrentLearner } from "@/server/auth/current-learner";
import { resolveLearningDomain } from "@/server/learning-domain";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; domain?: string }>;
}) {
  await requireCurrentLearner();
  const params = await searchParams;
  const mode = params.mode === "weak" ? "weak" : "today";
  const learningDomain = await resolveLearningDomain(params.domain);
  const todayHref = `/review?domain=${encodeURIComponent(learningDomain.currentDomain)}`;
  const weakHref = `/review?mode=weak&domain=${encodeURIComponent(
    learningDomain.currentDomain,
  )}`;

  return (
    <PhaseShell
      activePath={mode === "weak" ? "/review?mode=weak" : "/review"}
      eyebrow={mode === "weak" ? "错题重练" : "今日复习"}
      title={
        mode === "weak"
          ? "重练薄弱知识项"
          : "开始今日复习"
      }
      learningDomain={learningDomain}
    >
      <section className="flex flex-col gap-4 rounded-lg border bg-background p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <p className="text-sm font-medium">训练模式</p>
        <div className="flex flex-wrap gap-2">
          {[
            {
              href: todayHref,
              label: "今日复习",
              active: mode === "today",
            },
            {
              href: weakHref,
              label: "弱项重练",
              active: mode === "weak",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                buttonVariants({
                  size: "sm",
                  variant: item.active ? "default" : "outline",
                }),
                "min-w-28 justify-center",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <ReviewSession
        key={`${mode}:${learningDomain.currentDomain}`}
        mode={mode}
        domain={learningDomain.currentDomain}
      />
    </PhaseShell>
  );
}
