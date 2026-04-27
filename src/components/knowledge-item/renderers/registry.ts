import { mathFormulaRenderer } from "@/components/knowledge-item/renderers/math-formula-renderer";
import { plainTextRenderer } from "@/components/knowledge-item/renderers/plain-text-renderer";
import type { KnowledgeItemRendererPlugin } from "@/components/knowledge-item/renderers/types";
import { vocabularyRenderer } from "@/components/knowledge-item/renderers/vocabulary-renderer";
import type { KnowledgeItemType } from "@/types/knowledge-item";

export const knowledgeItemRenderers = {
  math_formula: mathFormulaRenderer,
  vocabulary: vocabularyRenderer,
  plain_text: plainTextRenderer,
} satisfies {
  [TType in KnowledgeItemType]: KnowledgeItemRendererPlugin<TType>;
};

export function getKnowledgeItemRenderer(type: KnowledgeItemType) {
  return knowledgeItemRenderers[type];
}
