import type { KnowledgeItemRendererPlugin } from "@/components/knowledge-item/renderers/types";

export const plainTextRenderer: KnowledgeItemRendererPlugin<"plain_text"> = {
  type: "plain_text",
  label: "纯文本",
  renderInline(payload) {
    return <span className="whitespace-pre-wrap">{payload.text}</span>;
  },
  renderBlock(payload) {
    return (
      <div className="rounded-lg border bg-background px-4 py-5 text-sm leading-7 shadow-sm">
        <p className="whitespace-pre-wrap">{payload.text}</p>
      </div>
    );
  },
};
