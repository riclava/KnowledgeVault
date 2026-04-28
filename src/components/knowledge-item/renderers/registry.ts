import { comparisonTableRenderer } from "@/components/knowledge-item/renderers/comparison-table-renderer";
import { conceptCardRenderer } from "@/components/knowledge-item/renderers/concept-card-renderer";
import { mathFormulaRenderer } from "@/components/knowledge-item/renderers/math-formula-renderer";
import { plainTextRenderer } from "@/components/knowledge-item/renderers/plain-text-renderer";
import { procedureRenderer } from "@/components/knowledge-item/renderers/procedure-renderer";
import type { KnowledgeItemRendererPlugin } from "@/components/knowledge-item/renderers/types";
import { vocabularyRenderer } from "@/components/knowledge-item/renderers/vocabulary-renderer";
import type { KnowledgeItemType } from "@/types/knowledge-item";

export const knowledgeItemRenderers = {
  math_formula: mathFormulaRenderer,
  vocabulary: vocabularyRenderer,
  plain_text: plainTextRenderer,
  concept_card: conceptCardRenderer,
  comparison_table: comparisonTableRenderer,
  procedure: procedureRenderer,
} satisfies {
  [TType in KnowledgeItemType]: KnowledgeItemRendererPlugin<TType>;
};

export function getKnowledgeItemRenderer(type: KnowledgeItemType) {
  return knowledgeItemRenderers[type];
}
