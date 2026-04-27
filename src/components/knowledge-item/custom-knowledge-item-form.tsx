"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useRef, useState, useTransition } from "react";
import { ArrowRight, Loader2, Plus, Sparkles, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CreatedKnowledgeItem = {
  slug: string;
};

type KnowledgeItemDraft = {
  title: string;
  contentType: KnowledgeItemContentType;
  renderPayload: Record<string, unknown>;
  domain: string;
  subdomain: string;
  summary: string;
  body: string;
  deepDive: string;
  difficulty: number;
  tags: string[];
  useConditions: string[];
  nonUseConditions: string[];
  antiPatterns: string[];
  typicalProblems: string[];
  examples: string[];
  memoryHook: string;
};

type KnowledgeItemContentType = "math_formula" | "vocabulary" | "plain_text";

export function CustomKnowledgeItemForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [isDraftPending, setIsDraftPending] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [contentType, setContentType] = useState<KnowledgeItemContentType>("plain_text");
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      className="grid gap-4 rounded-lg border bg-background p-4 shadow-sm md:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);

        setError(null);
        startTransition(async () => {
          const response = await fetch("/api/knowledge-items", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: stringValue(formData, "title"),
              contentType,
              renderPayload: buildRenderPayload(formData, contentType),
              domain: stringValue(formData, "domain"),
              subdomain: stringValue(formData, "subdomain"),
              summary: stringValue(formData, "summary"),
              body: stringValue(formData, "body"),
              deepDive: stringValue(formData, "deepDive"),
              difficulty: Number(stringValue(formData, "difficulty") || 2),
              tags: listValue(formData, "tags"),
              useConditions: listValue(formData, "useConditions"),
              nonUseConditions: listValue(formData, "nonUseConditions"),
              antiPatterns: listValue(formData, "antiPatterns"),
              typicalProblems: listValue(formData, "typicalProblems"),
              examples: listValue(formData, "examples"),
              memoryHook: stringValue(formData, "memoryHook"),
            }),
          });
          const payload = (await response.json()) as {
            data?: CreatedKnowledgeItem;
            error?: string;
          };

          if (!response.ok || !payload.data) {
            setError(payload.error ?? "创建知识项失败");
            return;
          }

          setCreatedSlug(payload.data.slug);
          router.refresh();
        });
      }}
    >
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold">新建知识项</h2>
        <p className="text-sm leading-5 text-muted-foreground">
          单条创建适合先把一个知识项纳入训练；批量导入适合从笔记或表格整理好的 JSON。
        </p>
      </div>

      <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <div className="grid gap-1">
            <Label htmlFor="knowledgeItem-draft-prompt">AI 填充草稿</Label>
            <p className="text-sm leading-5 text-muted-foreground">
              输入知识项名、单词、题面、课堂笔记或一段说明，AI 会整理成下面的字段，保存前仍可人工修改。
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={isPending || isDraftPending || !draftPrompt.trim()}
            onClick={generateKnowledgeItemDraft}
          >
            {isDraftPending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Sparkles data-icon="inline-start" />
            )}
            用 AI 填充
          </Button>
        </div>
        <Textarea
          id="knowledgeItem-draft-prompt"
          value={draftPrompt}
          onChange={(event) => setDraftPrompt(event.target.value)}
          placeholder="例如：费曼学习法，用自己的话讲一遍，再定位讲不清楚的缺口。"
          className="min-h-20"
        />
        {draftMessage ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-900">
            {draftMessage}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <div className="grid gap-1.5">
          <Label htmlFor="contentType">类型</Label>
          <select
            id="contentType"
            name="contentType"
            value={contentType}
            onChange={(event) =>
              setContentType(event.target.value as KnowledgeItemContentType)
            }
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="math_formula">数学公式</option>
            <option value="vocabulary">单词</option>
            <option value="plain_text">纯文本</option>
          </select>
        </div>
        <Field
          label="知识项标题"
          name="title"
          placeholder="例如：费曼学习法复盘"
          required
          containerClassName="md:col-span-1"
        />
        <Field label="知识域" name="domain" placeholder="例如：学习方法" defaultValue="自定义知识项" />
        <Field label="子领域" name="subdomain" placeholder="例如：复盘方法" />
        <Field label="难度" name="difficulty" type="number" min="1" max="5" defaultValue="2" containerClassName="md:col-span-1" />
      </div>

      {contentType === "math_formula" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Field
            label="LaTeX 表达式"
            name="latex"
            placeholder="P(X=k)=\\frac{\\lambda^k e^{-\\lambda}}{k!}"
            required
          />
          <Field
            label="一句话用途"
            name="summary"
            placeholder="描述什么时候想到这条知识项"
            required
          />
        </div>
      ) : null}

      {contentType === "vocabulary" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="单词" name="term" placeholder="aberration" required />
          <Field label="音标" name="phonetic" placeholder="/ab-er-ay-shun/" />
          <Field label="词性" name="partOfSpeech" placeholder="noun" />
          <Field
            label="释义"
            name="definition"
            placeholder="a departure from what is normal"
            required
          />
          <TextAreaField
            label="例句"
            name="payloadExamples"
            placeholder="每行一句"
            containerClassName="xl:col-span-2"
          />
          <Field
            label="一句话用途"
            name="summary"
            placeholder="描述这个词在什么语境下使用"
            required
            containerClassName="xl:col-span-2"
          />
        </div>
      ) : null}

      {contentType === "plain_text" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <TextAreaField
            label="文本内容"
            name="text"
            placeholder="写下要训练的纯文本知识。"
            required
            className="min-h-24"
          />
          <Field
            label="一句话摘要"
            name="summary"
            placeholder="描述这段文本的核心用途"
            required
          />
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <TextAreaField
          label="知识项说明"
          name="body"
          placeholder="用自己的话解释这个知识项。"
          className="min-h-24"
        />
        <TextAreaField
          label="深入理解"
          name="deepDive"
          placeholder="可选：写下结构拆解、关键推导或更深一层的解释。"
          className="min-h-24"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TextAreaField label="什么时候用" name="useConditions" placeholder="每行一条" className="min-h-24" />
        <TextAreaField label="什么时候不能用" name="nonUseConditions" placeholder="每行一条" className="min-h-24" />
        <TextAreaField label="常见误用" name="antiPatterns" placeholder="每行一条" className="min-h-24" />
        <TextAreaField label="典型场景" name="typicalProblems" placeholder="每行一条" className="min-h-24" />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <TextAreaField
          label="例子"
          name="examples"
          placeholder="每行一个例子，第一条会用于应用训练。"
          className="min-h-24"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Field label="标签" name="tags" placeholder="逗号或换行分隔，例如 custom, distribution" />
          <Field label="下次提示" name="memoryHook" placeholder="可选：一句你下次卡住时想看到的提醒" />
        </div>
      </div>

      {error ? <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      {createdSlug ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span>已创建。</span>
          <Button
            type="button"
            size="sm"
            onClick={() => router.push(`/knowledge-items/${createdSlug}?from=custom`)}
          >
            查看详情
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Plus data-icon="inline-start" />}
          创建知识项
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/review")}>
          去今日复习
        </Button>
      </div>

      <details className="rounded-lg border bg-muted/20 p-3">
        <summary className="cursor-pointer text-sm font-medium">
          批量导入 JSON
        </summary>
        <div className="mt-3 grid gap-3">
          <p className="text-sm leading-5 text-muted-foreground">
            支持单个对象或数组。至少需要 title、contentType、renderPayload、summary；其余字段可选。
          </p>
          <Textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={`[
  {
    "title": "费曼学习法复盘",
    "contentType": "plain_text",
    "renderPayload": { "text": "用自己的话讲一遍，再定位讲不清楚的缺口。" },
    "domain": "学习方法",
    "summary": "用输出暴露理解缺口。",
    "memoryHook": "讲不清楚的地方就是下一轮要补的地方。"
  }
]`}
            className="min-h-40 font-mono text-sm"
          />
          {importMessage ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-900">
              {importMessage}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={isPending || !importText.trim()}
              onClick={() => importKnowledgeItems(importText)}
            >
              {isPending ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <Upload data-icon="inline-start" />
              )}
              导入知识项
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setImportText("");
                setImportMessage(null);
              }}
            >
              清空
            </Button>
          </div>
        </div>
      </details>
    </form>
  );

  async function generateKnowledgeItemDraft() {
    const prompt = draftPrompt.trim();

    if (!prompt) {
      setError("请先输入要整理的知识项或笔记。");
      return;
    }

    setError(null);
    setDraftMessage(null);
    setIsDraftPending(true);

    try {
      const response = await fetch("/api/knowledge-items/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
        }),
      });
      const payload = (await response.json()) as {
        data?: KnowledgeItemDraft;
        error?: string;
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "AI 草稿生成失败");
      }

      fillFormWithDraft(payload.data);
      setDraftMessage("已填充草稿，请检查后再创建知识项。");
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : "AI 草稿生成失败");
    } finally {
      setIsDraftPending(false);
    }
  }

  function fillFormWithDraft(draft: KnowledgeItemDraft) {
    setFormValue("title", draft.title);
    setContentType(draft.contentType);
    for (const [key, value] of Object.entries(draft.renderPayload)) {
      if (typeof value === "string") {
        setFormValue(key, value);
      }
      if (Array.isArray(value)) {
        setFormValue(key === "examples" ? "payloadExamples" : key, value.join("\n"));
      }
    }
    setFormValue("domain", draft.domain);
    setFormValue("subdomain", draft.subdomain);
    setFormValue("summary", draft.summary);
    setFormValue("body", draft.body);
    setFormValue("deepDive", draft.deepDive);
    setFormValue("difficulty", String(draft.difficulty));
    setFormValue("tags", draft.tags.join("\n"));
    setFormValue("useConditions", draft.useConditions.join("\n"));
    setFormValue("nonUseConditions", draft.nonUseConditions.join("\n"));
    setFormValue("antiPatterns", draft.antiPatterns.join("\n"));
    setFormValue("typicalProblems", draft.typicalProblems.join("\n"));
    setFormValue("examples", draft.examples.join("\n"));
    setFormValue("memoryHook", draft.memoryHook);
  }

  function setFormValue(name: string, value: string) {
    const field = formRef.current?.elements.namedItem(name);

    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLTextAreaElement
    ) {
      field.value = value;
    }
  }

  function importKnowledgeItems(rawText: string) {
    setError(null);
    setImportMessage(null);

    let knowledgeItems: unknown[];
    try {
      const parsed = JSON.parse(rawText) as unknown;
      knowledgeItems = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      setError("JSON 解析失败，请检查格式。");
      return;
    }

    if (knowledgeItems.length === 0) {
      setError("导入内容不能为空。");
      return;
    }

    startTransition(async () => {
      try {
        let importedCount = 0;
        for (const knowledgeItem of knowledgeItems) {
          const response = await fetch("/api/knowledge-items", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(normalizeImportedKnowledgeItem(knowledgeItem)),
          });
          const payload = (await response.json()) as {
            data?: CreatedKnowledgeItem;
            error?: string;
          };

          if (!response.ok || !payload.data) {
            throw new Error(payload.error ?? "导入知识项失败");
          }

          importedCount += 1;
          setCreatedSlug(payload.data.slug);
        }

        setImportMessage(`已导入 ${importedCount} 条知识项。`);
        setImportText("");
        router.refresh();
      } catch (importError) {
        setError(
          importError instanceof Error ? importError.message : "导入知识项失败",
        );
      }
    });
  }
}

