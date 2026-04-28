"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Network,
} from "lucide-react";

import { KnowledgeItemMemoryHookPanel } from "@/components/memory-hooks/knowledge-item-memory-hook-panel";
import { KnowledgeItemRenderer } from "@/components/knowledge-item/renderers/knowledge-item-renderer";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { KnowledgeItemDetail, KnowledgeItemRelationDetail } from "@/types/knowledge-item";

type FocusSection =
  | "use"
  | "non-use"
  | "anti-patterns"
  | "hooks"
  | "relations"
  | "examples"
  | "deep-dive";

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
  entryPoint?:
    | "review"
    | "direct";
  returnLink?: {
    href: string;
    label: string;
  };
  footer?: React.ReactNode;
  compact?: boolean;
}) {
  const [knowledgeItem, setKnowledgeItem] = useState<KnowledgeItemDetail | null>(initialKnowledgeItem ?? null);
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
          knowledgeItemResponse.json() as Promise<{ data?: KnowledgeItemDetail; error?: string }>,
          relationsResponse.json() as Promise<{ data?: KnowledgeItemRelationDetail[]; error?: string }>,
        ]);

        if (!knowledgeItemResponse.ok || !knowledgeItemPayload.data) {
          throw new Error(knowledgeItemPayload.error ?? "知识项详情加载失败");
        }

        if (!ignore) {
          setKnowledgeItem(knowledgeItemPayload.data);
          setRelations(relationsResponse.ok && relationsPayload.data ? relationsPayload.data : []);
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
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
          <div className="min-w-0">
            <p className="font-medium">{entryPointLabel(entryPoint)}</p>
          </div>
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
              {knowledgeItem.subdomain ? <Badge variant="secondary">{knowledgeItem.subdomain}</Badge> : null}
              <Badge variant="outline">{contentTypeLabel(knowledgeItem.contentType)}</Badge>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <h2 className={cn("font-semibold tracking-tight", compact ? "text-2xl" : "text-3xl")}>
                {knowledgeItem.title}
              </h2>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {knowledgeItem.summary}
              </p>
            </div>

            <div
              data-content-type={knowledgeItem.contentType}
              className={cn(
                "mt-5 min-w-0",
                contentTypeRenderZoneClass(knowledgeItem.contentType),
              )}
            >
              <KnowledgeItemRenderer
                block
                contentType={knowledgeItem.contentType}
                payload={knowledgeItem.renderPayload}
              />
            </div>

            {knowledgeItem.contentType === "math_formula" && knowledgeItem.variables.length > 0 ? (
              <InlineVariablePanel variables={knowledgeItem.variables} />
            ) : null}
          </div>

          <LearningPriorityRail
            entryPoint={entryPoint}
            knowledgeItem={knowledgeItem}
            relations={relations}
          />
        </div>
      </section>

      <QuickActions
        entryPoint={entryPoint}
        onJump={(section) => {
          sectionRefs.current[section]?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      <div className={cn("grid gap-6", compact ? "xl:grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_22rem]")}>
        <div className="flex min-w-0 flex-col gap-6">
          <DetailSection
            sectionRef={(node) => {
              sectionRefs.current.use = node;
            }}
            focused={focusSection === "use"}
            icon={CheckCircle2}
            title="什么时候用"
          >
            <BulletList items={knowledgeItem.useConditions} tone="positive" />
          </DetailSection>

          <DetailSection
            sectionRef={(node) => {
              sectionRefs.current["non-use"] = node;
            }}
            focused={focusSection === "non-use"}
            icon={AlertTriangle}
            title="什么时候不能用"
          >
            <BulletList items={knowledgeItem.nonUseConditions} tone="warning" />
          </DetailSection>

          {knowledgeItem.variables.length > 0 && knowledgeItem.contentType !== "math_formula" ? (
            <DetailSection
              icon={BookOpen}
              title="变量说明"
              collapsed={isReviewEntry}
            >
              <div className="grid gap-3">
                {knowledgeItem.variables.map((variable) => (
                  <div key={variable.id} className="rounded-lg border p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <code className="rounded bg-muted px-2 py-1 text-xs">{variable.symbol}</code>
                      <span className="text-sm font-medium">{variable.name}</span>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {variable.description}
                    </p>
                  </div>
                ))}
              </div>
            </DetailSection>
          ) : null}

          <DetailSection
            icon={BookOpen}
            title="典型场景"
            collapsed={isReviewEntry}
          >
            <BulletList items={knowledgeItem.typicalProblems} tone="neutral" />
          </DetailSection>

          <DetailSection
            sectionRef={(node) => {
              sectionRefs.current["anti-patterns"] = node;
            }}
            focused={focusSection === "anti-patterns"}
            icon={AlertTriangle}
            title="常见误用"
          >
            <BulletList items={knowledgeItem.antiPatterns} tone="warning" />
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

          <DetailSection
            sectionRef={(node) => {
              sectionRefs.current.examples = node;
            }}
            focused={focusSection === "examples"}
            icon={BookOpen}
            title="例子"
            collapsed={isReviewEntry}
          >
            <BulletList items={knowledgeItem.examples} tone="neutral" />
          </DetailSection>

          <DetailSection
            sectionRef={(node) => {
              sectionRefs.current["deep-dive"] = node;
            }}
            focused={focusSection === "deep-dive"}
            icon={BookOpen}
            title="深入理解"
            collapsed={isReviewEntry}
          >
            <p className="text-sm leading-6 text-muted-foreground">
              {knowledgeItem.deepDive ?? "当前还没有补充深入理解。"}
            </p>
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
            collapsed={isReviewEntry && focusSection !== "relations"}
          >
            <div className="grid gap-3">
              {relations.length > 0 ? (
                relations.map((relation) => (
                  <div key={relation.id} className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="secondary">
                        {relationTypeLabel(relation.relationType)}
                      </Badge>
                      <span className="text-sm font-medium">{relation.knowledgeItem.title}</span>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {relation.note ?? relation.knowledgeItem.summary}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  当前还没有补充关联知识项。
                </div>
              )}
            </div>
          </DetailSection>

          <DetailSection
            icon={BookOpen}
            title="知识项含义"
            collapsed={isReviewEntry}
          >
            <p className="text-sm leading-6 text-muted-foreground">{knowledgeItem.body}</p>
            {knowledgeItem.intuition ? (
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {knowledgeItem.intuition}
              </p>
            ) : null}
          </DetailSection>
        </div>
      </div>

      {footer ? <div className="rounded-lg border bg-background p-4 shadow-sm">{footer}</div> : null}
    </article>
  );
}

function QuickActions({
  entryPoint,
  onJump,
}: {
  entryPoint:
    | "review"
    | "direct";
  onJump: (section: FocusSection) => void;
}) {
  const actions = quickActionsByEntryPoint[entryPoint] ?? quickActionsByEntryPoint.direct;

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

const quickActionsByEntryPoint: Record<
  NonNullable<Parameters<typeof QuickActions>[0]["entryPoint"]>,
  Array<{
    section: FocusSection;
    label: string;
  }>
> = {
  review: [
    { section: "anti-patterns", label: "先看常见误用" },
    { section: "use", label: "确认适用条件" },
    { section: "hooks", label: "补一句自己的提醒" },
    { section: "relations", label: "看关联知识项" },
  ],
  direct: [
    { section: "use", label: "看适用条件" },
    { section: "anti-patterns", label: "看常见误用" },
    { section: "hooks", label: "写一句自己的提醒" },
    { section: "relations", label: "看关联知识项" },
  ],
};

function entryPointLabel(
  entryPoint: NonNullable<Parameters<typeof QuickActions>[0]["entryPoint"]>,
) {
  switch (entryPoint) {
    case "review":
      return "你是从复习题里跳进来的";
    default:
      return "你正在查看知识项详情";
  }
}

function LearningPriorityRail({
  entryPoint,
  knowledgeItem,
  relations,
}: {
  entryPoint: NonNullable<Parameters<typeof QuickActions>[0]["entryPoint"]>;
  knowledgeItem: KnowledgeItemDetail;
  relations: KnowledgeItemRelationDetail[];
}) {
  const reviewFirst = entryPoint === "review";
  const primaryTitle = reviewFirst ? "复习时先看" : "学习时先看";
  const primaryItems = reviewFirst
    ? [
        firstOrFallback(knowledgeItem.antiPatterns, "先排查这类题最常见的误用。"),
        firstOrFallback(knowledgeItem.useConditions, "再确认当前题目是否满足适用条件。"),
        knowledgeItem.hasPersonalMemoryHook
          ? "已有个人提示，复习后可以继续修正。"
          : "看完后补一句自己的下次提示。",
      ]
    : [
        firstOrFallback(knowledgeItem.useConditions, "先建立这个知识项的适用边界。"),
        firstOrFallback(knowledgeItem.antiPatterns, "再记住最容易踩错的地方。"),
        firstOrFallback(knowledgeItem.typicalProblems, "最后对照一个典型场景。"),
      ];

  return (
    <aside className="grid content-start gap-3 rounded-lg border bg-muted/20 p-4">
      <section className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{primaryTitle}</h3>
          <Badge variant="secondary" className="shrink-0">
            {difficultyLabel(knowledgeItem.difficulty)}
          </Badge>
        </div>
        <ul className="grid gap-2">
          {primaryItems.map((item) => (
            <li
              key={item}
              className="rounded-md border bg-background px-3 py-2 text-xs leading-5 text-muted-foreground"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-2 border-t pt-3">
        <h3 className="text-sm font-semibold">结构线索</h3>
        <div className="grid gap-2 text-xs leading-5 text-muted-foreground">
          <p>{contentTypeLearningHint(knowledgeItem.contentType)}</p>
          <p>
            {relations.length > 0
              ? `已关联 ${relations.length} 个知识项，可以用来补前置或辨析易混点。`
              : "当前还没有关联知识项。"}
          </p>
        </div>
      </section>
    </aside>
  );
}

function InlineVariablePanel({
  variables,
}: {
  variables: KnowledgeItemDetail["variables"];
}) {
  return (
    <div className="mt-4 rounded-lg border bg-muted/20 p-4">
      <h3 className="text-sm font-semibold">变量先对齐</h3>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {variables.map((variable) => (
          <div key={variable.id} className="rounded-md border bg-background px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-muted px-2 py-1 text-xs">
                {variable.symbol}
              </code>
              <span className="text-sm font-medium">{variable.name}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {variable.description}
            </p>
          </div>
        ))}
      </div>
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

function firstOrFallback(items: string[], fallback: string) {
  return items[0] ?? fallback;
}

function contentTypeLabel(contentType: KnowledgeItemDetail["contentType"]) {
  switch (contentType) {
    case "math_formula":
      return "数学公式";
    case "vocabulary":
      return "词汇";
    case "concept_card":
      return "概念卡";
    case "comparison_table":
      return "对比表";
    case "procedure":
      return "流程";
    default:
      return "纯文本";
  }
}

function contentTypeLearningHint(contentType: KnowledgeItemDetail["contentType"]) {
  switch (contentType) {
    case "math_formula":
      return "先看公式整体，再把变量逐个代回题目。";
    case "vocabulary":
      return "先固定词义，再用例句检查语境。";
    case "concept_card":
      return "先分清定义和直觉，再看关键点与误区。";
    case "comparison_table":
      return "横向按维度比较，不要逐列孤立记忆。";
    case "procedure":
      return "先顺着步骤走一遍，再用流程图检查分支。";
    default:
      return "按段落阅读，优先抓住摘要和适用边界。";
  }
}

function contentTypeLayoutClass(contentType: KnowledgeItemDetail["contentType"]) {
  switch (contentType) {
    case "comparison_table":
    case "procedure":
      return "bg-background";
    case "plain_text":
    case "concept_card":
      return "bg-card";
    default:
      return "";
  }
}

function contentTypeRenderZoneClass(contentType: KnowledgeItemDetail["contentType"]) {
  switch (contentType) {
    case "math_formula":
      return "max-w-3xl";
    case "vocabulary":
      return "rounded-lg border bg-muted/20 p-4";
    case "comparison_table":
      return "max-w-full";
    case "procedure":
      return "max-w-full";
    default:
      return "max-w-3xl";
  }
}

function difficultyLabel(difficulty: number) {
  if (difficulty >= 4) {
    return "高难度";
  }

  if (difficulty >= 3) {
    return "中等";
  }

  return "入门";
}

function BulletList({
  items,
  tone,
}: {
  items: string[];
  tone: "positive" | "warning" | "neutral";
}) {
  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li
          key={item}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm leading-6",
            tone === "positive" && "border-success/25 bg-success/10",
            tone === "warning" && "border-warning/25 bg-warning/10",
            tone === "neutral" && "border-border bg-muted/20",
          )}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function relationTypeLabel(relationType: KnowledgeItemRelationDetail["relationType"]) {
  if (relationType === "prerequisite") {
    return "前置知识项";
  }

  if (relationType === "confusable") {
    return "易混淆";
  }

  if (relationType === "application_of") {
    return "后续应用";
  }

  return "相关知识项";
}
