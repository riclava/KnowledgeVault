"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DomainOptions = {
  domains: string[];
  subdomainsByDomain: Record<string, string[]>;
};

type DedupeRunSummary = {
  id: string;
  domain: string;
  subdomain: string | null;
  status: string;
  candidateCount: number;
  warningMessage: string | null;
  createdAt: string | Date;
};

type DedupeCandidate = {
  id: string;
  knowledgeItemIds: string[];
  localScore: number;
  localReasons: unknown;
  suggestedCanonicalItemId: string | null;
  status: string;
  warningMessage: string | null;
};

type DedupeItemSummary = {
  id: string;
  title: string;
  slug: string;
  contentType: string;
  domain: string;
  subdomain: string | null;
  summary: string;
  difficulty: number;
  updatedAt: string | Date;
  _count: {
    reviewItems: number;
    variables: number;
    outgoingRelations: number;
    userStates: number;
    reviewLogs: number;
    memoryHooks: number;
  };
};

type DedupeRunDetail = {
  run: DedupeRunSummary & {
    candidates: DedupeCandidate[];
  };
  items: DedupeItemSummary[];
};

const ALL_SUBDOMAINS_VALUE = "__all_subdomains__";

export function KnowledgeDedupePanel({
  domainOptions,
  runs,
  selectedRun,
}: {
  domainOptions: DomainOptions;
  runs: DedupeRunSummary[];
  selectedRun: DedupeRunDetail | null;
}) {
  const router = useRouter();
  const [domain, setDomain] = useState(domainOptions.domains[0] ?? "");
  const [subdomain, setSubdomain] = useState("");
  const [threshold, setThreshold] = useState("0.55");
  const [useAiReview, setUseAiReview] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const availableSubdomains = domainOptions.subdomainsByDomain[domain] ?? [];
  const itemById = useMemo(
    () => new Map((selectedRun?.items ?? []).map((item) => [item.id, item])),
    [selectedRun],
  );

  async function handleScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const response = await fetch("/api/admin/dedupe/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain,
        subdomain,
        threshold,
        useAiReview,
      }),
    });
    const payload = await response.json();
    setIsSubmitting(false);

    if (!response.ok) {
      setMessage(payload.error ?? "扫描失败。");
      return;
    }

    router.push(`/admin/dedupe?runId=${payload.data.id}`);
    router.refresh();
  }

  async function ignoreCandidate(candidateId: string) {
    await mutateCandidate(`/api/admin/dedupe/candidates/${candidateId}/ignore`, {
      reason: "本轮忽略",
    });
  }

  async function mergeCandidate(
    candidateId: string,
    canonicalKnowledgeItemId: string,
    mergedKnowledgeItemIds: string[],
  ) {
    await mutateCandidate(`/api/admin/dedupe/candidates/${candidateId}/merge`, {
      canonicalKnowledgeItemId,
      mergedKnowledgeItemIds,
    });
  }

  async function mutateCandidate(url: string, body: unknown) {
    setIsSubmitting(true);
    setMessage("");

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    setIsSubmitting(false);

    if (!response.ok) {
      setMessage(payload.error ?? "操作失败。");
      return;
    }

    setMessage("操作已完成。");
    router.refresh();
  }

  return (
    <div className="grid gap-5">
      <form
        onSubmit={handleScan}
        className="grid gap-3 rounded-lg border bg-background p-4 shadow-sm lg:grid-cols-[minmax(12rem,1fr)_minmax(10rem,14rem)_8rem_auto_auto] lg:items-end"
      >
        <div className="grid gap-2">
          <Label htmlFor="dedupe-domain">领域</Label>
          <Select
            id="dedupe-domain"
            value={domain}
            onValueChange={(value) => {
              setDomain(value ?? "");
              setSubdomain("");
            }}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="选择领域" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {domainOptions.domains.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dedupe-subdomain">子领域</Label>
          <Select
            id="dedupe-subdomain"
            value={subdomain || ALL_SUBDOMAINS_VALUE}
            onValueChange={(value) =>
              setSubdomain(value === ALL_SUBDOMAINS_VALUE ? "" : value ?? "")
            }
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={ALL_SUBDOMAINS_VALUE}>全部子领域</SelectItem>
                {availableSubdomains.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="dedupe-threshold">阈值</Label>
          <Input
            id="dedupe-threshold"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            inputMode="decimal"
          />
        </div>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useAiReview}
            onChange={(event) => setUseAiReview(event.target.checked)}
            className="size-4 accent-primary"
          />
          AI 复核
        </label>
        <Button type="submit" disabled={!domain || isSubmitting} size="sm">
          扫描重复
        </Button>
      </form>

      {message ? (
        <p className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}

      <section className="grid gap-3 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-lg border bg-background">
          <div className="border-b px-3 py-2">
            <h2 className="text-sm font-semibold">最近扫描</h2>
          </div>
          <div className="grid divide-y">
            {runs.length > 0 ? (
              runs.map((run) => (
                <Link
                  key={run.id}
                  href={`/admin/dedupe?runId=${run.id}`}
                  className="grid gap-1 px-3 py-2 text-sm hover:bg-muted/60"
                >
                  <span className="font-medium">
                    {run.domain}
                    {run.subdomain ? ` / ${run.subdomain}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {run.status} · {run.candidateCount} 组 ·{" "}
                    {formatDate(run.createdAt)}
                  </span>
                </Link>
              ))
            ) : (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                暂无扫描记录。
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-3">
          {selectedRun ? (
            <>
              <div className="rounded-lg border bg-background p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold">
                      {selectedRun.run.domain}
                      {selectedRun.run.subdomain
                        ? ` / ${selectedRun.run.subdomain}`
                        : ""}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedRun.run.status} · {selectedRun.run.candidateCount}{" "}
                      组候选
                    </p>
                  </div>
                  {selectedRun.run.warningMessage ? (
                    <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {selectedRun.run.warningMessage}
                    </span>
                  ) : null}
                </div>
              </div>

              {selectedRun.run.candidates.length > 0 ? (
                selectedRun.run.candidates.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    itemById={itemById}
                    isSubmitting={isSubmitting}
                    onIgnore={ignoreCandidate}
                    onMerge={mergeCandidate}
                  />
                ))
              ) : (
                <p className="rounded-lg border bg-background px-3 py-8 text-center text-sm text-muted-foreground">
                  本次扫描没有发现候选重复组。
                </p>
              )}
            </>
          ) : (
            <p className="rounded-lg border bg-background px-3 py-8 text-center text-sm text-muted-foreground">
              选择一次扫描查看候选组。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function CandidateCard({
  candidate,
  itemById,
  isSubmitting,
  onIgnore,
  onMerge,
}: {
  candidate: DedupeCandidate;
  itemById: Map<string, DedupeItemSummary>;
  isSubmitting: boolean;
  onIgnore: (candidateId: string) => void;
  onMerge: (
    candidateId: string,
    canonicalKnowledgeItemId: string,
    mergedKnowledgeItemIds: string[],
  ) => void;
}) {
  const defaultCanonical =
    candidate.suggestedCanonicalItemId ?? candidate.knowledgeItemIds[0] ?? "";
  const [canonicalId, setCanonicalId] = useState(defaultCanonical);
  const mergedIds = candidate.knowledgeItemIds.filter((id) => id !== canonicalId);
  const canEdit = candidate.status === "pending";

  return (
    <article className="grid gap-3 rounded-lg border bg-background p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">
            候选组 · {(candidate.localScore * 100).toFixed(0)}%
          </h3>
          <p className="text-xs text-muted-foreground">
            {candidate.status}
            {candidate.warningMessage ? ` · ${candidate.warningMessage}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canEdit || isSubmitting}
            onClick={() => onIgnore(candidate.id)}
          >
            忽略本轮
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canEdit || isSubmitting || mergedIds.length === 0}
            onClick={() => onMerge(candidate.id, canonicalId, mergedIds)}
          >
            合并
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`canonical-${candidate.id}`}>保留项</Label>
        <Select
          id={`canonical-${candidate.id}`}
          value={canonicalId}
          onValueChange={(value) => setCanonicalId(value ?? "")}
          disabled={!canEdit}
        >
          <SelectTrigger className="h-10 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {candidate.knowledgeItemIds.map((itemId) => {
                const item = itemById.get(itemId);

                return (
                  <SelectItem key={itemId} value={itemId}>
                    {item?.title ?? itemId}
                  </SelectItem>
                );
              })}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {candidate.knowledgeItemIds.map((itemId) => {
          const item = itemById.get(itemId);

          return item ? (
            <div key={item.id} className="grid gap-2 rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.slug}</p>
                </div>
                <Link
                  href={`/admin/knowledge-items/${item.id}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  详情
                </Link>
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {item.summary}
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{item.contentType}</span>
                <span>难度 {item.difficulty}</span>
                <span>复习题 {item._count.reviewItems}</span>
                <span>变量 {item._count.variables}</span>
                <span>关系 {item._count.outgoingRelations}</span>
                <span>状态 {item._count.userStates}</span>
                <span>日志 {item._count.reviewLogs}</span>
                <span>记忆钩子 {item._count.memoryHooks}</span>
              </div>
            </div>
          ) : (
            <div key={itemId} className="rounded-md border p-3 text-sm">
              {itemId}
            </div>
          );
        })}
      </div>

      {normalizeReasons(candidate.localReasons).length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {normalizeReasons(candidate.localReasons).map((reason) => (
            <span
              key={reason.kind}
              className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
            >
              {reason.detail} {(reason.score * 100).toFixed(0)}%
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeReasons(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const record = entry as Record<string, unknown>;
    const kind = typeof record.kind === "string" ? record.kind : "";
    const detail = typeof record.detail === "string" ? record.detail : kind;
    const score = typeof record.score === "number" ? record.score : 0;

    return kind ? [{ kind, detail, score }] : [];
  });
}
