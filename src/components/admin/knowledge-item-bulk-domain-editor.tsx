"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState, useTransition } from "react";
import { Eye, Loader2, Pencil, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { KnowledgeItemDeleteButton } from "@/components/admin/knowledge-item-delete-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type AdminKnowledgeItemRow = {
  id: string;
  slug: string;
  title: string;
  contentType: string;
  domain: string;
  subdomain: string | null;
  visibility: "public" | "private";
  createdByUserId: string | null;
  createdByUser: {
    displayName: string | null;
    email: string | null;
  } | null;
  difficulty: number;
  _count: {
    reviewItems: number;
    variables: number;
    outgoingRelations: number;
  };
};

type KnowledgeItemBulkDomainEditorProps = {
  items: AdminKnowledgeItemRow[];
  hasFilters: boolean;
};

export function AdminKnowledgeItemBulkDomainEditor({
  items,
  hasFilters,
}: KnowledgeItemBulkDomainEditorProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [clearSubdomain, setClearSubdomain] = useState(false);
  const [isPending, startTransition] = useTransition();
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allVisibleSelected =
    items.length > 0 && items.every((item) => selectedSet.has(item.id));

  function toggleAllVisible() {
    setSelectedIds(allVisibleSelected ? [] : items.map((item) => item.id));
  }

  function toggleItem(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id],
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedIds.length === 0) {
      toast.error("请选择要修改的知识项。");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const nextDomain = String(formData.get("domain") ?? "").trim();
    const nextSubdomain = String(formData.get("subdomain") ?? "").trim();
    const shouldClearSubdomain = formData.get("clearSubdomain") === "on";

    if (!nextDomain) {
      toast.error("领域不能为空。");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/knowledge-items", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ids: selectedIds,
            domain: nextDomain,
            subdomain: nextSubdomain,
            clearSubdomain: shouldClearSubdomain,
          }),
        });
        const responseBody = await response.json().catch(() => null);

        if (!response.ok) {
          toast.error(getResponseError(responseBody) ?? `批量修改失败：${response.status}`);
          return;
        }

        toast.success(`已更新 ${getUpdatedCount(responseBody)} 个知识项`);
        setSelectedIds([]);
        setSheetOpen(false);
        setDomain("");
        setSubdomain("");
        setClearSubdomain(false);
        router.refresh();
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "批量修改失败。");
      }
    });
  }

  function handleBulkDelete() {
    if (selectedIds.length === 0) {
      toast.error("请选择要删除的知识项。");
      return;
    }

    toast("确认删除知识项", {
      description: `确定删除选中的 ${selectedIds.length} 个知识项吗？相关复习题、变量、关系和学习记录会一并删除。`,
      action: {
        label: "删除",
        onClick: performBulkDelete,
      },
      cancel: {
        label: "取消",
        onClick: () => undefined,
      },
    });
  }

  function performBulkDelete() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/knowledge-items", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: selectedIds }),
        });
        const responseBody = await response.json().catch(() => null);

        if (!response.ok) {
          toast.error(getResponseError(responseBody) ?? `批量删除失败：${response.status}`);
          return;
        }

        toast.success(`已删除 ${getDeletedCount(responseBody)} 个知识项`);
        setSelectedIds([]);
        setSheetOpen(false);
        router.refresh();
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "批量删除失败。");
      }
    });
  }

  return (
    <div className="grid gap-3">
      {selectedIds.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-lg border bg-background p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">已选 {selectedIds.length} 项</Badge>
            <span className="text-muted-foreground">
              可批量修改当前选中的知识项。
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <Button
                type="button"
                size="sm"
                onClick={() => setSheetOpen(true)}
              >
                <Tags data-icon="inline-start" />
                修改领域/子领域
              </Button>
              <SheetContent side="right" className="w-full max-w-md p-0">
                <form onSubmit={handleSubmit} className="flex min-h-full flex-col">
                  <SheetHeader className="border-b bg-background px-5 py-4">
                    <SheetTitle>修改领域/子领域</SheetTitle>
                    <SheetDescription>
                      将选中的 {selectedIds.length} 个知识项归入新的领域。
                    </SheetDescription>
                  </SheetHeader>

                  <div className="grid gap-4 px-5 py-5">
                    <div className="grid gap-2">
                      <Label htmlFor="bulk-domain">领域</Label>
                      <Input
                        id="bulk-domain"
                        name="domain"
                        value={domain}
                        onChange={(event) => setDomain(event.target.value)}
                        placeholder="新的领域"
                        disabled={isPending}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="bulk-subdomain">子领域</Label>
                      <Input
                        id="bulk-subdomain"
                        name="subdomain"
                        value={subdomain}
                        onChange={(event) => setSubdomain(event.target.value)}
                        placeholder="不填则保留原子领域"
                        disabled={isPending || clearSubdomain}
                      />
                    </div>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm">
                      <input
                        type="checkbox"
                        name="clearSubdomain"
                        checked={clearSubdomain}
                        onChange={(event) => {
                          setClearSubdomain(event.target.checked);
                          if (event.target.checked) {
                            setSubdomain("");
                          }
                        }}
                        disabled={isPending}
                        className="mt-0.5 size-4 accent-primary"
                      />
                      <span className="grid gap-1">
                        <span className="font-medium">清空子领域</span>
                        <span className="text-muted-foreground">
                          勾选后会删除这些知识项原有的子领域。
                        </span>
                      </span>
                    </label>
                    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                      <p className="font-medium">确认修改</p>
                      <p className="mt-1 text-muted-foreground">
                        将 {selectedIds.length} 个知识项修改为：
                        {domain.trim() || "待填写领域"} /{" "}
                        {clearSubdomain
                          ? "清空子领域"
                          : subdomain.trim() || "保留原子领域"}
                      </p>
                    </div>
                  </div>

                  <SheetFooter className="border-t bg-background px-5 py-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => setSheetOpen(false)}
                      >
                        取消
                      </Button>
                      <Button type="submit" disabled={isPending}>
                        {isPending ? (
                          <Loader2
                            data-icon="inline-start"
                            className="animate-spin"
                          />
                        ) : null}
                        确认修改
                      </Button>
                    </div>
                  </SheetFooter>
                </form>
              </SheetContent>
            </Sheet>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={handleBulkDelete}
            >
              {isPending ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <Trash2 data-icon="inline-start" />
              )}
              批量删除
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => {
                setSelectedIds([]);
                setSheetOpen(false);
              }}
            >
              取消选择
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-3 py-2 font-medium">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={items.length === 0}
                  onChange={toggleAllVisible}
                  aria-label="选择当前页知识项"
                  className="size-4 accent-primary"
                />
              </th>
              <th className="px-3 py-2 font-medium">标题</th>
              <th className="px-3 py-2 font-medium">类型</th>
              <th className="px-3 py-2 font-medium">领域</th>
              <th className="px-3 py-2 font-medium">可见性</th>
              <th className="px-3 py-2 font-medium">难度</th>
              <th className="px-3 py-2 font-medium">内容</th>
              <th className="px-3 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                      aria-label={`选择 ${item.title}`}
                      className="size-4 accent-primary"
                    />
                  </td>
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
                  <td className="px-3 py-2">
                    <div className="grid gap-1">
                      <Badge
                        variant={
                          item.visibility === "private" ? "secondary" : "outline"
                        }
                        className="w-fit"
                      >
                        {item.visibility === "private" ? "私有" : "公共"}
                      </Badge>
                      {item.visibility === "private" ? (
                        <p className="max-w-36 truncate text-xs text-muted-foreground">
                          {item.createdByUser?.displayName ||
                            item.createdByUser?.email ||
                            item.createdByUserId ||
                            "未知创建者"}
                        </p>
                      ) : null}
                    </div>
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
                        href={`/admin/knowledge-items/${item.id}`}
                        className={buttonVariants({
                          variant: "secondary",
                          size: "xs",
                        })}
                      >
                        <Eye data-icon="inline-start" />
                        查看
                      </Link>
                      <Link
                        href={`/admin/knowledge-items/${item.id}/edit`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "xs",
                        })}
                      >
                        <Pencil data-icon="inline-start" />
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
                  colSpan={8}
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

function getResponseError(responseBody: unknown) {
  if (
    responseBody &&
    typeof responseBody === "object" &&
    "error" in responseBody &&
    typeof responseBody.error === "string"
  ) {
    return responseBody.error;
  }

  return null;
}

function getUpdatedCount(responseBody: unknown) {
  if (
    responseBody &&
    typeof responseBody === "object" &&
    "data" in responseBody &&
    responseBody.data &&
    typeof responseBody.data === "object" &&
    "updated" in responseBody.data &&
    typeof responseBody.data.updated === "number"
  ) {
    return responseBody.data.updated;
  }

  return 0;
}

function getDeletedCount(responseBody: unknown) {
  if (
    responseBody &&
    typeof responseBody === "object" &&
    "data" in responseBody &&
    responseBody.data &&
    typeof responseBody.data === "object" &&
    "deleted" in responseBody.data &&
    typeof responseBody.data.deleted === "number"
  ) {
    return responseBody.data.deleted;
  }

  return 0;
}
