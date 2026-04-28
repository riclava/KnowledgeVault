import type { KnowledgeItemRendererPlugin } from "@/components/knowledge-item/renderers/types";

export const vocabularyRenderer: KnowledgeItemRendererPlugin<"vocabulary"> = {
  type: "vocabulary",
  label: "单词",
  renderInline(payload) {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-2">
        <strong>{payload.term}</strong>
        {payload.phonetic ? (
          <span className="text-muted-foreground">{payload.phonetic}</span>
        ) : null}
        {payload.partOfSpeech ? (
          <span className="text-xs uppercase text-muted-foreground">
            {payload.partOfSpeech}
          </span>
        ) : null}
      </span>
    );
  },
  renderBlock(payload) {
    return (
      <div className="grid gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <strong className="text-2xl">{payload.term}</strong>
          {payload.phonetic ? (
            <span className="text-sm text-muted-foreground">{payload.phonetic}</span>
          ) : null}
          {payload.partOfSpeech ? (
            <span className="rounded bg-muted px-2 py-1 text-xs uppercase text-muted-foreground">
              {payload.partOfSpeech}
            </span>
          ) : null}
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{payload.definition}</p>
        {payload.examples.length > 0 ? (
          <ul className="grid gap-2 text-sm leading-6">
            {payload.examples.map((example) => (
              <li key={example} className="rounded border bg-muted/20 px-3 py-2">
                {example}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  },
};
