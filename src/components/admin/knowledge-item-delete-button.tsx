"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type KnowledgeItemDeleteButtonProps = {
  endpoint: string;
  title: string;
  redirectHref?: string;
  className?: string;
  size?: "xs" | "sm";
};

export function KnowledgeItemDeleteButton({
  endpoint,
  title,
  redirectHref,
  className,
  size = "xs",
}: KnowledgeItemDeleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    toast("确认删除知识项", {
      description: `确定删除「${title}」吗？相关复习题、变量、关系和学习记录会一并删除。`,
      action: {
        label: "删除",
        onClick: performDelete,
      },
      cancel: {
        label: "取消",
        onClick: () => undefined,
      },
    });
  }

  function performDelete() {
    startTransition(async () => {
      try {
        const response = await fetch(endpoint, { method: "DELETE" });
        const responseBody = await response.json().catch(() => null);

        if (!response.ok) {
          toast.error(getResponseError(responseBody) ?? `删除失败：${response.status}`);
          return;
        }

        toast.success("已删除");

        if (redirectHref) {
          router.push(redirectHref);
        }

        router.refresh();
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "删除失败。");
      }
    });
  }

  return (
    <div className={cn("flex", className)}>
      <Button
        type="button"
        variant="destructive"
        size={size}
        disabled={isPending}
        onClick={handleDelete}
      >
        {isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
        {isPending ? "删除中..." : "删除"}
      </Button>
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
