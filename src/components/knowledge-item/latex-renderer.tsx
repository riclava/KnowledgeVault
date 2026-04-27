import katex from "katex";

import { cn } from "@/lib/utils";

export function LatexRenderer({
  expression,
  block = false,
  className,
}: {
  expression: string;
  block?: boolean;
  className?: string;
}) {
  const html = katex.renderToString(expression, {
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
