import type { KnowledgeItemRendererPlugin } from "@/components/knowledge-item/renderers/types";

export const comparisonTableRenderer: KnowledgeItemRendererPlugin<"comparison_table"> = {
  type: "comparison_table",
  label: "对比表",
  renderInline(payload) {
    return <span>{payload.subjects.join(" vs ")}</span>;
  },
  renderBlock(payload) {
    return (
      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="border-b px-3 py-2 font-medium text-muted-foreground">
                维度
              </th>
              {payload.subjects.map((subject) => (
                <th key={subject} className="border-b px-3 py-2 font-medium">
                  {subject}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payload.aspects.map((aspect) => (
              <tr key={aspect.label} className="border-b last:border-b-0">
                <th className="bg-muted/20 px-3 py-2 align-top font-medium">
                  {aspect.label}
                </th>
                {aspect.values.map((value, index) => (
                  <td
                    key={`${aspect.label}-${index}`}
                    className="px-3 py-2 align-top leading-6"
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
};
