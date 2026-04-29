"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type KnowledgeItemFilterFormProps = {
  filters: {
    query?: string;
    domain?: string;
    contentType?: string;
    difficulties?: number[];
  };
  domains: string[];
  hasFilters: boolean;
};

const CONTENT_TYPE_OPTIONS = [
  { value: "math_formula", label: "数学公式" },
  { value: "vocabulary", label: "词汇" },
  { value: "plain_text", label: "纯文本" },
  { value: "concept_card", label: "概念卡片" },
  { value: "comparison_table", label: "对比表" },
  { value: "procedure", label: "流程" },
] as const;

const DIFFICULTY_OPTIONS = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
] as const;

export function AdminKnowledgeItemFilterForm({
  filters,
  domains,
  hasFilters,
}: KnowledgeItemFilterFormProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(filters.query ?? "");
  const selectedDifficulties = new Set(filters.difficulties ?? []);
  const difficultySummary =
    filters.difficulties && filters.difficulties.length > 0
      ? filters.difficulties.join("、")
      : "全部难度";
  const latestSearchParams = searchParams.toString();
  const queryApplyTimer = useRef<number | null>(null);

  useEffect(() => {
    if (query === (filters.query ?? "")) {
      return;
    }

    if (queryApplyTimer.current !== null) {
      window.clearTimeout(queryApplyTimer.current);
    }

    queryApplyTimer.current = window.setTimeout(() => {
      const params = new URLSearchParams(latestSearchParams);
      setOptionalParam(params, "query", query);
      params.delete("page");
      router.replace(buildFilterHref(pathname, params), { scroll: false });
    }, 500);

    return () => {
      if (queryApplyTimer.current !== null) {
        window.clearTimeout(queryApplyTimer.current);
      }
    };
  }, [filters.query, latestSearchParams, pathname, query, router]);

  function handleImmediateFilterChange(event: ChangeEvent<HTMLFormElement>) {
    if (
      event.target instanceof HTMLInputElement &&
      event.target.name === "query"
    ) {
      return;
    }

    applyFormFilters(event.currentTarget);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFormFilters(event.currentTarget);
  }

  function applyFormFilters(form: HTMLFormElement) {
    if (queryApplyTimer.current !== null) {
      window.clearTimeout(queryApplyTimer.current);
      queryApplyTimer.current = null;
    }

    const formData = new FormData(form);
    const params = new URLSearchParams(latestSearchParams);

    setOptionalParam(params, "query", String(formData.get("query") ?? ""));
    setOptionalParam(params, "domain", String(formData.get("domain") ?? ""));
    setOptionalParam(
      params,
      "contentType",
      String(formData.get("contentType") ?? ""),
    );

    params.delete("difficulty");
    for (const difficulty of formData.getAll("difficulty")) {
      params.append("difficulty", String(difficulty));
    }

    params.delete("page");
    router.replace(buildFilterHref(pathname, params), { scroll: false });
  }

  return (
    <form
      onChange={handleImmediateFilterChange}
      onSubmit={handleSubmit}
      className="grid gap-3 rounded-lg border bg-background p-4 shadow-sm lg:grid-cols-[minmax(12rem,1fr)_10rem_10rem_8rem_auto] lg:items-end"
    >
      <div className="grid gap-2">
        <Label htmlFor="admin-query">搜索</Label>
        <Input
          id="admin-query"
          name="query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="标题、slug、摘要或标签"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="admin-domain">领域</Label>
        <select
          id="admin-domain"
          name="domain"
          defaultValue={filters.domain ?? ""}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">全部领域</option>
          {domains.map((domain) => (
            <option key={domain} value={domain}>
              {domain}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="admin-content-type">类型</Label>
        <select
          id="admin-content-type"
          name="contentType"
          defaultValue={filters.contentType ?? ""}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">全部类型</option>
          {CONTENT_TYPE_OPTIONS.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="admin-difficulty">难度</Label>
        <details
          id="admin-difficulty"
          className="group relative h-10 rounded-lg border border-input bg-background text-sm outline-none focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
        >
          <summary className="flex h-full cursor-pointer list-none items-center justify-between gap-2 px-3 marker:hidden">
            <span className="truncate">{difficultySummary}</span>
            <span className="text-muted-foreground group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div className="absolute z-20 mt-1 grid w-36 gap-1 rounded-lg border bg-background p-2 shadow-lg">
            {DIFFICULTY_OPTIONS.map((difficulty) => (
              <label
                key={difficulty.value}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
              >
                <input
                  type="checkbox"
                  name="difficulty"
                  value={difficulty.value}
                  defaultChecked={selectedDifficulties.has(difficulty.value)}
                  className="size-4 accent-primary"
                />
                <span>{difficulty.label}</span>
              </label>
            ))}
          </div>
        </details>
      </div>
      <div className="flex flex-wrap gap-2">
        {hasFilters ? (
          <Link
            href="/admin/knowledge-items"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            清除筛选
          </Link>
        ) : null}
      </div>
    </form>
  );
}

function setOptionalParam(
  params: URLSearchParams,
  key: string,
  value: string,
) {
  const normalized = value.trim();

  if (normalized) {
    params.set(key, normalized);
    return;
  }

  params.delete(key);
}

function buildFilterHref(pathname: string, params: URLSearchParams) {
  const queryString = params.toString();

  return queryString ? `${pathname}?${queryString}` : pathname;
}
