import Link from "next/link";
import { Clock3, Filter, Plus, Search, Sparkles } from "lucide-react";

import { PhaseShell } from "@/components/app/phase-shell";
import { KnowledgeItemRenderer } from "@/components/knowledge-item/renderers/knowledge-item-renderer";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { requireCurrentLearner } from "@/server/auth/current-learner";
import { getKnowledgeItemCatalog } from "@/server/services/knowledge-item-service";
import type { KnowledgeItemSummary } from "@/types/knowledge-item";

export const dynamic = "force-dynamic";

const STATUS_BADGE_VARIANTS: Record<
  KnowledgeItemSummary["trainingStatus"],
  "secondary" | "outline" | "destructive"
> = {
  not_started: "outline",
  weak: "destructive",
  due_now: "secondary",
  learning: "secondary",
  scheduled: "outline",
  stable: "secondary",
};

export default async function KnowledgeItemsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    domain?: string;
    tag?: string;
    difficulty?: string;
  }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const domain = params.domain?.trim() || undefined;
  const tag = params.tag?.trim() || undefined;
  const difficulty = parseDifficulty(params.difficulty);
  const current = await requireCurrentLearner();
  const catalog = await getKnowledgeItemCatalog({
    query: query || undefined,
    domain,
    tag,
    difficulty,
    userId: current.learner.id,
  });
  const resultSummary = buildResultSummary(catalog.knowledgeItems);
  const activeFilterCount = countActiveFilters({
    q: query || undefined,
    domain,
    tag,
    difficulty,
  });
  const buildHref = createKnowledgeItemCatalogHrefBuilder({
    q: query || null,
    domain: domain ?? null,
    tag: tag ?? null,
    difficulty: difficulty ?? null,
  });

  return (
    <PhaseShell
      activePath="/knowledge-items"
      eyebrow="知识项列表"
      title="查找与浏览知识项"
      density="compact"
    >
      <section className="grid gap-4 rounded-xl border bg-background p-4 shadow-sm md:gap-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">知识项库</Badge>
          <Badge variant="outline">{catalog.knowledgeItems.length} 条结果</Badge>
          <Badge variant="destructive">补弱 {resultSummary.weakCount}</Badge>
          <Badge variant="secondary">到期 {resultSummary.dueCount}</Badge>
          <Badge variant="outline">提示 {resultSummary.hookedCount}</Badge>
          <Badge variant="outline">稳定 {resultSummary.stableCount}</Badge>
          {activeFilterCount > 0 ? (
            <Badge variant="outline">筛选中 {activeFilterCount}</Badge>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <form action="/knowledge-items" className="grid flex-1 gap-2">
            <Label htmlFor="knowledgeItem-search">搜索知识项</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="knowledgeItem-search"
                name="q"
                type="search"
                defaultValue={query}
                placeholder="搜索标题、变量、关键词"
                className="h-9 flex-1"
              />
              {domain ? <input type="hidden" name="domain" value={domain} /> : null}
              {tag ? <input type="hidden" name="tag" value={tag} /> : null}
              {difficulty !== undefined ? (
                <input type="hidden" name="difficulty" value={difficulty} />
              ) : null}
              <button
                type="submit"
                className={cn(buttonVariants({ size: "lg" }), "min-w-24 justify-center")}
              >
                <Search data-icon="inline-start" />
                搜索
              </button>
            </div>
          </form>

          <div className="flex flex-wrap gap-2 lg:max-w-xl lg:justify-end">
            <Link
              href="/knowledge-items/new"
              className={buttonVariants({ size: "lg", variant: "secondary" })}
            >
              <Plus data-icon="inline-start" />
              添加/导入
            </Link>
            <Link
              href={buildHref({
                q: null,
                domain: null,
                tag: null,
                difficulty: null,
              })}
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              清空筛选
            </Link>
          </div>
        </div>

        <div className="grid gap-3 border-t pt-4">
          {activeFilterCount > 0 ? (
            <div className="flex flex-wrap gap-2">
              {query ? <Badge variant="outline">关键词：{query}</Badge> : null}
              {domain ? <Badge variant="outline">知识域：{domain}</Badge> : null}
              {difficulty !== undefined ? <Badge variant="outline">难度：{difficulty}</Badge> : null}
              {tag ? <Badge variant="outline">标签：{tag}</Badge> : null}
            </div>
          ) : null}

          <div className="flex items-center gap-2 text-sm font-medium">
            <Filter data-icon="inline-start" />
            <span>筛选条件</span>
          </div>

          <FilterRow
            label="知识域"
            items={[
              {
                label: "全部",
                href: buildHref({ domain: null }),
                active: !domain,
              },
              ...catalog.filters.domains.map((item) => ({
                label: item,
                href: buildHref({ domain: item }),
                active: domain === item,
              })),
            ]}
          />

          <FilterRow
            label="难度"
            items={[
              {
                label: "全部",
                href: buildHref({ difficulty: null }),
                active: difficulty === undefined,
              },
              ...catalog.filters.difficulties.map((item) => ({
                label: `难度 ${item}`,
                href: buildHref({ difficulty: item }),
                active: difficulty === item,
              })),
            ]}
          />

          <FilterRow
            label="标签"
            items={[
              {
                label: "全部",
                href: buildHref({ tag: null }),
                active: !tag,
              },
              ...catalog.filters.tags.slice(0, 10).map((item) => ({
                label: item,
                href: buildHref({ tag: item }),
                active: tag === item,
              })),
            ]}
          />
        </div>
      </section>

      <section className="grid gap-4">
        {catalog.knowledgeItems.length > 0 ? (
          catalog.knowledgeItems.map((knowledgeItem) => (
            <article
              key={knowledgeItem.id}
              className="grid gap-4 rounded-lg border bg-background p-5 shadow-sm"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="grid gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold">{knowledgeItem.title}</h2>
                    <Badge variant={STATUS_BADGE_VARIANTS[knowledgeItem.trainingStatus]}>
                      {knowledgeItem.trainingStatusLabel}
                    </Badge>
                    <Badge variant="outline">{knowledgeItem.domain}</Badge>
                    {knowledgeItem.hasPersonalMemoryHook ? (
                      <Badge variant="secondary">
                        <Sparkles data-icon="inline-start" />
                        已有下次提示
                      </Badge>
                    ) : null}
                    {knowledgeItem.isWeak ? (
                      <Badge variant="destructive">优先补弱</Badge>
                    ) : null}
                  </div>

                  <KnowledgeItemRenderer
                    contentType={knowledgeItem.contentType}
                    payload={knowledgeItem.renderPayload}
                  />

                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                    {knowledgeItem.summary}
                  </p>
                </div>

                <div className="grid gap-2 rounded-lg border px-4 py-3 text-sm text-muted-foreground lg:min-w-60">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <Clock3 data-icon="inline-start" />
                    <span>下次复习</span>
                  </div>
                  <p>{formatNextReviewAt(knowledgeItem.nextReviewAt)}</p>
                  <p>
                    {knowledgeItem.totalReviews > 0
                      ? `正确 ${knowledgeItem.correctReviews}/${knowledgeItem.totalReviews} 次`
                      : "还没有训练记录"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">难度 {knowledgeItem.difficulty}</Badge>
                {knowledgeItem.tags.slice(0, 4).map((item) => (
                  <Badge key={item} variant="outline">
                    {item}
                  </Badge>
                ))}
                {knowledgeItem.tags.length > 4 ? (
                  <Badge variant="outline">+{knowledgeItem.tags.length - 4}</Badge>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-muted-foreground">
                <div className="flex flex-wrap gap-4">
                  <span>变量：{formatVariablePreview(knowledgeItem)}</span>
                  <span>训练题：{knowledgeItem.reviewItemCount}</span>
                  <span>下次提示：{knowledgeItem.memoryHookCount}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/knowledge-items/${knowledgeItem.slug}?from=knowledgeItems`}
                    className={buttonVariants({ size: "sm", variant: "outline" })}
                  >
                    查看详情
                  </Link>
                  {knowledgeItem.isWeak ? (
                    <Link
                      href={`/knowledge-items/${knowledgeItem.slug}?from=knowledgeItems&focus=anti-patterns`}
                      className={buttonVariants({ size: "sm" })}
                    >
                      继续补弱
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-lg border border-dashed bg-background p-8 text-sm text-muted-foreground">
            当前筛选下还没有匹配结果。可以放宽标签或难度条件，或者直接返回今日复习继续训练。
          </div>
        )}
      </section>
    </PhaseShell>
  );
}

function FilterRow({
  label,
  items,
}: {
  label: string;
  items: Array<{
    label: string;
    href: string;
    active: boolean;
  }>;
}) {
  return (
    <div className="grid gap-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            key={`${label}-${item.label}`}
            href={item.href}
            className={buttonVariants({
              size: "sm",
              variant: item.active ? "default" : "outline",
            })}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

function countActiveFilters(filters: {
  q?: string;
  domain?: string;
  tag?: string;
  difficulty?: number;
}) {
  return [
    Boolean(filters.q),
    Boolean(filters.domain),
    Boolean(filters.tag),
    filters.difficulty !== undefined,
  ].filter(Boolean).length;
}

function parseDifficulty(value?: string) {
  if (!value) {
    return undefined;
  }

  const difficulty = Number(value);

  return Number.isFinite(difficulty) ? difficulty : undefined;
}

function buildResultSummary(knowledgeItems: KnowledgeItemSummary[]) {
  return knowledgeItems.reduce(
    (summary, knowledgeItem) => {
      if (knowledgeItem.trainingStatus === "weak") {
        summary.weakCount += 1;
      }

      if (knowledgeItem.trainingStatus === "due_now") {
        summary.dueCount += 1;
      }

      if (knowledgeItem.trainingStatus === "stable") {
        summary.stableCount += 1;
      }

      if (knowledgeItem.hasPersonalMemoryHook) {
        summary.hookedCount += 1;
      }

      return summary;
    },
    {
      weakCount: 0,
      dueCount: 0,
      stableCount: 0,
      hookedCount: 0,
    },
  );
}

function formatNextReviewAt(nextReviewAt: string | null) {
  if (!nextReviewAt) {
    return "尚未安排";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(nextReviewAt));
}

function formatVariablePreview(knowledgeItem: KnowledgeItemSummary) {
  if (knowledgeItem.variablePreview.length === 0) {
    return "变量说明将在详情页展开";
  }

  return knowledgeItem.variablePreview
    .slice(0, 3)
    .map((variable) => `${variable.symbol}（${variable.name}）`)
    .join("、");
}

function createKnowledgeItemCatalogHrefBuilder(
  current: Partial<{
    q: string | null;
    domain: string | null;
    tag: string | null;
    difficulty: number | null;
  }>,
) {
  return (
    updates?: Partial<{
      q: string | null;
      domain: string | null;
      tag: string | null;
      difficulty: number | null;
    }>,
  ) => {
    const next = {
      ...current,
      ...updates,
    };
    const searchParams = new URLSearchParams();

    if (next.q !== null && next.q !== undefined && next.q !== "") {
      searchParams.set("q", next.q);
    }

    if (next.domain !== null && next.domain !== undefined && next.domain !== "") {
      searchParams.set("domain", next.domain);
    }

    if (next.tag !== null && next.tag !== undefined && next.tag !== "") {
      searchParams.set("tag", next.tag);
    }

    if (
      next.difficulty !== null &&
      next.difficulty !== undefined &&
      Number.isFinite(next.difficulty)
    ) {
      searchParams.set("difficulty", String(next.difficulty));
    }

    const queryString = searchParams.toString();

    return queryString ? `/knowledge-items?${queryString}` : "/knowledge-items";
  };
}
