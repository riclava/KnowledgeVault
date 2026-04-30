"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Network,
} from "lucide-react";

import { KnowledgeItemRenderer } from "@/components/knowledge-item/renderers/knowledge-item-renderer";
import { KnowledgeItemMemoryHookPanel } from "@/components/memory-hooks/knowledge-item-memory-hook-panel";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  KnowledgeItemDetail,
  KnowledgeItemRelationDetail,
} from "@/types/knowledge-item";

type FocusSection = "questions" | "hooks" | "relations" | "body";

export type { FocusSection };

export function KnowledgeItemDetailView({
  knowledgeItemIdOrSlug,
  initialKnowledgeItem,
  initialRelations,
  initialHooks,
  focusSection,
  entryPoint = "direct",
  returnLink,
  footer,
  compact = false,
}: {
  knowledgeItemIdOrSlug: string;
  initialKnowledgeItem?: KnowledgeItemDetail;
  initialRelations?: KnowledgeItemRelationDetail[];
  initialHooks?: KnowledgeItemDetail["memoryHooks"];
  focusSection?: FocusSection;
  entryPoint?: "review" | "direct";
  returnLink?: {
    href: string;
    label: string;
  };
  footer?: React.ReactNode;
  compact?: boolean;
}) {
  const [knowledgeItem, setKnowledgeItem] = useState<KnowledgeItemDetail | null>(
    initialKnowledgeItem ?? null,
  );
  const [relations, setRelations] = useState<KnowledgeItemRelationDetail[]>(
    initialRelations ?? [],
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    let ignore = false;

    async function loadBundle() {
      try {
        const [knowledgeItemResponse, relationsResponse] = await Promise.all([
          fetch(`/api/knowledge-items/${knowledgeItemIdOrSlug}`),
          fetch(`/api/knowledge-items/${knowledgeItemIdOrSlug}/relations`),
        ]);
        const [knowledgeItemPayload, relationsPayload] = await Promise.all([
          knowledgeItemResponse.json() as Promise<{
            data?: KnowledgeItemDetail;
            error?: string;
          }>,
          relationsResponse.json() as Promise<{
            data?: KnowledgeItemRelationDetail[];
            error?: string;
          }>,
        ]);

        if (!knowledgeItemResponse.ok || !knowledgeItemPayload.data) {
          throw new Error(knowledgeItemPayload.error ?? "知识项详情加载失败");
        }

        if (!ignore) {
          setKnowledgeItem(knowledgeItemPayload.data);
          setRelations(
            relationsResponse.ok && relationsPayload.data
              ? relationsPayload.data
              : [],
          );
          setLoadError(null);
        }
      } catch (error) {
        if (!ignore) {
          setLoadError(error instanceof Error ? error.message : "知识项详情加载失败");
        }
      }
    }

    if (!initialKnowledgeItem) {
      loadBundle();
    }

    return () => {
      ignore = true;
    };
  }, [knowledgeItemIdOrSlug, initialKnowledgeItem]);

  useEffect(() => {
    if (!focusSection) {
      return;
    }

    const timer = window.setTimeout(() => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      sectionRefs.current[focusSection]?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [focusSection, knowledgeItem?.id]);

  if (loadError) {
    return (
      <div className="rounded-lg border bg-background p-6 shadow-sm">
        <Badge variant="destructive" className="w-fit">
          详情不可用
        </Badge>
        <p className="mt-3 text-sm text-muted-foreground">{loadError}</p>
      </div>
    );
  }

  if (!knowledgeItem) {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-background p-6 shadow-sm">
        <Loader2 data-icon="inline-start" className="animate-spin" />
        <span className="text-sm text-muted-foreground">正在加载知识项详情...</span>
      </div>
    );
  }

  const isReviewEntry = entryPoint === "review";

  return (
    <article className="flex flex-col gap-6">
      {returnLink ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
          <p className="font-medium">
            {isReviewEntry ? "你是从练习题里跳进来的" : "你正在查看知识项详情"}
          </p>
          <Link
            href={returnLink.href}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {returnLink.label}
          </Link>
        </div>
      ) : null}

      <section
        className={cn(
          "overflow-hidden rounded-lg border bg-background shadow-sm",
          contentTypeLayoutClass(knowledgeItem.contentType),
        )}
      >
        <div
          className={cn(
            "grid gap-5 p-5 md:p-6",
            compact ? "xl:grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_18rem]",
          )}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{knowledgeItem.domain}</Badge>
              {knowledgeItem.subdomain ? (
                <Badge variant="secondary">{knowledgeItem.subdomain}</Badge>
              ) : null}
              <Badge variant="outline">
                {contentTypeLabel(knowledgeItem.contentType)}
              </Badge>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <h2
                className={cn(
                  "font-semibold tracking-tight",
                  compact ? "text-2xl" : "text-3xl",
                )}
              >
                {knowledgeItem.title}
              </h2>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {knowledgeItem.summary}
              </p>
            </div>

            <div
              data-content-type={knowledgeItem.contentType}
              className="mt-5 min-w-0"
            >
              <KnowledgeItemRenderer
                block
                contentType={knowledgeItem.contentType}
                payload={knowledgeItem.renderPayload}
              />
            </div>
          </div>

          <LearningPriorityRail knowledgeItem={knowledgeItem} relations={relations} />
        </div>
      </section>

      <QuickActions
        onJump={(section) => {
          sectionRefs.current[section]?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }}
      />

      <div
        className={cn(
          "grid gap-6",
          compact ? "xl:grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_22rem]",
        )}
      >
        <div className="flex min-w-0 flex-col gap-6">
          <DetailSection
            sectionRef={(node) => {
              sectionRefs.current.questions = node;
            }}
            focused={focusSection === "questions"}
            icon={CheckCircle2}
            title="绑定题目"
          >
            <QuestionList knowledgeItem={knowledgeItem} />
          </DetailSection>

          <DetailSection
            sectionRef={(node) => {
              sectionRefs.current.hooks = node;
            }}
            focused={focusSection === "hooks"}
            icon={Lightbulb}
            title="下次提示"
          >
            <KnowledgeItemMemoryHookPanel
              key={knowledgeItem.id}
              knowledgeItemIdOrSlug={knowledgeItem.slug}
              initialHooks={initialHooks ?? knowledgeItem.memoryHooks}
            />
          </DetailSection>
        </div>

        <div className="flex flex-col gap-6">
          <DetailSection
            sectionRef={(node) => {
              sectionRefs.current.relations = node;
            }}
            focused={focusSection === "relations"}
            icon={Network}
            title="关联知识项"
          >
            <RelationList relations={relations} />
          </DetailSection>

          <DetailSection
            sectionRef={(node) => {
              sectionRefs.current.body = node;
            }}
            focused={focusSection === "body"}
            icon={BookOpen}
            title="正文"
            collapsed={isReviewEntry}
          >
            <p className="text-sm leading-6 text-muted-foreground">
              {knowledgeItem.body}
            </p>
          </DetailSection>
        </div>
      </div>

      {footer ? (
        <div className="rounded-lg border bg-background p-4 shadow-sm">
          {footer}
        </div>
      ) : null}
    </article>
  );
}

