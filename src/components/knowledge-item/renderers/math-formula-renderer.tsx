import katex from "katex";

import { cn } from "@/lib/utils";
import type { MathFormulaRenderPayload } from "@/types/knowledge-item";
import type { KnowledgeItemRendererPlugin } from "@/components/knowledge-item/renderers/types";

function renderLatex({
  payload,
  block = false,
  className,
}: {
  payload: MathFormulaRenderPayload;
  block?: boolean;
  className?: string;
}) {
  const html = katex.renderToString(payload.latex, {
    displayMode: block,
    strict: "warn",
    throwOnError: false,
  });

  return (
    <span
      className={cn(
        block &&
          "block max-w-full overflow-x-auto rounded-lg border bg-background px-4 py-5 text-center text-lg shadow-sm [&_.katex-display]:my-0",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export const mathFormulaRenderer: KnowledgeItemRendererPlugin<"math_formula"> = {
  type: "math_formula",
  label: "数学公式",
  renderInline(payload) {
    return renderLatex({ payload });
  },
  renderBlock(payload) {
    return renderLatex({ payload, block: true });
  },
};
