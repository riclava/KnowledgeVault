import type { KnowledgeItemRendererPlugin } from "@/components/knowledge-item/renderers/types";

export const procedureRenderer: KnowledgeItemRendererPlugin<"procedure"> = {
  type: "procedure",
  label: "流程",
  renderInline(payload) {
    return <span>{payload.steps.map((step) => step.title).join(" -> ")}</span>;
  },
  renderBlock(payload) {
    return (
      <div className="grid gap-4">
        <ol className="grid gap-3">
          {payload.steps.map((step, index) => (
            <li key={`${step.title}-${index}`} className="grid gap-2 rounded border bg-muted/20 p-3">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {index + 1}
                </span>
                <strong className="text-sm">{step.title}</strong>
              </div>
              {step.detail ? (
                <p className="text-sm leading-6">{step.detail}</p>
              ) : null}
            </li>
          ))}
        </ol>
        <StepList title="易错点" items={payload.pitfalls} />
      </div>
    );
  },
};

function StepList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-1 text-xs leading-5 text-muted-foreground">
      <span className="font-medium">{title}</span>
      <ul className="grid gap-1">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