function QuickActions({ onJump }: { onJump: (section: FocusSection) => void }) {
  const actions: Array<{ section: FocusSection; label: string }> = [
    { section: "questions", label: "看绑定题目" },
    { section: "hooks", label: "写提示" },
    { section: "relations", label: "看关联" },
    { section: "body", label: "看正文" },
  ];

  return (
    <section
      aria-label="知识项快捷跳转"
      className="sticky top-3 z-10 flex gap-2 overflow-x-auto rounded-lg border bg-background/95 p-2 shadow-sm backdrop-blur"
    >
      {actions.map((action) => (
        <button
          key={action.section}
          type="button"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "shrink-0",
          )}
          onClick={() => onJump(action.section)}
        >
          {action.label}
        </button>
      ))}
    </section>
  );
}

function LearningPriorityRail({
  knowledgeItem,
  relations,
}: {
  knowledgeItem: KnowledgeItemDetail;
  relations: KnowledgeItemRelationDetail[];
}) {
  return (
    <aside className="grid content-start gap-3 rounded-lg border bg-muted/20 p-4">
      <section className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">学习线索</h3>
          <Badge variant="secondary" className="shrink-0">
            {difficultyLabel(knowledgeItem.difficulty)}
          </Badge>
        </div>
        <div className="grid gap-2 text-xs leading-5 text-muted-foreground">
          <p>{contentTypeLearningHint(knowledgeItem.contentType)}</p>
          <p>
            已绑定 {knowledgeItem.questions.length} 道题，
            {relations.length > 0
              ? `关联 ${relations.length} 个知识项。`
              : "暂未配置关联知识项。"}
          </p>
        </div>
      </section>
    </aside>
  );
}

