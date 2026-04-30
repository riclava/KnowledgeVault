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
import { toast } from "sonner";

import { ReviewRemediationSheet } from "@/components/review/review-remediation-sheet";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { QuestionAnswer } from "@/types/question";
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
  const [answerByQuestionId, setAnswerByQuestionId] = useState<
    Record<string, QuestionAnswer | undefined>
  >({});
  const [savedHookKnowledgeItemIds, setSavedHookKnowledgeItemIds] = useState<string[]>([]);
  const [pendingRemediation, setPendingRemediation] = useState<{
    item: ReviewQueueItem;
    grade: Extract<ReviewGrade, "again" | "hard">;
  } | null>(null);
  const [isRemediationOpen, setIsRemediationOpen] = useState(false);
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null);
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
  const currentAnswer = currentItem
    ? answerByQuestionId[currentItem.questionId]
    : undefined;
  const activeRemediation =
    pendingRemediation?.item.questionId === currentItem?.questionId
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
                <Badge>{labelForQuestionType(currentItem.type)}</Badge>
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
                href={buildKnowledgeItemHref({
                  slug: currentItem.knowledgeItem.slug,
                  mode,
                  domain,
                })}
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

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-muted-foreground">
              {currentItem.knowledgeItem.title}
            </p>
            <h2 className="max-w-3xl text-2xl font-semibold leading-tight">
              {currentItem.prompt}
            </h2>
            <p className="text-sm text-muted-foreground">{currentItem.reviewReason.detail}</p>
          </div>

          <QuestionAnswerInput
            item={currentItem}
            value={currentAnswer}
            disabled={isPending || Boolean(activeRemediation)}
            onChange={(value) => updateQuestionAnswer(currentItem.questionId, value)}
          />

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
                  href={buildKnowledgeItemHref({
                    slug: currentItem.knowledgeItem.slug,
                    mode,
                    domain,
                  })}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  查看详情
                </Link>
              </div>
              <p className="text-sm leading-6 whitespace-pre-line">
                {formatQuestionAnswer(currentItem.answer, currentItem.options)}
              </p>
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
                onClick={() => submitAnswer(currentItem)}
                disabled={isPending || !hasSubmittedAnswer(currentItem, currentAnswer)}
              >
                <Clock3 data-icon="inline-start" />
                提交答案
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
                    跳过提示，继续下一题
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
                onSave={() => saveReviewMemoryHookAndContinue(currentItem)}
                saveLabel="保存并继续"
              />
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-4">
              <Button
                type="button"
                onClick={() => submitAnswer(currentItem)}
                disabled={isPending || !hasSubmittedAnswer(currentItem, currentAnswer)}
                className="w-fit"
              >
                提交答案
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          )}
        </div>
      </section>

      <ReviewRemediationSheet
        item={activeRemediation?.item ?? null}
        grade={activeRemediation?.grade ?? null}
        mode={mode}
        domain={domain}
        currentIndex={currentIndex + 1}
        totalItems={items.length}
        open={isRemediationOpen}
        onOpenChange={setIsRemediationOpen}
        onDefer={() => deferAfterRemediation(currentItem)}
        onContinue={() => setIsRemediationOpen(false)}
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

        toast.success("已放到今天队尾，约 10 分钟后再见。");
        moveToNextItem();
      } catch (deferError) {
        const message = deferError instanceof Error ? deferError.message : "稍后再练失败";
        setError(message);
        toast.error(message);
      }
    });
  }

  function updateHookDraft(knowledgeItemId: string, value: string) {
    setHookDraftByKnowledgeItemId((previous) => ({
      ...previous,
      [knowledgeItemId]: value,
    }));
  }

  function saveReviewMemoryHook(item: ReviewQueueItem, afterSave?: () => void) {
    const content = hookDraftByKnowledgeItemId[item.knowledgeItemId]?.trim();

    if (!content) {
      setError("先写一句你下次能看懂的提醒。");
      toast.error("先写一句你下次能看懂的提醒。");
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
        setError(null);
        toast.success("已保存为这条知识项的下次提示。");
        afterSave?.();
      } catch (saveError) {
        const message = saveError instanceof Error ? saveError.message : "提醒保存失败";
        setError(message);
        toast.error(message);
      }
    });
  }

  function updateQuestionAnswer(questionId: string, value: QuestionAnswer) {
    setAnswerByQuestionId((previous) => ({
      ...previous,
      [questionId]: value,
    }));
  }

  function submitAnswer(item: ReviewQueueItem) {
    if (!session?.sessionId) {
      setError("当前复习 session 不可用");
      toast.error("当前复习 session 不可用");
      return;
    }

    const submittedAnswer = answerByQuestionId[item.questionId];

    if (!hasSubmittedAnswer(item, submittedAnswer)) {
      setError("请先完成这道题。");
      toast.error("请先完成这道题。");
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
            questionId: item.questionId,
            knowledgeItemId: item.knowledgeItemId,
            submittedAnswer,
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

        const grade = payload.data.result;
        setCardState("answer");
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
        const message = submitError instanceof Error ? submitError.message : "复习提交失败";
        setError(message);
        toast.error(message);
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

  function saveReviewMemoryHookAndContinue(item: ReviewQueueItem) {
    saveReviewMemoryHook(item, continueAfterRemediation);
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
  saveLabel = "保存为下次提示",
}: {
  item: ReviewQueueItem;
  currentHint?: ReviewHint;
  draft: string;
  saved: boolean;
  disabled: boolean;
  context: "hint" | "again" | "hard";
  onDraftChange: (value: string) => void;
  onSave: () => void;
  saveLabel?: string;
}) {
  const fieldId = `review-memory-hook-${item.questionId}-${context}`;
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
          {saved ? "已保存" : saveLabel}
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

function QuestionAnswerInput({
  item,
  value,
  disabled,
  onChange,
}: {
  item: ReviewQueueItem;
  value?: QuestionAnswer;
  disabled: boolean;
  onChange: (value: QuestionAnswer) => void;
}) {
  if (item.type === "single_choice") {
    const selected = value && "optionId" in value ? value.optionId : "";

    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {(item.options ?? []).map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            aria-pressed={selected === option.id}
            onClick={() => onChange({ optionId: option.id })}
            className={cn(
              "rounded-lg border p-4 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60",
              selected === option.id && "border-primary bg-muted",
            )}
          >
            {option.text}
          </button>
        ))}
      </div>
    );
  }

  if (item.type === "multiple_choice") {
    const selected: Set<string> =
      value && "optionIds" in value
        ? new Set(value.optionIds)
        : new Set<string>();

    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {(item.options ?? []).map((option) => {
          const isSelected = selected.has(option.id);

          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              onClick={() => {
                const next = new Set(selected);
                if (next.has(option.id)) {
                  next.delete(option.id);
                } else {
                  next.add(option.id);
                }
                onChange({ optionIds: Array.from(next) });
              }}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60",
                isSelected && "border-primary bg-muted",
              )}
            >
              {option.text}
            </button>
          );
        })}
      </div>
    );
  }

  if (item.type === "true_false") {
    const selected = value && "value" in value ? value.value : undefined;

    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { value: true, label: "正确" },
          { value: false, label: "错误" },
        ].map((option) => (
          <button
            key={String(option.value)}
            type="button"
            disabled={disabled}
            aria-pressed={selected === option.value}
            onClick={() => onChange({ value: option.value })}
            className={cn(
              "rounded-lg border p-4 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60",
              selected === option.value && "border-primary bg-muted",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  if (item.type === "fill_blank") {
    return (
      <Input
        value={value && "text" in value ? value.text : ""}
        onChange={(event) => onChange({ text: event.target.value })}
        disabled={disabled}
        placeholder="填写你的答案"
      />
    );
  }

  return (
    <Textarea
      value={value && "text" in value ? value.text : ""}
      onChange={(event) => onChange({ text: event.target.value })}
      disabled={disabled}
      placeholder="写下你的简答"
      className="min-h-28"
    />
  );
}

function hasSubmittedAnswer(item: ReviewQueueItem, answer?: QuestionAnswer) {
  if (!answer) {
    return false;
  }

  if (item.type === "single_choice") {
    return "optionId" in answer && answer.optionId.length > 0;
  }

  if (item.type === "multiple_choice") {
    return "optionIds" in answer && answer.optionIds.length > 0;
  }

  if (item.type === "true_false") {
    return "value" in answer;
  }

  return "text" in answer && answer.text.trim().length > 0;
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

function buildKnowledgeItemHref({
  slug,
  mode,
  domain,
  focus,
}: {
  slug: string;
  mode: ReviewMode;
  domain: string;
  focus?: string;
}) {
  const focusQuery = focus ? `&focus=${encodeURIComponent(focus)}` : "";

  return `/knowledge-items/${slug}?from=review&mode=${mode}&domain=${encodeURIComponent(domain)}${focusQuery}`;
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

function labelForQuestionType(type: ReviewQueueItem["type"]) {
  if (type === "single_choice") {
    return "单选";
  }

  if (type === "multiple_choice") {
    return "多选";
  }

  if (type === "true_false") {
    return "判断";
  }

  if (type === "fill_blank") {
    return "填空";
  }

  return "简答";
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

function formatQuestionAnswer(
  answer: ReviewQueueItem["answer"],
  options: ReviewQueueItem["options"],
) {
  if ("optionId" in answer) {
    return options?.find((option) => option.id === answer.optionId)?.text ?? answer.optionId;
  }

  if ("optionIds" in answer) {
    return answer.optionIds
      .map((optionId) => options?.find((option) => option.id === optionId)?.text ?? optionId)
      .join("、");
  }

  if ("value" in answer) {
    return answer.value ? "正确" : "错误";
  }

  return answer.text;
}
