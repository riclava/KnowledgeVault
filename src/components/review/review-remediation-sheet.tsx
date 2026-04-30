"use client";

import Link from "next/link";
import { ArrowRight, Clock3, Lightbulb, TriangleAlert } from "lucide-react";

import {
  KnowledgeItemDetailView,
  type FocusSection,
} from "@/components/knowledge-item/knowledge-item-detail-view";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ReviewGrade, ReviewMode, ReviewQueueItem } from "@/types/review";

const remediationMeta: Record<
  Extract<ReviewGrade, "again" | "hard">,
  {
    label: string;
    title: string;
    description: string;
    focusSection: FocusSection;
  }
> = {
  again: {
    label: "Again 补弱",
    title: "先补这一题",
    description: "查看绑定题目和提示。",
    focusSection: "questions",
  },
  hard: {
    label: "Hard 补弱",
    title: "再看一遍关键点",
    description: "优先看知识正文。",
    focusSection: "body",
  },
};

export function ReviewRemediationSheet({
  item,
  grade,
  mode,
  domain,
  currentIndex,
  totalItems,
  open,
  onOpenChange,
  onDefer,
  onContinue,
}: {
  item: ReviewQueueItem | null;
  grade: Extract<ReviewGrade, "again" | "hard"> | null;
  mode: ReviewMode;
  domain: string;
  currentIndex: number;
  totalItems: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDefer: () => void;
  onContinue: () => void;
}) {
  if (!item || !grade) {
    return null;
  }

  const meta = remediationMeta[grade];
  const detailHref = `/knowledge-items/${item.knowledgeItem.slug}?focus=${meta.focusSection}&from=review&mode=${mode}&domain=${encodeURIComponent(domain)}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-4xl overflow-y-auto p-0 sm:max-w-4xl"
      >
        <SheetHeader className="gap-3 border-b bg-background px-6 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={cn(
                grade === "again" && "bg-destructive text-destructive-foreground hover:bg-destructive",
                grade === "hard" && "bg-warning text-warning-foreground hover:bg-warning",
              )}
            >
              {meta.label}
            </Badge>
            <Badge variant="outline">{item.knowledgeItem.title}</Badge>
            <Badge variant="outline">
              第 {currentIndex} / {totalItems} 题
            </Badge>
          </div>
          <SheetTitle className="text-xl">{meta.title}</SheetTitle>
          <SheetDescription>{meta.description}</SheetDescription>
        </SheetHeader>

        <div className="px-6 py-6">
          <div className="mb-6 rounded-lg border border-warning/25 bg-warning/10 p-4">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 size-4 text-warning" />
              <div className="text-sm text-foreground">
                <p className="font-medium">看完再继续。</p>
              </div>
            </div>
          </div>

          <KnowledgeItemDetailView
            knowledgeItemIdOrSlug={item.knowledgeItem.slug}
            focusSection={meta.focusSection}
            entryPoint="review"
            compact
          />
        </div>

        <SheetFooter className="border-t bg-background px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={onDefer}>
                <Clock3 data-icon="inline-start" />
                加入今日稍后再练
              </Button>
              <Link
                href={detailHref}
                className={buttonVariants({ variant: "outline" })}
              >
                <Lightbulb data-icon="inline-start" />
                打开完整详情页
              </Link>
            </div>
            <Button type="button" onClick={onContinue}>
              回到复习卡片
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
