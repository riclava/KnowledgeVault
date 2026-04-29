import { AdminBulkGenerateImportForm } from "@/components/admin/admin-bulk-generate-import-form";
import { requireAdminPage } from "@/server/admin/admin-auth";
import { listAdminBulkGenerateImportRunsForAdmin } from "@/server/admin/admin-bulk-generate-import-service";
import { listAdminKnowledgeItemDomainOptions } from "@/server/admin/admin-knowledge-item-service";

export default async function AdminBulkGenerateImportPage() {
  const admin = await requireAdminPage();
  const [domainOptions, initialRuns] = await Promise.all([
    listAdminKnowledgeItemDomainOptions(),
    listAdminBulkGenerateImportRunsForAdmin({ adminUserId: admin.id }),
  ]);

  return (
    <div className="grid max-w-6xl gap-5">
      <header className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">批量生成导入</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            上传每行一个知识点标题的文本文件，按指定类型和领域逐行生成并导入。
          </p>
        </div>
      </header>

      <AdminBulkGenerateImportForm
        domainOptions={domainOptions}
        initialRuns={initialRuns}
      />
    </div>
  );
}
