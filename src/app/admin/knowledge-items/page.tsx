import Link from "next/link";

import { AdminKnowledgeItemBulkDomainEditor } from "@/components/admin/knowledge-item-bulk-domain-editor";
import { AdminKnowledgeItemFilterForm } from "@/components/admin/knowledge-item-filter-form";
import { buttonVariants } from "@/components/ui/button";
import {
  listAdminKnowledgeItemDomains,
  listAdminKnowledgeItems,
  normalizeAdminKnowledgeItemSearchParams,
} from "@/server/admin/admin-knowledge-item-service";

type KnowledgeItemsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function AdminKnowledgeItemsPage({
  searchParams,
}: KnowledgeItemsPageProps) {
  const params = toURLSearchParams(await searchParams);
  const filters = normalizeAdminKnowledgeItemSearchParams(params);
  const hasFilters = Array.from(params.keys()).some(
    (key) => key !== "page" && key !== "pageSize",
  );
  const [result, domains] = await Promise.all([
    listAdminKnowledgeItems(filters),
    listAdminKnowledgeItemDomains(),
  ]);

  return (
    <div className="grid gap-5">
      <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">知识项</h1>
          <p className="text-sm text-muted-foreground">
            检查知识项结构、复习题数量、变量和关系。
          </p>
        </div>
        <Link
          href="/admin/knowledge-items/new"
          className={buttonVariants({ size: "sm" })}
        >
          新建知识项
        </Link>
      </header>

      <AdminKnowledgeItemFilterForm
        key={params.toString()}
        filters={filters}
        domains={domains}
        hasFilters={hasFilters}
      />

      <AdminKnowledgeItemBulkDomainEditor
        items={result.items}
        hasFilters={hasFilters}
      />

      <nav
        aria-label="知识项分页"
        className="flex flex-col gap-3 border-t pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
      >
        <p>
          第 {result.page} / {result.pageCount} 页 · 共 {result.total} 项
        </p>
        <div className="flex gap-2">
          <Link
            href={buildPageHref(params, result.page - 1)}
            aria-disabled={result.page <= 1}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: result.page <= 1 ? "pointer-events-none opacity-50" : "",
            })}
          >
            上一页
          </Link>
          <Link
            href={buildPageHref(params, result.page + 1)}
            aria-disabled={result.page >= result.pageCount}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className:
                result.page >= result.pageCount
                  ? "pointer-events-none opacity-50"
                  : "",
            })}
          >
            下一页
          </Link>
        </div>
      </nav>
    </div>
  );
}

function toURLSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, entry);
      }
      continue;
    }

    if (value !== undefined) {
      params.set(key, value);
    }
  }

  return params;
}

function buildPageHref(currentParams: URLSearchParams, page: number) {
  const params = new URLSearchParams(currentParams);
  params.set("page", String(Math.max(1, page)));

  return `/admin/knowledge-items?${params.toString()}`;
}
