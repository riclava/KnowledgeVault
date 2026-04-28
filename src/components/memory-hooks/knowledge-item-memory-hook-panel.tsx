"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Lightbulb, Loader2, Trash2, WandSparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  formatMemoryHookUpdatedAt,
  GUIDED_MEMORY_PROMPTS,
} from "@/lib/memory-hooks";
import type { MemoryHookRecord } from "@/types/memory-hook";

const EMPTY_HOOKS: MemoryHookRecord[] = [];

export function KnowledgeItemMemoryHookPanel({
  knowledgeItemIdOrSlug,
  initialHooks,
}: {
  knowledgeItemIdOrSlug: string;
  initialHooks?: MemoryHookRecord[];
}) {
  const initialHook = (initialHooks ?? EMPTY_HOOKS)[0] ?? null;
  const [hook, setHook] = useState<MemoryHookRecord | null>(initialHook);
  const [draftContent, setDraftContent] = useState(initialHook?.content ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let ignore = false;

    async function loadHook() {
      try {
        const response = await fetch(`/api/knowledge-items/${knowledgeItemIdOrSlug}/memory-hooks`);
        const payload = (await response.json()) as {
          data?: MemoryHookRecord[];
          error?: string;
        };

        if (!response.ok || !payload.data) {
          throw new Error(payload.error ?? "提示加载失败");
        }

        if (!ignore) {
          const nextHook = payload.data[0] ?? null;
          setHook(nextHook);
          setDraftContent(nextHook?.content ?? "");
          setError(null);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : "提示加载失败");
        }
      }
    }

    loadHook();

    return () => {
      ignore = true;
    };
  }, [knowledgeItemIdOrSlug]);

  const updatedLabel = useMemo(() => {
    return hook ? formatMemoryHookUpdatedAt(hook.updatedAt) : null;
  }, [hook]);

  function saveHook() {
    const content = draftContent.trim();

    if (!content) {
      setError("先写一句下次能看懂的提示。");
      toast.error("先写一句下次能看懂的提示。");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/knowledge-items/${knowledgeItemIdOrSlug}/memory-hooks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        });
        const payload = (await response.json()) as {
          data?: MemoryHookRecord;
          error?: string;
        };

        if (!response.ok || !payload.data) {
          throw new Error(payload.error ?? "提示保存失败");
        }

        setHook(payload.data);
        setDraftContent(payload.data.content);
        setError(null);
        toast.success("已保存，下次复习卡住时会优先显示这句。");
      } catch (saveError) {
        const message = saveError instanceof Error ? saveError.message : "提示保存失败";
        setError(message);
        toast.error(message);
      }
    });
  }

  function deleteHook() {
    if (!hook) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/memory-hooks/${hook.id}`, {
          method: "DELETE",
        });
        const payload = (await response.json()) as {
          data?: { id: string };
          error?: string;
        };

        if (!response.ok || !payload.data) {
          throw new Error(payload.error ?? "提示删除失败");
        }

        setHook(null);
        setDraftContent("");
        setError(null);
        toast.success("已删除");
      } catch (deleteError) {
        const message = deleteError instanceof Error ? deleteError.message : "提示删除失败";
        setError(message);
        toast.error(message);
      }
    });
  }

  function generateDraft() {
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/knowledge-items/${knowledgeItemIdOrSlug}/memory-hooks/draft`,
          {
            method: "POST",
          },
        );
        const payload = (await response.json()) as {
          data?: { content: string };
          error?: string;
        };

        if (!response.ok || !payload.data?.content) {
          throw new Error(payload.error ?? "AI 草稿生成失败。");
        }

        setDraftContent(payload.data.content);
        setError(null);
        toast.success("已生成草稿，确认后再保存。");
      } catch (draftError) {
        const message = draftError instanceof Error ? draftError.message : "AI 草稿生成失败。";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <section className="rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Lightbulb data-icon="inline-start" />
          <h4 className="font-medium">下次提示</h4>
        </div>
        {updatedLabel ? (
          <span className="text-xs text-muted-foreground">更新于 {updatedLabel}</span>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {GUIDED_MEMORY_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="rounded-lg border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted"
            onClick={() => setDraftContent(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3">
        <Textarea
          value={draftContent}
          onChange={(event) => setDraftContent(event.target.value)}
          placeholder="例如：先判断题目是在问条件概率还是总体概率，再决定用贝叶斯还是全概率。"
          className="min-h-28"
        />
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={generateDraft}
          >
            {isPending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <WandSparkles data-icon="inline-start" />
            )}
            AI 草稿
          </Button>
          <Button
            type="button"
            disabled={isPending || !draftContent.trim()}
            onClick={saveHook}
          >
            {isPending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Check data-icon="inline-start" />
            )}
            保存提示
          </Button>
          {hook ? (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={deleteHook}
            >
              <Trash2 data-icon="inline-start" />
              删除
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
