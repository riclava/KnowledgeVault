"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";

import type { FocusSection } from "@/components/knowledge-item/knowledge-item-detail-view";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { WeakKnowledgeItemStat } from "@/types/stats";

export function WeakKnowledgeItemList({
  knowledgeItems,
}: {
  knowledgeItems: WeakKnowledgeItemStat[];
}) {
  useEffect(() => {
    if (knowledgeItems.length === 0) {
      return;
    }

    void fetch("/api/stats/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        events: knowledgeItems.map((knowledgeItem) => ({
          knowledgeItemId: knowledgeItem.knowledgeItemId,
          type: "weak_item_impression",
        })),
      }),
    });
  }, [knowledgeItems]);

  if (knowledgeItems.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        当前没有待补弱知识项。
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {knowledgeItems.map((knowledgeItem) => (
        <div key={knowledgeItem.knowledgeItemId} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{knowledgeItem.title}</h3>
            <Badge variant="secondary">{knowledgeItem.domain}</Badge>
            {knowledgeItem.latestResult ? <Badge variant="outline">{knowledgeItem.latestResult}</Badge> : null}
            <Badge variant="outline">{weakPointLabel(knowledgeItem.weakPoint)}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6">
            {knowledgeItem.recommendedAction}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Again {knowledgeItem.againCount}</span>
            <span>Hard {knowledgeItem.hardCount}</span>
            <span>提示 {knowledgeItem.memoryHookCount} 条</span>
          </div>
          <div className="mt-4">
            <Link
              href={`/knowledge-items/${knowledgeItem.slug}?from=summary&focus=${focusSectionForWeakPoint(knowledgeItem.weakPoint)}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
              onClick={() => {
                void fetch("/api/stats/events", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    events: [
                      {
                        knowledgeItemId: knowledgeItem.knowledgeItemId,
                        type: "weak_item_opened",
                      },
                    ],
                  }),
                });
              }}
            >
              {actionLabelForWeakPoint(knowledgeItem.weakPoint)}
              <ArrowRight data-icon="inline-end" />
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

function weakPointLabel(weakPoint: WeakKnowledgeItemStat["weakPoint"]) {
  switch (weakPoint) {
    case "retention":
      return "记忆保持";
    case "concept":
      return "概念联想";
    case "boundary":
      return "适用边界";
    case "application":
    default:
      return "应用迁移";
  }
}

function focusSectionForWeakPoint(
  weakPoint: WeakKnowledgeItemStat["weakPoint"],
): FocusSection {
  switch (weakPoint) {
    case "boundary":
      return "use";
    case "concept":
    case "retention":
      return "hooks";
    case "application":
    default:
      return "anti-patterns";
  }
}

function actionLabelForWeakPoint(weakPoint: WeakKnowledgeItemStat["weakPoint"]) {
  switch (weakPoint) {
    case "boundary":
      return "先看适用边界";
    case "concept":
      return "补一句自己的提醒";
    case "retention":
      return "先恢复记忆线索";
    case "application":
    default:
      return "先看常见误用";
  }
}
