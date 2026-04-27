import { getKnowledgeItemRenderer } from "@/components/knowledge-item/renderers/registry";
import type { KnowledgeItemRendererPlugin } from "@/components/knowledge-item/renderers/types";
import type {
  KnowledgeItemRenderPayloadByType,
  KnowledgeItemType,
} from "@/types/knowledge-item";

export function KnowledgeItemRenderer<TType extends KnowledgeItemType>({
  contentType,
  payload,
  block = false,
}: {
  contentType: TType;
  payload: KnowledgeItemRenderPayloadByType[TType];
  block?: boolean;
}) {
  const renderer = getKnowledgeItemRenderer(
    contentType,
  ) as KnowledgeItemRendererPlugin<TType>;

  return block ? renderer.renderBlock(payload) : renderer.renderInline(payload);
}
