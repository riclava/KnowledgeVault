import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAdminDashboard } from "@/server/admin/admin-dashboard-service";

export const dynamic = "force-dynamic";

const stats = [
  { key: "knowledgeItemCount", label: "知识项" },
  { key: "reviewItemCount", label: "复习题" },
  { key: "relationCount", label: "知识关系" },
  { key: "variableCount", label: "变量" },
] as const;

export default async function AdminDashboardPage() {
  const dashboard = await getAdminDashboard();

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">内容总览</h1>
          <p className="text-sm text-muted-foreground">
            查看内容库存和最近的 AI 导入结果。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/import"
            className={cn(buttonVariants({ size: "sm" }), "w-fit")}
          >
            AI 导入
          </Link>
          <Link
            href="/admin/dedupe"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
          >
            知识去重
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article
            key={stat.key}
            className="rounded-lg border bg-background p-4 shadow-sm"
          >
            <p className="text-xs font-medium text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {dashboard[stat.key]}
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">最近导入</h2>
          <Link
            href="/admin/import"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            新建导入
          </Link>
        </div>

        <div className="overflow-hidden rounded-lg border bg-background">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">来源</th>
                <th className="px-3 py-2 font-medium">领域</th>
                <th className="px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 text-right font-medium">保存 / 生成</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.recentImportRuns.length > 0 ? (
                dashboard.recentImportRuns.map((run) => (
                  <tr key={run.id} className="border-b last:border-b-0">
                    <td className="max-w-0 px-3 py-2">
                      <p className="truncate font-medium">
                        {run.sourceTitle || "未命名来源"}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {run.defaultDomain}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-md bg-muted px-2 py-1 text-xs">
                        {run.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {run.savedCount} / {run.generatedCount}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-8 text-center text-sm text-muted-foreground"
                  >
                    暂无导入记录。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
