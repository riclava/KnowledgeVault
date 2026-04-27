"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  Lightbulb,
  Loader2,
  RotateCcw,
} from "lucide-react";

import { KnowledgeItemRenderer } from "@/components/knowledge-item/renderers/knowledge-item-renderer";
import { ReviewRemediationSheet } from "@/components/review/review-remediation-sheet";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  ReviewHint,
  ReviewGrade,
  ReviewMode,
  ReviewQueueItem,
  ReviewSessionPayload,
  ReviewSubmitResult,
} from "@/types/review";

type CardState = "prompt" | "hint" | "answer";

type ReviewSummary = {
  again: number;
  hard: number;
  good: number;
  easy: number;
};

const gradeButtons: Array<{
  value: "again" | "hard" | "good" | "easy";
  label: string;
  description: string;
}> = [
  { value: "again", label: "想不起来", description: "10 分钟后再练" },
  { value: "hard", label: "有点吃力", description: "明天再巩固" },
  { value: "good", label: "基本记住", description: "3 天后复习" },
  { value: "easy", label: "很轻松", description: "7 天后复习" },
];

export function ReviewSession({
  mode = "today",
  domain,
}: {
  mode?: ReviewMode;
  domain: string;
}) {
  const [session, setSession] = useState<ReviewSessionPayload | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardState, setCardState] = useState<CardState>("prompt");
  const [hintByKnowledgeItemId, setHintByKnowledgeItemId] = useState<Record<string, ReviewHint>>(
    {},
  );
  const [summary, setSummary] = useState<ReviewSummary>({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });
  const [hookDraftByKnowledgeItemId, setHookDraftByKnowledgeItemId] = useState<Record<string, string>>(
    {},
  );
  const [savedHookKnowledgeItemIds, setSavedHookKnowledgeItemIds] = useState<string[]>([]);
  const [pendingRemediation, setPendingRemediation] = useState<{
    item: ReviewQueueItem;
    grade: Extract<ReviewGrade, "again" | "hard">;
  } | null>(null);
  const [isRemediationOpen, setIsRemediationOpen] = useState(false);
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let ignore = false;

    async function loadSession() {
      try {
        const response = await fetch(
          `/api/review/today?mode=${mode}&domain=${encodeURIComponent(domain)}`,
        );
        const payload = (await response.json()) as {
          data?: ReviewSessionPayload;
          error?: string;
        };

        if (!response.ok || !payload.data) {
          throw new Error(payload.error ?? "复习队列加载失败");
        }

        if (!ignore) {
          setSession(payload.data);
          setError(null);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(
            loadError instanceof Error ? loadError.message : "复习队列加载失败",
          );
        }
      }
    }

    loadSession();

    return () => {
      ignore = true;
    };
  }, [domain, mode]);

  const items = session?.items ?? [];
  const currentItem = items[currentIndex];
  const completedCount = completedItemCount(currentIndex, items.length, completedSessionId);
  const progress = items.length
    ? Math.round((completedCount / items.length) * 100)
    : 0;
  const currentHint = currentItem ? hintByKnowledgeItemId[currentItem.knowledgeItemId] : undefined;
  const activeRemediation =
    pendingRemediation?.item.reviewItemId === currentItem?.reviewItemId
      ? pendingRemediation
      : null;

  if (error && !session) {
    return (
      <section className="flex flex-col gap-4 rounded-lg border bg-background p-6 shadow-sm">
        <Badge variant="destructive" className="w-fit">
          复习暂不可用
        </Badge>
        <h2 className="text-xl font-semibold">{error}</h2>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="flex items-center gap-3 rounded-lg border bg-background p-6 shadow-sm">
        <Loader2 data-icon="inline-start" className="animate-spin" />
        <span className="text-sm text-muted-foreground">正在生成今日复习...</span>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyReviewState
        domain={domain}
        emptyReason={session.emptyReason}
        mode={mode}
      />
    );
  }

  if (completedSessionId) {
    return <CompletedReviewState domain={domain} summary={summary} />;
  }

  return (
    <>
      <section className="overflow-hidden rounded-lg border bg-background shadow-sm">
        <div className="flex flex-col gap-3 border-b bg-muted/30 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={mode === "weak" ? "secondary" : "outline"}>
                  {mode === "weak" ? "弱项重练" : "今日复习"}
                </Badge>
                <Badge>{labelForReviewType(currentItem.type)}</Badge>
                <Badge variant="outline">{currentItem.knowledgeItem.domain}</Badge>
                <Badge variant="outline">{currentItem.reviewReason.label}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>
                  第 {currentIndex + 1} 题，共 {items.length} 题
                </span>
                <span>预计还需 {estimateRemainingMinutes(session.estimatedMinutes, currentIndex, items.length)} 分钟</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/knowledge-items/${currentItem.knowledgeItem.slug}?from=review&mode=${mode}`}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                查看知识项
                <ArrowRight data-icon="inline-end" />
              </Link>
            </div>
          </div>
          <Progress value={progress} aria-label="今日复习进度" />
        </div>

        <div className="flex flex-col gap-6 p-5 md:p-6">
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {statusMessage ? (
            <div className="rounded-lg border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
              {statusMessage}
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-muted-foreground">
              {currentItem.knowledgeItem.title}
            </p>
            <h2 className="max-w-3xl text-2xl font-semibold leading-tight">
              {currentItem.prompt}
            </h2>
            <p className="text-sm text-muted-foreground">{currentItem.reviewReason.detail}</p>
          </div>

          {cardState === "hint" && currentHint ? (
            <>
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Lightbulb data-icon="inline-start" />
                  <h3 className="font-medium">一点提示</h3>
                </div>
                <p className="text-sm leading-6">{currentHint.content}</p>
              </div>

              <ReviewMemoryHookCapture
                item={currentItem}
                currentHint={currentHint}
                draft={hookDraftByKnowledgeItemId[currentItem.knowledgeItemId] ?? ""}
                saved={savedHookKnowledgeItemIds.includes(currentItem.knowledgeItemId)}
                disabled={isPending}
                context="hint"
                onDraftChange={(value) => updateHookDraft(currentItem.knowledgeItemId, value)}
                onSave={() => saveReviewMemoryHook(currentItem)}
              />
            </>
          ) : null}

          {cardState === "answer" ? (
            <div className="flex flex-col gap-4 rounded-lg border bg-muted/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BookOpen data-icon="inline-start" />
                  <h3 className="font-medium">参考答案</h3>
                </div>
                <Link
                  href={`/knowledge-items/${currentItem.knowledgeItem.slug}?from=review&mode=${mode}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  查看详情
                </Link>
              </div>
              {currentItem.type === "recall" ? (
                <KnowledgeItemRenderer
                  block
                  contentType={currentItem.knowledgeItem.contentType}
                  payload={currentItem.knowledgeItem.renderPayload}
                />
              ) : (
                <p className="text-sm leading-6 whitespace-pre-line">
                  {currentItem.answer}
                </p>
              )}
              {currentItem.explanation ? (
                <p className="text-sm leading-6 text-muted-foreground">
                  {currentItem.explanation}
                </p>
              ) : null}
            </div>
          ) : null}

          {cardState !== "answer" ? (
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleHintRequest(currentItem)}
                disabled={isPending}
              >
                <Lightbulb data-icon="inline-start" />
                给我一点提示
              </Button>
              <Button
                type="button"
                onClick={() => setCardState("answer")}
                disabled={isPending}
              >
                <Clock3 data-icon="inline-start" />
                显示答案
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => deferCurrentItem(currentItem)}
                disabled={isPending}
              >
                <RotateCcw data-icon="inline-start" />
                稍后再练
              </Button>
            </div>
          ) : activeRemediation ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 rounded-lg border border-warning/25 bg-warning/10 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-warning">
                    已记录为
                    {" "}
                    {activeRemediation.grade === "again" ? "想不起来" : "有点吃力"}。
                  </p>
                  <p className="text-sm text-muted-foreground">
                    先把这次卡住的点写成一句下次能用的提醒，再看详情或继续。
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={() => setIsRemediationOpen(true)}>
                    <BookOpen data-icon="inline-start" />
                    先看这一条
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => deferAfterRemediation(currentItem)}
                    disabled={isPending}
                  >
                    <RotateCcw data-icon="inline-start" />
                    加入今日稍后再练
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={continueAfterRemediation}
                  >
                    继续下一题
                  </Button>
                </div>
              </div>

              <ReviewMemoryHookCapture
                item={currentItem}
                currentHint={currentHint}
                draft={hookDraftByKnowledgeItemId[currentItem.knowledgeItemId] ?? ""}
                saved={savedHookKnowledgeItemIds.includes(currentItem.knowledgeItemId)}
                disabled={isPending}
                context={activeRemediation.grade}
                onDraftChange={(value) => updateHookDraft(currentItem.knowledgeItemId, value)}
                onSave={() => saveReviewMemoryHook(currentItem)}
              />
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-4">
              {gradeButtons.map((grade) => (
                <button
                  key={grade.value}
                  type="button"
                  disabled={isPending}
                  onClick={() => submitGrade(currentItem, grade.value)}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60",
                    gradeToneClassName(grade.value),
                  )}
                >
                  <span className="block font-medium">{grade.label}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {grade.description}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <ReviewRemediationSheet
        item={activeRemediation?.item ?? null}
        grade={activeRemediation?.grade ?? null}
        mode={mode}
        currentIndex={currentIndex + 1}
        totalItems={items.length}
        open={isRemediationOpen}
        onOpenChange={setIsRemediationOpen}
        onDefer={() => deferAfterRemediation(currentItem)}
        onContinue={continueAfterRemediation}
      />
    </>
  );

  function handleHintRequest(item: ReviewQueueItem) {
    const cachedHint = hintByKnowledgeItemId[item.knowledgeItemId];

    if (cachedHint) {
      setCardState("hint");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/review/hint", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            knowledgeItemId: item.knowledgeItemId,
          }),
        });
        const payload = (await response.json()) as {
          data?: ReviewHint;
          error?: string;
        };

        if (!response.ok || !payload.data) {
          throw new Error(payload.error ?? "提示加载失败");
        }

        setHintByKnowledgeItemId((previous) => ({
          ...previous,
          [item.knowledgeItemId]: payload.data!,
        }));
        setCardState("hint");
      } catch (hintError) {
        setError(hintError instanceof Error ? hintError.message : "提示加载失败");
      }
    });
  }

  function deferCurrentItem(item: ReviewQueueItem) {
    startTransition(async () => {
      try {
        const response = await fetch("/api/review/defer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            knowledgeItemId: item.knowledgeItemId,
            minutes: 10,
          }),
        });
        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "稍后再练失败");
        }

        setStatusMessage("已放到今天队尾，约 10 分钟后再见。");
        moveToNextItem();
      } catch (deferError) {
        setError(
          deferError instanceof Error ? deferError.message : "稍后再练失败",
        );
      }
    });
  }

  function updateHookDraft(knowledgeItemId: string, value: string) {
    setHookDraftByKnowledgeItemId((previous) => ({
      ...previous,
      [knowledgeItemId]: value,
    }));
  }

  function saveReviewMemoryHook(item: ReviewQueueItem) {
    const content = hookDraftByKnowledgeItemId[item.knowledgeItemId]?.trim();

    if (!content) {
      setError("先写一句你下次能看懂的提醒。");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/knowledge-items/${item.knowledgeItem.slug}/memory-hooks`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ content }),
          },
        );
        const payload = (await response.json()) as {
          data?: { id: string };
          error?: string;
        };

        if (!response.ok || !payload.data) {
          throw new Error(payload.error ?? "提醒保存失败");
        }

        setSavedHookKnowledgeItemIds((previous) =>
          previous.includes(item.knowledgeItemId) ? previous : [...previous, item.knowledgeItemId],
        );
        setStatusMessage("已保存为这条知识项的下次提示。");
        setError(null);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "提醒保存失败");
      }
    });
  }

  function submitGrade(
    item: ReviewQueueItem,
    grade: "again" | "hard" | "good" | "easy",
  ) {
    if (!session?.sessionId) {
      setError("当前复习 session 不可用");
      return;
    }

    const activeSessionId = session.sessionId;

    startTransition(async () => {
      try {
        const response = await fetch("/api/review/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: activeSessionId,
            reviewItemId: item.reviewItemId,
            knowledgeItemId: item.knowledgeItemId,
            result: grade,
            memoryHookUsedId: hintByKnowledgeItemId[item.knowledgeItemId]?.memoryHookUsedId ?? undefined,
            completed: currentIndex === items.length - 1,
          }),
        });
        const payload = (await response.json()) as {
          data?: ReviewSubmitResult;
          error?: string;
        };

        if (!response.ok || !payload.data) {
          throw new Error(payload.error ?? "复习提交失败");
        }

        setSummary((previous) => ({
          ...previous,
          [grade]: previous[grade] + 1,
        }));

        if (grade === "again" || grade === "hard") {
          setPendingRemediation({
            item,
            grade,
          });
          setIsRemediationOpen(false);
          return;
        }

        if (currentIndex === items.length - 1) {
          setCompletedSessionId(payload.data.sessionId);
          return;
        }

        moveToNextItem();
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "复习提交失败",
        );
      }
    });
  }

  function moveToNextItem() {
    const activeSessionId = session?.sessionId ?? null;

    setCurrentIndex((previous) => {
      const nextIndex = previous + 1;

      if (nextIndex >= items.length) {
        setCompletedSessionId(activeSessionId);
        return previous;
      }

      return nextIndex;
    });
    setPendingRemediation(null);
    setIsRemediationOpen(false);
    setCardState("prompt");
  }

  function continueAfterRemediation() {
    moveToNextItem();
  }

  function deferAfterRemediation(item: ReviewQueueItem) {
    setPendingRemediation(null);
    setIsRemediationOpen(false);
    deferCurrentItem(item);
  }
}

function ReviewMemoryHookCapture({
  item,
  currentHint,
  draft,
  saved,
  disabled,
  context,
  onDraftChange,
  onSave,
}: {
  item: ReviewQueueItem;
  currentHint?: ReviewHint;
  draft: string;
  saved: boolean;
  disabled: boolean;
  context: "hint" | "again" | "hard";
  onDraftChange: (value: string) => void;
  onSave: () => void;
}) {
  const fieldId = `review-memory-hook-${item.reviewItemId}-${context}`;
  const title =
    context === "hint" ? "把这个提示改成你自己的话" : "写给下次的提醒";
  const description =
    context === "hint"
      ? "如果这条提示有帮助，顺手压成一句你下次卡住时想看到的话。"
      : "这次卡住的原因最有价值，把它写下来，系统下次会优先拿它做提示。";

  return (
    <section
      className={cn(
        "rounded-lg border p-4",
        context === "hint"
          ? "border-success/25 bg-success/10"
          : "border-warning/25 bg-warning/10",
      )}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Lightbulb data-icon="inline-start" />
          <h3 className="font-medium">{title}</h3>
          {saved ? <Badge variant="secondary">已保存</Badge> : null}
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      {currentHint ? (
        <div className="mt-3 rounded-md border bg-background/70 px-3 py-2 text-sm leading-6">
          <span className="font-medium">刚才的提示：</span>
          {currentHint.content}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        <label htmlFor={fieldId} className="text-sm font-medium">
          下次看到这条知识项前，先提醒我
        </label>
        <Textarea
          id={fieldId}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={memoryHookPlaceholderForContext(context, item)}
          disabled={disabled || saved}
          className="min-h-20 bg-background"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={disabled || saved || !draft.trim()}
        >
          {saved ? "已保存" : "保存为下次提示"}
        </Button>
        <p className="text-xs leading-5 text-muted-foreground">
          保存后会成为 {item.knowledgeItem.title} 的下次提示。
        </p>
      </div>
    </section>
  );
}

function memoryHookPlaceholderForContext(
  context: "hint" | "again" | "hard",
  item: ReviewQueueItem,
) {
  if (context === "again") {
    return `例如：看到“${item.knowledgeItem.title}”先想它在解决什么条件下的问题。`;
  }

  if (context === "hard") {
    return "例如：先检查适用条件，再代入变量，别急着套知识项。";
  }

  return "例如：把刚才的提示改写成一句你自己会说的话。";
}

function EmptyReviewState({
  domain,
  emptyReason,
  mode,
}: {
  domain: string;
  emptyReason: ReviewSessionPayload["emptyReason"];
  mode: ReviewMode;
}) {
  const domainQuery = `domain=${encodeURIComponent(domain)}`;

  return (
    <section className="flex flex-col gap-4 rounded-lg border bg-background p-6 shadow-sm">
      <Badge variant="secondary" className="w-fit">
        {mode === "weak" ? "错题重练" : "今日复习"}
      </Badge>
      <h2 className="text-2xl font-semibold">
        {emptyReason === "needs_diagnostic"
          ? "先做一次首次诊断，生成你的初始复习队列。"
          : emptyReason === "no_review_content"
            ? "当前有到期知识项，但还没有可用的 Review 题目。"
          : mode === "weak"
            ? "当前没有需要立即补弱的知识项。"
          : "当前没有到期的复习任务。"}
      </h2>
      <div className="flex flex-wrap gap-3">
        {emptyReason === "needs_diagnostic" ? (
          <Link href={`/diagnostic?${domainQuery}`} className={buttonVariants()}>
            开始 1 分钟诊断
            <ArrowRight data-icon="inline-end" />
          </Link>
        ) : (
          <Link
            href={
              mode === "weak"
                ? `/review?${domainQuery}`
                : `/review?mode=weak&${domainQuery}`
            }
            className={buttonVariants()}
          >
            {mode === "weak" ? "回到今日复习" : "去弱项重练"}
          </Link>
        )}
      </div>
    </section>
  );
}

function CompletedReviewState({
  domain,
  summary,
}: {
  domain: string;
  summary: ReviewSummary;
}) {
  return (
    <section className="flex flex-col gap-6 rounded-lg border bg-background p-6 shadow-sm">
      <div className="flex flex-col gap-2">
        <Badge className="w-fit">今日复习完成</Badge>
        <h2 className="text-2xl font-semibold">这一组练完了。</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {gradeButtons.map((grade) => (
          <div key={grade.value} className="rounded-lg border p-4">
            <p className="text-2xl font-semibold">{summary[grade.value]}</p>
            <p className="text-sm text-muted-foreground">{grade.label}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/review?mode=weak&domain=${encodeURIComponent(domain)}`}
          className={buttonVariants()}
        >
          去弱项重练
        </Link>
        <Link
          href={`/review?domain=${encodeURIComponent(domain)}`}
          className={buttonVariants({ variant: "outline" })}
        >
          回到今日复习
        </Link>
      </div>
    </section>
  );
}

function gradeToneClassName(grade: ReviewGrade) {
  if (grade === "again") {
    return "border-destructive/25 bg-destructive/10";
  }

  if (grade === "hard") {
    return "border-warning/25 bg-warning/10";
  }

  if (grade === "good") {
    return "border-info/25 bg-info/10";
  }

  return "border-success/25 bg-success/10";
}

function estimateRemainingMinutes(
  estimatedMinutes: number,
  currentIndex: number,
  totalItems: number,
) {
  if (estimatedMinutes <= 0 || totalItems <= 0) {
    return 0;
  }

  const remainingRatio = Math.max(0, totalItems - currentIndex) / totalItems;
  return Math.max(1, Math.ceil(estimatedMinutes * remainingRatio));
}

function labelForReviewType(type: ReviewQueueItem["type"]) {
  if (type === "recall") {
    return "主动回忆";
  }

  if (type === "recognition") {
    return "判断识别";
  }

  return "场景应用";
}

function completedItemCount(
  currentIndex: number,
  itemCount: number,
  completedSessionId: string | null,
) {
  if (completedSessionId) {
    return itemCount;
  }

  return currentIndex;
}
