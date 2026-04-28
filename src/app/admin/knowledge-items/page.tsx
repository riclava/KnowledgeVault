import Link from "next/link";

import { KnowledgeItemDeleteButton } from "@/components/admin/knowledge-item-delete-button";
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
  const hasFilters = Array.from(params.keys()).length > 0;
  const [items, domains] = await Promise.all([
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

      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="min-w-[52rem] w-full text-left text-sm">
          <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">标题</th>
              <th className="px-3 py-2 font-medium">类型</th>
              <th className="px-3 py-2 font-medium">领域</th>
              <th className="px-3 py-2 font-medium">难度</th>
              <th className="px-3 py-2 font-medium">内容</th>
              <th className="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="max-w-64 px-3 py-2">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.slug}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {item.contentType}
                  </td>
                  <td className="px-3 py-2">
                    <p>{item.domain}</p>
                    {item.subdomain ? (
                      <p className="text-xs text-muted-foreground">
                        {item.subdomain}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {item.difficulty}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {item._count.reviewItems} 题 · {item._count.variables} 变量 ·{" "}
                    {item._count.outgoingRelations} 关系
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/knowledge-items/${item.id}/edit`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "xs",
                        })}
                      >
                        编辑
                      </Link>
                      <KnowledgeItemDeleteButton
                        endpoint={`/api/admin/knowledge-items/${item.id}`}
                        title={item.title}
                      />
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-sm text-muted-foreground"
                >
                  {hasFilters ? "没有匹配的知识项，可清除筛选后再试。" : "还没有知识项。"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
