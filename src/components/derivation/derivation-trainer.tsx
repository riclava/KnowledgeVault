"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Eye, RotateCcw } from "lucide-react";

import { KnowledgeItemRenderer } from "@/components/knowledge-item/renderers/knowledge-item-renderer";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import type { KnowledgeItemDetail } from "@/types/knowledge-item";

export function DerivationTrainer({
  domain,
  knowledgeItems,
}: {
  domain: string;
  knowledgeItems: KnowledgeItemDetail[];
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const knowledgeItem = knowledgeItems[index];

  if (!knowledgeItem) {
    return (
      <section className="rounded-lg border border-dashed bg-background p-6 text-sm text-muted-foreground">
        当前没有可练的推导内容。
      </section>
    );
  }

  return (
    <section className="grid gap-5 rounded-lg border bg-background p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>推导训练</Badge>
          <Badge variant="outline">
            {index + 1} / {knowledgeItems.length}
          </Badge>
          <Badge variant="secondary">{knowledgeItem.domain}</Badge>
        </div>
        <Link
          href={`/knowledge-items/${knowledgeItem.slug}?from=derivation&focus=derivation`}
          className={buttonVariants({ size: "sm", variant: "outline" })}
        >
          完整详情
        </Link>
      </div>

      <div className="grid gap-3">
        <h2 className="text-2xl font-semibold">{knowledgeItem.title}</h2>
        <KnowledgeItemRenderer
          block
          contentType={knowledgeItem.contentType}
          payload={knowledgeItem.renderPayload}
        />
      </div>

      <div className="rounded-lg border bg-muted/40 p-4">
        <div className="mb-2 flex items-center gap-2">
          <BookOpen data-icon="inline-start" />
          <h3 className="font-medium">先自己回忆推导</h3>
        </div>
      </div>

      {revealed ? (
        <div className="rounded-lg border p-4">
          <h3 className="font-medium">参考推导</h3>
          <p className="mt-2 text-sm leading-6">{knowledgeItem.derivation}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => setRevealed(true)} disabled={revealed}>
          <Eye data-icon="inline-start" />
          显示推导
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setIndex((previous) => (previous + 1) % knowledgeItems.length);
            setRevealed(false);
          }}
        >
          <RotateCcw data-icon="inline-start" />
          下一条待补推导
        </Button>
        <Link
          href={`/review?mode=weak&domain=${encodeURIComponent(domain)}`}
          className={buttonVariants({ variant: "secondary" })}
        >
          去错题重练
        </Link>
      </div>
    </section>
  );
}
