"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, Loader2, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type {
  DiagnosticAssessment,
  DiagnosticQuestion,
  DiagnosticResult,
  DiagnosticStart,
} from "@/types/diagnostic";

const assessmentOptions: Array<{
  value: DiagnosticAssessment;
  label: string;
  description: string;
}> = [
  {
    value: "none",
    label: "不会",
    description: "加入今日优先复习",
  },
  {
    value: "partial",
    label: "有印象",
    description: "标记为薄弱知识项",
  },
  {
    value: "clear",
    label: "很熟",
    description: "稍后再复习",
  },
];

export function DiagnosticQuiz({ domain }: { domain: string }) {
  const [diagnostic, setDiagnostic] = useState<DiagnosticStart | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<
    Record<string, DiagnosticAssessment | undefined>
  >({});
  const [showAnswer, setShowAnswer] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let ignore = false;

    async function loadDiagnostic() {
      try {
        const response = await fetch(
          `/api/diagnostic/start?domain=${encodeURIComponent(domain)}`,
        );
        const payload = (await response.json()) as {
          data?: DiagnosticStart;
          error?: string;
        };

        if (!response.ok || !payload.data) {
          throw new Error(payload.error ?? "诊断题加载失败");
        }

        if (!ignore) {
          setDiagnostic(payload.data);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(
            loadError instanceof Error ? loadError.message : "诊断题加载失败",
          );
        }
      }
    }

    loadDiagnostic();

    return () => {
      ignore = true;
    };
  }, [domain]);

  const questions = diagnostic?.questions ?? [];
  const currentQuestion = questions[currentIndex];
  const currentAssessment = currentQuestion ? answers[currentQuestion.id] : undefined;
  const progressValue = useMemo(() => {
    if (questions.length === 0) {
      return 0;
    }

    return Math.round((Object.keys(answers).length / questions.length) * 100);
  }, [answers, questions.length]);

  function handleAssessment(assessment: DiagnosticAssessment) {
    if (!currentQuestion) {
      return;
    }

    setAnswers((previous) => ({
      ...previous,
      [currentQuestion.id]: assessment,
    }));
  }

  function handleConfirmAssessment() {
    if (!currentQuestion) {
      return;
    }

    const assessment = answers[currentQuestion.id];

    if (!assessment) {
      setError("请先选择一个自评结果。");
      return;
    }

    setShowAnswer(false);
    setError(null);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((index) => index + 1);
    } else {
      submitDiagnostic(answers);
    }
  }

  function handlePreviousQuestion() {
    setShowAnswer(false);
    setError(null);
    setCurrentIndex((index) => Math.max(0, index - 1));
  }

  function submitDiagnostic(
    nextAnswers: Record<string, DiagnosticAssessment | undefined>,
  ) {
    if (!diagnostic) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/diagnostic/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            domain: diagnostic.domain,
            answers: diagnostic.questions.map((question) => ({
              questionId: question.id,
              assessment: nextAnswers[question.id] ?? "none",
            })),
          }),
        });
        const payload = (await response.json()) as {
          data?: DiagnosticResult;
          error?: string;
        };

        if (!response.ok || !payload.data) {
          throw new Error(payload.error ?? "诊断提交失败");
        }

        setResult(payload.data);
      } catch (submitError) {
        setError(
          submitError instanceof Error ? submitError.message : "诊断提交失败",
        );
      }
    });
  }

  if (error) {
    return (
      <section className="flex flex-col gap-4 rounded-lg border bg-background p-6 shadow-sm">
        <Badge variant="destructive" className="w-fit">
          诊断不可用
        </Badge>
        <h2 className="text-xl font-semibold">{error}</h2>
        <p className="text-sm text-muted-foreground">
          如果数据库还没有初始化，请先运行迁移和种子数据。
        </p>
        <code className="rounded-md bg-muted px-3 py-2 text-sm">
          npm run prisma:migrate && npm run db:seed
        </code>
      </section>
    );
  }

  if (!diagnostic) {
    return (
      <section className="flex items-center gap-3 rounded-lg border bg-background p-6 shadow-sm">
        <Loader2 data-icon="inline-start" className="animate-spin" />
        <span className="text-sm text-muted-foreground">正在生成诊断题...</span>
      </section>
    );
  }

  if (questions.length === 0) {
    return (
      <section className="flex flex-col gap-4 rounded-lg border bg-background p-6 shadow-sm">
        <Badge variant="secondary" className="w-fit">
          暂无题目
        </Badge>
        <h2 className="text-xl font-semibold">还没有可用于诊断的知识项内容。</h2>
        <p className="text-sm text-muted-foreground">
          请先执行种子脚本，写入通用知识项种子数据。
        </p>
      </section>
    );
  }

  if (result) {
    return <DiagnosticResultView result={result} />;
  }

  return (
    <section className="overflow-hidden rounded-lg border bg-background shadow-sm">
      <div className="flex flex-col gap-3 border-b bg-muted/30 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-muted">
              <Target data-icon="inline-start" />
            </span>
            <div>
              <p className="text-sm font-medium">
                问题 {currentIndex + 1} / {questions.length}
              </p>
              <p className="text-sm text-muted-foreground">
                {diagnostic.domain} · {currentQuestion.knowledgeItem.title}
              </p>
            </div>
          </div>
          <Badge variant="secondary">{currentQuestion.type}</Badge>
        </div>
        <Progress value={progressValue} aria-label="诊断完成进度" />
      </div>

      <div className="flex flex-col gap-6 p-5 md:p-6">
        <div className="flex flex-col gap-3">
          <h2 className="max-w-3xl text-2xl font-semibold leading-tight">
            {currentQuestion.prompt}
          </h2>
        </div>

        {showAnswer ? <DiagnosticAnswer question={currentQuestion} /> : null}

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="secondary"
            className="w-fit"
            onClick={() => setShowAnswer((visible) => !visible)}
          >
            {showAnswer ? "隐藏参考答案" : "查看参考答案"}
          </Button>

          <div className="grid gap-3 md:grid-cols-3">
            {assessmentOptions.map((option) => (
              <button
                key={option.value}
                className={cn(
                  "rounded-lg border p-4 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60",
                  currentAssessment === option.value &&
                    "border-primary bg-muted",
                )}
                disabled={isPending}
                onClick={() => handleAssessment(option.value)}
                type="button"
                aria-pressed={currentAssessment === option.value}
              >
                <span className="block font-medium">{option.label}</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {option.description}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={isPending || currentIndex === 0}
              onClick={handlePreviousQuestion}
            >
              上一步
            </Button>
            <Button
              type="button"
              disabled={isPending || !currentAssessment}
              onClick={handleConfirmAssessment}
            >
              {currentIndex === questions.length - 1 ? "提交诊断" : "确认自评"}
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function DiagnosticAnswer({ question }: { question: DiagnosticQuestion }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/50 p-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 data-icon="inline-start" />
        <h3 className="font-medium">参考答案</h3>
      </div>
      <p className="text-sm leading-6 whitespace-pre-line">
        {formatQuestionAnswer(question.answer, question.options)}
      </p>
      {question.explanation ? (
        <p className="text-sm leading-6 text-muted-foreground">
          {question.explanation}
        </p>
      ) : null}
    </div>
  );
}

function formatQuestionAnswer(
  answer: DiagnosticQuestion["answer"],
  options: DiagnosticQuestion["options"],
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

function DiagnosticResultView({ result }: { result: DiagnosticResult }) {
  const weakCount = result.weakKnowledgeItems.length;

  return (
    <section className="flex flex-col gap-6 rounded-lg border bg-background p-6 shadow-sm">
      <div className="flex flex-col gap-2">
        <Badge className="w-fit">诊断完成</Badge>
        <h2 className="text-2xl font-semibold">
          {weakCount > 0
            ? `发现 ${weakCount} 条待补弱知识项`
            : "当前没有明显弱项"}
        </h2>
      </div>

      {weakCount > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {result.weakKnowledgeItems.map((knowledgeItem) => (
            <div key={knowledgeItem.id} className="rounded-lg border p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="font-medium">{knowledgeItem.title}</h3>
                <Badge variant="secondary">{knowledgeItem.domain}</Badge>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <Link
        href={`/review?domain=${encodeURIComponent(result.domain)}`}
        className={buttonVariants({ className: "w-fit" })}
      >
        进入今日复习
        <ArrowRight data-icon="inline-end" />
      </Link>
    </section>
  );
}
