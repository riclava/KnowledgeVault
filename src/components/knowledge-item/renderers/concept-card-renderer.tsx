import type { ReactNode } from "react";

import type { KnowledgeItemRendererPlugin } from "@/components/knowledge-item/renderers/types";

export const conceptCardRenderer: KnowledgeItemRendererPlugin<"concept_card"> = {
  type: "concept_card",
  label: "概念卡",
  renderInline(payload) {
    return <span>{payload.definition}</span>;
  },
  renderBlock(payload) {
    return (
      <div className="grid gap-4 rounded-lg border bg-background px-4 py-5 shadow-sm">
        <section className="grid gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">定义</h3>
          <p className="text-sm leading-7">{payload.definition}</p>
        </section>
        {payload.intuition ? (
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground">直觉</h3>
            <p className="text-sm leading-7">{payload.intuition}</p>
          </section>
        ) : null}
        <ListSection title="关键点" items={payload.keyPoints} />
        <ListSection title="例子" items={payload.examples} />
        <ListSection title="常见误区" items={payload.misconceptions} />
      </div>
    );
  },
};

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      <ul className="grid gap-2 text-sm leading-6">
        {items.map((item) => (
          <li key={item} className="rounded border bg-muted/20 px-3 py-2">
            {item as ReactNode}
          </li>
        ))}
      </ul>
    </section>
  );
}