function normalizeImportedKnowledgeItem(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new Error("每条知识项必须是一个对象。");
  }

  const record = value as Record<string, unknown>;
  return {
    title: importedString(record.title),
    contentType: importedString(record.contentType) || "plain_text",
    renderPayload:
      record.renderPayload && typeof record.renderPayload === "object"
        ? record.renderPayload
        : { text: importedString(record.renderPayload) },
    domain: importedString(record.domain),
    subdomain: importedString(record.subdomain),
    summary: importedString(record.summary),
    body: importedString(record.body),
    deepDive: importedString(record.deepDive),
    difficulty: Number(importedString(record.difficulty) || 2),
    tags: importedList(record.tags),
    useConditions: importedList(record.useConditions),
    nonUseConditions: importedList(record.nonUseConditions),
    antiPatterns: importedList(record.antiPatterns),
    typicalProblems: importedList(record.typicalProblems),
    examples: importedList(record.examples),
    memoryHook: importedString(record.memoryHook),
  };
}

function buildRenderPayload(
  formData: FormData,
  contentType: KnowledgeItemContentType,
) {
  if (contentType === "vocabulary") {
    return {
      term: stringValue(formData, "term"),
      phonetic: stringValue(formData, "phonetic"),
      partOfSpeech: stringValue(formData, "partOfSpeech"),
      definition: stringValue(formData, "definition"),
      examples: listValue(formData, "payloadExamples"),
    };
  }

  if (contentType === "plain_text") {
    return {
      text: stringValue(formData, "text"),
    };
  }

  return {
    latex: stringValue(formData, "latex"),
  };
}

function importedString(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function importedList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => importedString(item)).filter(Boolean);
  }

  return importedString(value)
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function Field({
  containerClassName,
  label,
  name,
  ...props
}: ComponentProps<typeof Input> & {
  containerClassName?: string;
  label: string;
  name: string;
}) {
  return (
    <div className={`grid gap-1.5 ${containerClassName ?? ""}`}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}

function TextAreaField({
  containerClassName,
  label,
  name,
  ...props
}: ComponentProps<typeof Textarea> & {
  containerClassName?: string;
  label: string;
  name: string;
}) {
  return (
    <div className={`grid gap-1.5 ${containerClassName ?? ""}`}>
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} {...props} />
    </div>
  );
}

function stringValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function listValue(formData: FormData, key: string) {
  return stringValue(formData, key)
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
