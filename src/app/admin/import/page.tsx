import { AdminImportForm } from "@/components/admin/admin-import-form";
import { listAdminKnowledgeItemDomainOptions } from "@/server/admin/admin-knowledge-item-service";

export default async function AdminImportPage() {
  const domainOptions = await listAdminKnowledgeItemDomainOptions();

  return (
    <div className="grid max-w-4xl gap-5">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">AI 导入</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          粘贴来源材料，让 AI 自动识别主题、领域、知识项、复习题和关系。
        </p>
      </header>

      <AdminImportForm domainOptions={domainOptions} />
    </div>
  );
}
