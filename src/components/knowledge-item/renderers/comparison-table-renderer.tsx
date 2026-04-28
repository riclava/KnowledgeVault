import type { ComparisonTableRenderPayload } from "@/types/knowledge-item";
import type { KnowledgeItemRendererPlugin } from "@/components/knowledge-item/renderers/types";

export const comparisonTableRenderer: KnowledgeItemRendererPlugin<"comparison_table"> = {
  type: "comparison_table",
  label: "对比表",
  renderInline(payload) {
    if (payload.mode === "matrix") {
      return <span>{payload.subjects.join(" vs ")}</span>;
    }

    return <span>{payload.columns.join(" / ")}</span>;
  },
  renderBlock(payload) {
    return (
      <div className="overflow-x-auto rounded-lg border bg-background shadow-sm">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          {payload.mode === "matrix" ? (
            <MatrixTable payload={payload} />
          ) : (
            <GenericTable payload={payload} />
          )}
        </table>
      </div>
    );
  },
};

function MatrixTable({
  payload,
}: {
  payload: Extract<ComparisonTableRenderPayload, { mode: "matrix" }>;
}) {
  return (
    <>
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
              <td key={`${aspect.label}-${index}`} className="px-3 py-2 align-top leading-6">
                {value}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </>
  );
}

function GenericTable({
  payload,
}: {
  payload: Extract<ComparisonTableRenderPayload, { mode: "table" }>;
}) {
  return (
    <>
      <thead className="bg-muted/50">
        <tr>
          {payload.columns.map((column) => (
            <th key={column} className="border-b px-3 py-2 font-medium">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {payload.rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="border-b last:border-b-0">
            {row.map((value, columnIndex) => (
              <td key={`${rowIndex}-${columnIndex}`} className="px-3 py-2 align-top leading-6">
                {value}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </>
  );
}
