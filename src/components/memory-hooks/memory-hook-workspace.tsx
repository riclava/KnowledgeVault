"use client";

import { useMemo, useState } from "react";
import { BookOpen, Lightbulb } from "lucide-react";

import { KnowledgeItemMemoryHookPanel } from "@/components/memory-hooks/knowledge-item-memory-hook-panel";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { KnowledgeItemSummary } from "@/types/knowledge-item";

export function MemoryHookWorkspace({
  knowledgeItems,
}: {
  knowledgeItems: KnowledgeItemSummary[];
}) {
  const [selectedKnowledgeItemId, setSelectedKnowledgeItemId] = useState<string>(
    knowledgeItems[0]?.slug ?? "",
  );

  const selectedKnowledgeItem = useMemo(
    () =>
      knowledgeItems.find(
        (knowledgeItem) =>
          knowledgeItem.slug === selectedKnowledgeItemId || knowledgeItem.id === selectedKnowledgeItemId,
      ) ?? knowledgeItems[0] ?? null,
    [knowledgeItems, selectedKnowledgeItemId],
  );

  if (!selectedKnowledgeItem) {
    return (
      <section className="rounded-lg border bg-background p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">当前还没有可整理提示的知识项。</p>
      </section>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="flex flex-col gap-4 rounded-lg border bg-background p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <BookOpen data-icon="inline-start" />
          <h2 className="font-medium">选择知识项</h2>
        </div>
        <div className="grid gap-2">
          {knowledgeItems.map((knowledgeItem) => {
            const active = knowledgeItem.slug === selectedKnowledgeItem.slug;

            return (
              <button
                key={knowledgeItem.id}
                type="button"
                onClick={() => setSelectedKnowledgeItemId(knowledgeItem.slug)}
                className={cn(
                  "rounded-lg border px-3 py-3 text-left transition-colors",
                  active ? "border-primary bg-primary/5" : "hover:bg-muted/60",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{knowledgeItem.title}</span>
                  <Badge variant="secondary">{knowledgeItem.domain}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {knowledgeItem.summary}
                </p>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        <section className="rounded-lg border bg-background p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>选知识项</Badge>
            <Badge variant="outline">回看这条知识项的线索</Badge>
            <Badge variant="outline">整理下次提示</Badge>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{selectedKnowledgeItem.domain}</Badge>
            {selectedKnowledgeItem.subdomain ? (
              <Badge variant="outline">{selectedKnowledgeItem.subdomain}</Badge>
            ) : null}
          </div>
          <h2 className="mt-3 text-2xl font-semibold">{selectedKnowledgeItem.title}</h2>
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Lightbulb data-icon="inline-start" />
              {selectedKnowledgeItem.memoryHookCount} 条可用提示
            </span>
          </div>
        </section>

        <KnowledgeItemMemoryHookPanel
          key={selectedKnowledgeItem.slug}
          knowledgeItemIdOrSlug={selectedKnowledgeItem.slug}
        />
      </div>
    </div>
  );
}
