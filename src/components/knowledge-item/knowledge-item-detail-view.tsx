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
      return () => {
        ignore = true;
      };
    }

    loadBundle();
    return () => {
      ignore = true;
    };
  }, [knowledgeItemIdOrSlug, initialKnowledgeItem]);

  useEffect(() => {
    if (!focusSection) {
      return;
    }

    const timer = window.setTimeout(() => {
      sectionRefs.current[focusSection]?.scrollIntoView({
        behavior: "smooth",
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

      <section className="rounded-lg border bg-background p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{knowledgeItem.domain}</Badge>
          {knowledgeItem.subdomain ? <Badge variant="secondary">{knowledgeItem.subdomain}</Badge> : null}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <h2 className={cn("font-semibold tracking-tight", compact ? "text-2xl" : "text-3xl")}>
            {knowledgeItem.title}
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {knowledgeItem.summary}
          </p>
          <KnowledgeItemRenderer
            block
            contentType={knowledgeItem.contentType}
            payload={knowledgeItem.renderPayload}
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

          {knowledgeItem.variables.length > 0 ? (
            <DetailSection icon={BookOpen} title="变量说明">
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

          <DetailSection icon={BookOpen} title="典型场景">
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

          <DetailSection icon={BookOpen} title="知识项含义">
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
    <section className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action.section}
          type="button"
          className={buttonVariants({ variant: "outline", size: "sm" })}
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

const DetailSection = ({
  icon: Icon,
  title,
  children,
  focused,
  sectionRef,
}: {
  icon: typeof BookOpen;
  title: string;
  children: React.ReactNode;
  focused?: boolean;
  sectionRef?: (node: HTMLElement | null) => void;
}) => (
  <section
    ref={sectionRef}
    className={cn(
      "rounded-lg border bg-background p-5 shadow-sm transition-shadow",
      focused && "ring-2 ring-primary/30 shadow-md",
    )}
  >
    <div className="mb-4 flex items-center gap-2">
      <Icon data-icon="inline-start" />
      <h3 className="font-medium">{title}</h3>
    </div>
    {children}
  </section>
);

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
