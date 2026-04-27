import Link from "next/link";
import { ArrowRight, BookOpenCheck } from "lucide-react";

import { PhaseShell } from "@/components/app/phase-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireCurrentLearner } from "@/server/auth/current-learner";
import { resolveLearningDomain } from "@/server/learning-domain";
import { getKnowledgeItemCatalog } from "@/server/services/knowledge-item-service";

export const dynamic = "force-dynamic";

export default async function PathsPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const current = await requireCurrentLearner();
  const params = await searchParams;
  const learningDomain = await resolveLearningDomain(params.domain);
  const catalog = await getKnowledgeItemCatalog({
    domain: learningDomain.currentDomain,
    userId: current.learner.id,
  });
  const groups = groupByDomain(catalog.knowledgeItems);

  return (
    <PhaseShell
      activePath="/paths"
      eyebrow="学习路径"
      title="当前知识域路径"
      learningDomain={learningDomain}
    >
      <div className="grid gap-5">
        {groups.map((group) => (
          <section key={group.domain} className="rounded-lg border bg-background p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <BookOpenCheck data-icon="inline-start" />
                  <h2 className="text-xl font-semibold">{group.domain}</h2>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {group.knowledgeItems.length} 条知识项，{group.weakCount} 条需要补弱，{group.stableCount} 条稳定中。
                </p>
              </div>
              <Link
                href={`/knowledge-items?domain=${encodeURIComponent(group.domain)}`}
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                查看内容集
              </Link>
            </div>

            <div className="mt-5 grid gap-3">
              {group.knowledgeItems.map((knowledgeItem, index) => (
                <Link
                  key={knowledgeItem.id}
                  href={`/knowledge-items/${knowledgeItem.slug}?from=paths`}
                  className="grid gap-2 rounded-lg border p-4 transition-colors hover:bg-muted/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{index + 1}</Badge>
                    <span className="font-medium">{knowledgeItem.title}</span>
                    <Badge variant={knowledgeItem.isWeak ? "destructive" : "secondary"}>
                      {knowledgeItem.trainingStatusLabel}
                    </Badge>
                    {knowledgeItem.subdomain ? <Badge variant="outline">{knowledgeItem.subdomain}</Badge> : null}
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {knowledgeItem.summary}
                  </p>
                </Link>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={
                  group.knowledgeItems.find((knowledgeItem) => knowledgeItem.isWeak)?.slug
                    ? `/knowledge-items/${group.knowledgeItems.find((knowledgeItem) => knowledgeItem.isWeak)!.slug}?from=paths&focus=use`
                    : `/knowledge-items/${group.knowledgeItems[0]?.slug}?from=paths`
                }
                className={buttonVariants({ size: "sm" })}
              >
                继续这组内容
                <ArrowRight data-icon="inline-end" />
              </Link>
              <Link
                href={`/review?mode=weak&domain=${encodeURIComponent(
                  learningDomain.currentDomain,
                )}`}
                className={buttonVariants({ size: "sm", variant: "secondary" })}
              >
                只练这组里的薄弱项
              </Link>
            </div>
          </section>
        ))}
      </div>
    </PhaseShell>
  );
}

function groupByDomain(knowledgeItems: Awaited<ReturnType<typeof getKnowledgeItemCatalog>>["knowledgeItems"]) {
  const groups = new Map<string, typeof knowledgeItems>();

  for (const knowledgeItem of knowledgeItems) {
    groups.set(knowledgeItem.domain, [...(groups.get(knowledgeItem.domain) ?? []), knowledgeItem]);
  }

  return Array.from(groups.entries()).map(([domain, items]) => ({
    domain,
    knowledgeItems: items.sort((left, right) => {
      if ((left.subdomain ?? "") !== (right.subdomain ?? "")) {
        return (left.subdomain ?? "").localeCompare(right.subdomain ?? "", "zh-CN");
      }

      return left.difficulty - right.difficulty;
    }),
    weakCount: items.filter((knowledgeItem) => knowledgeItem.isWeak).length,
    stableCount: items.filter((knowledgeItem) => knowledgeItem.trainingStatus === "stable").length,
  }));
}
