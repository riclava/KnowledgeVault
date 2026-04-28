import Link from "next/link";

import { KnowledgeItemAdminForm } from "@/components/admin/knowledge-item-admin-form";
import { buttonVariants } from "@/components/ui/button";

export default function NewAdminKnowledgeItemPage() {
  return (
    <div className="grid max-w-7xl gap-4">
      <header className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-xl font-semibold tracking-tight">新建知识项</h1>
          <p className="max-w-2xl text-sm leading-5 text-muted-foreground">
            创建一个可训练的知识项：先填可识别的基础信息，再补内容、复习题和必要的变量关系。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/knowledge-items"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            返回知识项
          </Link>
          <Link
            href="/admin/import"
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            用 AI 导入
          </Link>
        </div>
      </header>

      <KnowledgeItemAdminForm
        endpoint="/api/admin/knowledge-items"
        method="POST"
        mode="create"
      />
    </div>
  );
}
