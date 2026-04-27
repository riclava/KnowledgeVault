import type { ReactNode } from "react";

import type {
  KnowledgeItemRenderPayloadByType,
  KnowledgeItemType,
} from "@/types/knowledge-item";

export type KnowledgeItemRendererPlugin<TType extends KnowledgeItemType> = {
  type: TType;
  label: string;
  renderInline(payload: KnowledgeItemRenderPayloadByType[TType]): ReactNode;
  renderBlock(payload: KnowledgeItemRenderPayloadByType[TType]): ReactNode;
};
