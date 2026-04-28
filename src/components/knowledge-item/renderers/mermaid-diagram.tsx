"use client";

import { useEffect, useId, useState } from "react";

export function MermaidDiagram({ chart }: { chart: string }) {
  const reactId = useId();
  const elementId = `mermaid-${reactId.replace(/:/g, "")}`;
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function renderDiagram() {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
        });

        const result = await mermaid.render(elementId, chart);

        if (active) {
          setSvg(result.svg);
          setError("");
        }
      } catch (caught) {
        if (active) {
          setSvg("");
          setError(caught instanceof Error ? caught.message : "流程图渲染失败。");
        }
      }
    }

    void renderDiagram();

    return () => {
      active = false;
    };
  }, [chart, elementId]);

  if (svg) {
    return (
      <div
        className="overflow-x-auto rounded-lg border bg-background p-3"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  return (
    <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
      {error ? `${error}\n\n${chart}` : chart}
    </pre>
  );
}
