"use client";

import Link from "next/link";
import { BrainCircuit, FileCheck2, FilePenLine, WandSparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { ContentAssistWorkspaceItem } from "@/types/content-assist";

export function ContentAssistWorkspace({
  items,
}: {
  items: ContentAssistWorkspaceItem[];
}) {
  return (
    <section className="grid gap-4">
      {items.map((item) => (
        <div
          key={item.knowledgeItemId}
          className="grid gap-4 rounded-lg border bg-background p-5 shadow-sm"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">{item.title}</h2>
                <Badge variant="outline">{item.domain}</Badge>
                <Badge variant="outline">难度 {item.difficulty}</Badge>
                {item.draftStatus === "approved" ? (
                  <Badge variant="secondary">
                    <FileCheck2 data-icon="inline-start" />
                    已审核
                  </Badge>
                ) : item.draftStatus === "draft" ? (
                  <Badge>
                    <FilePenLine data-icon="inline-start" />
                    草稿中
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <BrainCircuit data-icon="inline-start" />
                    尚未生成
                  </Badge>
                )}
              </div>

              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {item.summary}
              </p>
            </div>

            <div className="grid gap-2 text-sm text-muted-foreground lg:min-w-56">
              <p>
                最近更新：{item.draftUpdatedAt ? formatDateTime(item.draftUpdatedAt) : "暂无"}
              </p>
              <p>
                审核通过：{item.approvedAt ? formatDateTime(item.approvedAt) : "未通过"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/content-assist/${item.knowledgeItemSlug}`}
              className={buttonVariants()}
            >
              <WandSparkles data-icon="inline-start" />
              打开工作台
            </Link>
          </div>
        </div>
      ))}
    </section>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
