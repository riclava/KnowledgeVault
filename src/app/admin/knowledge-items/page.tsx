import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  listAdminKnowledgeItems,
  normalizeAdminKnowledgeItemSearchParams,
} from "@/server/admin/admin-knowledge-item-service";

type KnowledgeItemsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

const contentTypes = [
  "math_formula",
  "vocabulary",
  "plain_text",
  "concept_card",
  "comparison_table",
  "procedure",
];

export default async function AdminKnowledgeItemsPage({
  searchParams,
}: KnowledgeItemsPageProps) {
  const params = toURLSearchParams(await searchParams);
  const filters = normalizeAdminKnowledgeItemSearchParams(params);
  const hasFilters = Array.from(params.keys()).length > 0;
  const items = await listAdminKnowledgeItems(filters);

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

      <form className="grid gap-3 rounded-lg border bg-background p-4 shadow-sm lg:grid-cols-[minmax(12rem,1fr)_10rem_10rem_7rem_auto] lg:items-end">
        <div className="grid gap-2">
          <Label htmlFor="admin-query">搜索</Label>
          <Input
            id="admin-query"
            name="query"
            defaultValue={filters.query ?? ""}
            placeholder="标题、slug、摘要或标签"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="admin-domain">领域</Label>
          <Input
            id="admin-domain"
            name="domain"
            defaultValue={filters.domain ?? ""}
            placeholder="learning"
          />
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
            {contentTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="admin-difficulty">难度</Label>
          <Input
            id="admin-difficulty"
            name="difficulty"
            type="number"
            min={1}
            max={5}
            defaultValue={filters.difficulty ?? ""}
            placeholder="1-5"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={buttonVariants({ size: "sm" })} type="submit">
            筛选
          </button>
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
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/knowledge-items/${item.id}/edit`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "xs",
                      })}
                    >
                      编辑
                    </Link>
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
