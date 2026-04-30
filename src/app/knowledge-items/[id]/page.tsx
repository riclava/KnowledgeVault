import { notFound } from "next/navigation";

import { PhaseShell } from "@/components/app/phase-shell";
import {
  KnowledgeItemDetailView,
  type FocusSection,
} from "@/components/knowledge-item/knowledge-item-detail-view";
import { normalizeRouteParam } from "@/lib/route-params";
import { requireCurrentLearner } from "@/server/auth/current-learner";
import { resolveLearningDomain } from "@/server/learning-domain";
import {
  getKnowledgeItemDetail,
  getKnowledgeItemMemoryHooks,
  getKnowledgeItemRelationDetails,
} from "@/server/services/knowledge-item-service";

function parseFocusSection(value?: string): FocusSection | undefined {
  if (
    value === "questions" ||
    value === "hooks" ||
    value === "relations" ||
    value === "body"
  ) {
    return value;
  }

  return undefined;
}

function parseEntryPoint(value?: string) {
  if (value === "review") {
    return value;
  }

  return "direct" as const;
}

function buildReturnLink({
  entryPoint,
  mode,
  domain,
}: {
  entryPoint: ReturnType<typeof parseEntryPoint>;
  mode?: string;
  domain: string;
}) {
  const domainQuery = `domain=${encodeURIComponent(domain)}`;

  switch (entryPoint) {
    case "review":
      return {
        href: mode === "weak"
          ? `/review?mode=weak&${domainQuery}`
          : `/review?${domainQuery}`,
        label: mode === "weak" ? "回到弱项重练" : "回到今日复习",
      };
    default:
      return {
        href: `/review?${domainQuery}`,
        label: "回到今日复习",
      };
  }
}

export default async function KnowledgeItemDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ focus?: string; from?: string; mode?: string; domain?: string }>;
}) {
  const { id: rawId } = await params;
  const { focus, from, mode, domain } = await searchParams;
  const id = normalizeRouteParam(rawId);
  const current = await requireCurrentLearner();
  const learningDomain = await resolveLearningDomain(domain, current.learner.id);
  const [knowledgeItem, relations, hooks] = await Promise.all([
    getKnowledgeItemDetail(id, current.learner.id),
    getKnowledgeItemRelationDetails(id, current.learner.id),
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
      activePath="/review"
      eyebrow="知识项详情"
      title="查看知识项详情"
      learningDomain={learningDomain}
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
          domain: learningDomain.currentDomain,
        })}
      />
    </PhaseShell>
  );
}
