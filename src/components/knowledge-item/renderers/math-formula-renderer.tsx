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
          "block max-w-full overflow-x-auto rounded-lg border bg-background px-4 py-5 text-center text-lg [&_.katex-display]:my-0",
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
    return (
      <div className="grid gap-4">
        {renderLatex({ payload, block: true })}
        {payload.explanation ? (
          <p className="text-sm leading-7 text-muted-foreground">
            {payload.explanation}
          </p>
        ) : null}
        {payload.variables.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border bg-background">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="border-b px-3 py-2 font-medium">符号</th>
                  <th className="border-b px-3 py-2 font-medium">名称</th>
                  <th className="border-b px-3 py-2 font-medium">含义</th>
                </tr>
              </thead>
              <tbody>
                {payload.variables.map((variable) => (
                  <tr key={variable.symbol} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-medium">{variable.symbol}</td>
                    <td className="px-3 py-2">{variable.name}</td>
                    <td className="px-3 py-2 leading-6 text-muted-foreground">
                      {variable.meaning}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    );
  },
};
