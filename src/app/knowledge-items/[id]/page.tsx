import { notFound } from "next/navigation";

import { PhaseShell } from "@/components/app/phase-shell";
import {
  KnowledgeItemDetailView,
  type FocusSection,
} from "@/components/knowledge-item/knowledge-item-detail-view";
import { normalizeRouteParam } from "@/lib/route-params";
import { requireCurrentLearner } from "@/server/auth/current-learner";
import {
  getKnowledgeItemDetail,
  getKnowledgeItemMemoryHooks,
  getKnowledgeItemRelationDetails,
} from "@/server/services/knowledge-item-service";

function parseFocusSection(value?: string): FocusSection | undefined {
  if (
    value === "use" ||
    value === "non-use" ||
    value === "anti-patterns" ||
    value === "hooks" ||
    value === "relations" ||
    value === "examples" ||
    value === "derivation"
  ) {
    return value;
  }

  return undefined;
}

function parseEntryPoint(value?: string) {
  if (
    value === "review" ||
    value === "summary" ||
    value === "paths" ||
    value === "knowledgeItems" ||
    value === "derivation" ||
    value === "memory-hooks" ||
    value === "custom"
  ) {
    return value;
  }

  return "knowledgeItems" as const;
}

function buildReturnLink({
  entryPoint,
  mode,
}: {
  entryPoint: ReturnType<typeof parseEntryPoint>;
  mode?: string;
}) {
  switch (entryPoint) {
    case "review":
      return {
        href: mode === "weak" ? "/review?mode=weak" : "/review",
        label: mode === "weak" ? "回到弱项重练" : "回到今日复习",
      };
    case "summary":
      return {
        href: "/summary",
        label: "回到复习总结",
      };
    case "paths":
      return {
        href: "/paths",
        label: "回到学习路径",
      };
    case "derivation":
      return {
        href: "/derivation",
        label: "回到推导训练",
      };
    case "memory-hooks":
      return {
        href: "/memory-hooks",
        label: "回到提示整理",
      };
    case "custom":
      return {
        href: "/knowledge-items/new",
        label: "回到自定义知识项",
      };
    case "knowledgeItems":
    default:
      return {
        href: "/knowledge-items",
        label: "回到知识项列表",
      };
  }
}

export default async function KnowledgeItemDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ focus?: string; from?: string; mode?: string }>;
}) {
  const { id: rawId } = await params;
  const { focus, from, mode } = await searchParams;
  const id = normalizeRouteParam(rawId);
  const current = await requireCurrentLearner();
  const [knowledgeItem, relations, hooks] = await Promise.all([
    getKnowledgeItemDetail(id),
    getKnowledgeItemRelationDetails(id),
    getKnowledgeItemMemoryHooks({
      knowledgeItemIdOrSlug: id,
      userId: current.learner.id,
    }),
  ]);

  if (!knowledgeItem) {
    notFound();
  }

  return (
    <PhaseShell
      activePath="/knowledge-items"
      eyebrow="知识项详情"
      title="查看知识项详情"
    >
      <KnowledgeItemDetailView
        knowledgeItemIdOrSlug={id}
        initialKnowledgeItem={knowledgeItem}
        initialRelations={relations ?? []}
        initialHooks={hooks ?? knowledgeItem.memoryHooks}
        focusSection={parseFocusSection(focus)}
        entryPoint={parseEntryPoint(from)}
        returnLink={buildReturnLink({
          entryPoint: parseEntryPoint(from),
          mode,
        })}
      />
    </PhaseShell>
  );
}