function QuestionList({
  knowledgeItem,
}: {
  knowledgeItem: KnowledgeItemDetail;
}) {
  if (knowledgeItem.questions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        当前还没有绑定题目。
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {knowledgeItem.questions.map((question) => (
        <div key={question.id} className="rounded-lg border p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{questionTypeLabel(question.type)}</Badge>
            <Badge variant="outline">难度 {question.difficulty}</Badge>
          </div>
          <p className="text-sm font-medium leading-6">{question.prompt}</p>
          {question.explanation ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {question.explanation}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function RelationList({
  relations,
}: {
  relations: KnowledgeItemRelationDetail[];
}) {
  if (relations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        当前还没有补充关联知识项。
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {relations.map((relation) => (
        <div key={relation.id} className="rounded-lg border p-3">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary">
              {relationTypeLabel(relation.relationType)}
            </Badge>
            <span className="text-sm font-medium">
              {relation.knowledgeItem.title}
            </span>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {relation.note ?? relation.knowledgeItem.summary}
          </p>
        </div>
      ))}
    </div>
  );
}

const DetailSection = ({
  icon: Icon,
  title,
  children,
  focused,
  sectionRef,
  collapsed = false,
}: {
  icon: typeof BookOpen;
  title: string;
  children: React.ReactNode;
  focused?: boolean;
  sectionRef?: (node: HTMLElement | null) => void;
  collapsed?: boolean;
}) => (
  <details
    ref={sectionRef}
    open={!collapsed || focused}
    className={cn(
      "rounded-lg border bg-background p-5 shadow-sm transition-shadow",
      focused && "ring-2 ring-primary/30 shadow-md",
    )}
  >
    <summary className="flex cursor-pointer list-none items-center gap-2 marker:hidden">
      <Icon data-icon="inline-start" />
      <h3 className="font-medium">{title}</h3>
    </summary>
    <div className="mt-4">{children}</div>
  </details>
);

function questionTypeLabel(type: KnowledgeItemDetail["questions"][number]["type"]) {
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

function contentTypeLabel(contentType: KnowledgeItemDetail["contentType"]) {
  switch (contentType) {
    case "math_formula":
      return "公式";
    case "vocabulary":
      return "术语";
    case "concept_card":
      return "概念卡";
    case "comparison_table":
      return "对比表";
    case "procedure":
      return "流程";
    default:
      return "文本";
  }
}

function contentTypeLearningHint(contentType: KnowledgeItemDetail["contentType"]) {
  switch (contentType) {
    case "math_formula":
      return "公式型知识先看符号含义，再看解释与适用语境。";
    case "vocabulary":
      return "术语型知识先能说出定义，再用例句确认语感。";
    case "concept_card":
      return "概念卡优先抓定义、要点和容易混淆的说法。";
    case "comparison_table":
      return "对比表适合按维度横向扫描，先找差异最大的维度。";
    case "procedure":
      return "流程型知识先记顺序，再关注容易出错的步骤。";
    default:
      return "文本知识先抓摘要，再回到正文补上下文。";
  }
}

function contentTypeLayoutClass(contentType: KnowledgeItemDetail["contentType"]) {
  if (contentType === "procedure") {
    return "border-info/25";
  }

  if (contentType === "comparison_table") {
    return "border-primary/20";
  }

  if (contentType === "math_formula") {
    return "border-success/25";
  }

  return "";
}

function relationTypeLabel(
  relationType: KnowledgeItemRelationDetail["relationType"],
) {
  switch (relationType) {
    case "prerequisite":
      return "前置";
    case "confusable":
      return "易混";
    case "application_of":
      return "应用";
    default:
      return "相关";
  }
}

function difficultyLabel(difficulty: number) {
  if (difficulty <= 1) {
    return "入门";
  }

  if (difficulty === 2) {
    return "基础";
  }

  if (difficulty === 3) {
    return "进阶";
  }

  return "高阶";
}
