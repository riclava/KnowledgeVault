"use client";

import { useState } from "react";
import { Check, RotateCcw, Save } from "lucide-react";

import { KnowledgeItemRenderer } from "@/components/knowledge-item/renderers/knowledge-item-renderer";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  ContentAssistDraft,
  ContentAssistRelationDraft,
  ContentAssistReviewItemDraft,
  ContentAssistVariableDraft,
} from "@/types/content-assist";
import type { KnowledgeItemDetail } from "@/types/knowledge-item";

export function ContentAssistEditor({
  knowledgeItem,
  initialDraft,
}: {
  knowledgeItem: KnowledgeItemDetail;
  initialDraft: ContentAssistDraft;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  async function saveDraft() {
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/content-assist/drafts/${draft.knowledgeItemSlug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json()) as {
        data?: ContentAssistDraft;
        error?: string;
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "草稿保存失败");
      }

      setDraft(payload.data);
      setMessage("草稿已保存。");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "草稿保存失败");
    } finally {
      setIsSaving(false);
    }
  }

  async function regenerateDraft() {
    setIsRegenerating(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/content-assist/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          knowledgeItemIdOrSlug: draft.knowledgeItemSlug,
        }),
      });
      const payload = (await response.json()) as {
        data?: ContentAssistDraft;
        error?: string;
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "草稿生成失败");
      }

      setDraft(payload.data);
      setMessage("已重新生成草稿建议。");
    } catch (regenerateError) {
      setError(
        regenerateError instanceof Error
          ? regenerateError.message
          : "草稿生成失败",
      );
    } finally {
      setIsRegenerating(false);
    }
  }

  async function approveDraft() {
    setIsApproving(true);
    setMessage(null);
    setError(null);

    try {
      const saveResponse = await fetch(
        `/api/content-assist/drafts/${draft.knowledgeItemSlug}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(draft),
        },
      );
      const savePayload = (await saveResponse.json()) as {
        data?: ContentAssistDraft;
        error?: string;
      };

      if (!saveResponse.ok || !savePayload.data) {
        throw new Error(savePayload.error ?? "审核前保存失败");
      }

      const approveResponse = await fetch(
        `/api/content-assist/drafts/${draft.knowledgeItemSlug}/approve`,
        {
          method: "POST",
        },
      );
      const approvePayload = (await approveResponse.json()) as {
        data?: ContentAssistDraft;
        error?: string;
      };

      if (!approveResponse.ok || !approvePayload.data) {
        throw new Error(approvePayload.error ?? "审核发布失败");
      }

      setDraft(approvePayload.data);
      setMessage("草稿已审核通过，下一次 db:seed 会自动吸收这份包。");
    } catch (approveError) {
      setError(
        approveError instanceof Error ? approveError.message : "审核发布失败",
      );
    } finally {
      setIsApproving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border bg-background p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{knowledgeItem.domain}</Badge>
          {draft.status === "approved" ? (
            <Badge variant="secondary">已审核</Badge>
          ) : (
            <Badge variant="outline">草稿中</Badge>
          )}
          <Badge variant="outline">{draft.generator.label}</Badge>
        </div>
        <h2 className="mt-3 text-2xl font-semibold">{knowledgeItem.title}</h2>
        <div className="mt-3">
          <KnowledgeItemRenderer
            contentType={knowledgeItem.contentType}
            payload={knowledgeItem.renderPayload}
          />
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          内部草稿页。内容需人工编辑和审核。
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonVariants()}
            onClick={saveDraft}
            disabled={isSaving || isRegenerating || isApproving}
          >
            <Save data-icon="inline-start" />
            {isSaving ? "保存中..." : "保存草稿"}
          </button>
          <button
            type="button"
            className={buttonVariants({ variant: "outline" })}
            onClick={regenerateDraft}
            disabled={isSaving || isRegenerating || isApproving}
          >
            <RotateCcw data-icon="inline-start" />
            {isRegenerating ? "生成中..." : "重新生成建议"}
          </button>
          <button
            type="button"
            className={buttonVariants({ variant: "secondary" })}
            onClick={approveDraft}
            disabled={isSaving || isRegenerating || isApproving}
          >
            <Check data-icon="inline-start" />
            {isApproving ? "审核中..." : "审核通过并写入 seed 包"}
          </button>
        </div>

        {message ? (
          <p className="mt-4 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="grid gap-6">
          <EditableSection title="解释草稿" eyebrow="Explanation">
            <TextField
              label="一句话用途"
              value={draft.explanation.summary}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  explanation: {
                    ...current.explanation,
                    summary: value,
                  },
                }))
              }
            />
            <TextAreaField
              label="意义说明"
              value={draft.explanation.body}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  explanation: {
                    ...current.explanation,
                    body: value,
                  },
                }))
              }
            />
            <TextAreaField
              label="适用条件（每行一条）"
              value={draft.explanation.useConditions.join("\n")}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  explanation: {
                    ...current.explanation,
                    useConditions: parseLines(value),
                  },
                }))
              }
            />
            <TextAreaField
              label="不适用条件（每行一条）"
              value={draft.explanation.nonUseConditions.join("\n")}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  explanation: {
                    ...current.explanation,
                    nonUseConditions: parseLines(value),
                  },
                }))
              }
            />
            <TextAreaField
              label="常见误用（每行一条）"
              value={draft.explanation.antiPatterns.join("\n")}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  explanation: {
                    ...current.explanation,
                    antiPatterns: parseLines(value),
                  },
                }))
              }
            />
            <TextAreaField
              label="典型场景（每行一条）"
              value={draft.explanation.typicalProblems.join("\n")}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  explanation: {
                    ...current.explanation,
                    typicalProblems: parseLines(value),
                  },
                }))
              }
            />
          </EditableSection>

          <EditableSection title="变量解释" eyebrow="Variables">
            <VariableEditor
              variables={draft.explanation.variableExplanations}
              onChange={(variables) =>
                setDraft((current) => ({
                  ...current,
                  explanation: {
                    ...current.explanation,
                    variableExplanations: variables,
                  },
                }))
              }
            />
          </EditableSection>

          <EditableSection title="Review 题目草稿" eyebrow="Review Items">
            <ReviewItemEditor
              items={draft.reviewItems}
              onChange={(items) =>
                setDraft((current) => ({
                  ...current,
                  reviewItems: items,
                }))
              }
            />
          </EditableSection>
        </div>

        <div className="grid gap-6">
          <EditableSection title="关联候选" eyebrow="Relations">
            <RelationEditor
              relations={draft.relationCandidates}
              onChange={(relations) =>
                setDraft((current) => ({
                  ...current,
                  relationCandidates: relations,
                }))
              }
            />
          </EditableSection>

          <EditableSection title="审核备注" eyebrow="Reviewer Notes">
            <TextAreaField
              label="备注"
              value={draft.reviewerNotes}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  reviewerNotes: value,
                }))
              }
            />
          </EditableSection>
        </div>
      </section>
    </div>
  );
}

function EditableSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-background p-5 shadow-sm">
      <div className="mb-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {eyebrow}
        </p>
        <h3 className="mt-2 text-lg font-semibold">{title}</h3>
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function VariableEditor({
  variables,
  onChange,
}: {
  variables: ContentAssistVariableDraft[];
  onChange: (variables: ContentAssistVariableDraft[]) => void;
}) {
  return (
    <div className="grid gap-3">
      {variables.map((variable, index) => (
        <div key={`${variable.symbol}-${index}`} className="grid gap-3 rounded-lg border p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <TextField
              label="符号"
              value={variable.symbol}
              onChange={(value) =>
                onChange(updateAtIndex(variables, index, { ...variable, symbol: value }))
              }
            />
            <TextField
              label="变量名"
              value={variable.name}
              onChange={(value) =>
                onChange(updateAtIndex(variables, index, { ...variable, name: value }))
              }
            />
          </div>
          <TextAreaField
            label="说明"
            value={variable.description}
            onChange={(value) =>
              onChange(
                updateAtIndex(variables, index, {
                  ...variable,
                  description: value,
                }),
              )
            }
          />
        </div>
      ))}
    </div>
  );
}

function ReviewItemEditor({
  items,
  onChange,
}: {
  items: ContentAssistReviewItemDraft[];
  onChange: (items: ContentAssistReviewItemDraft[]) => void;
}) {
  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <div key={`${item.type}-${index}`} className="grid gap-3 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Badge>{item.type}</Badge>
            <span className="text-sm text-muted-foreground">
              难度 {item.difficulty}
            </span>
          </div>
          <TextAreaField
            label="题目"
            value={item.prompt}
            onChange={(value) =>
              onChange(updateAtIndex(items, index, { ...item, prompt: value }))
            }
          />
          <TextAreaField
            label="答案"
            value={item.answer}
            onChange={(value) =>
              onChange(updateAtIndex(items, index, { ...item, answer: value }))
            }
          />
          <TextAreaField
            label="讲解"
            value={item.explanation}
            onChange={(value) =>
              onChange(updateAtIndex(items, index, { ...item, explanation: value }))
            }
          />
        </div>
      ))}
    </div>
  );
}

function RelationEditor({
  relations,
  onChange,
}: {
  relations: ContentAssistRelationDraft[];
  onChange: (relations: ContentAssistRelationDraft[]) => void;
}) {
  return (
    <div className="grid gap-3">
      {relations.map((relation, index) => (
        <div key={`${relation.toSlug}-${index}`} className="grid gap-3 rounded-lg border p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <TextField
              label="目标知识项 slug"
              value={relation.toSlug}
              onChange={(value) =>
                onChange(updateAtIndex(relations, index, { ...relation, toSlug: value }))
              }
            />
            <TextField
              label="目标知识项标题"
              value={relation.toTitle}
              onChange={(value) =>
                onChange(updateAtIndex(relations, index, { ...relation, toTitle: value }))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label>关系类型</Label>
            <div className="flex flex-wrap gap-2">
              {(
                ["prerequisite", "related", "confusable", "application_of"] as const
              ).map((relationType) => (
                <button
                  key={relationType}
                  type="button"
                  className={cn(
                    buttonVariants({
                      size: "sm",
                      variant:
                        relation.relationType === relationType ? "default" : "outline",
                    }),
                  )}
                  onClick={() =>
                    onChange(
                      updateAtIndex(relations, index, {
                        ...relation,
                        relationType,
                      }),
                    )
                  }
                >
                  {relationType}
                </button>
              ))}
            </div>
          </div>
          <TextAreaField
            label="说明"
            value={relation.note}
            onChange={(value) =>
              onChange(updateAtIndex(relations, index, { ...relation, note: value }))
            }
          />
        </div>
      ))}
    </div>
  );
}

function parseLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function updateAtIndex<T>(items: T[], index: number, nextValue: T) {
  return items.map((item, itemIndex) => (itemIndex === index ? nextValue : item));
}
