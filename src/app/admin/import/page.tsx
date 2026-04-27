import { AdminImportForm } from "@/components/admin/admin-import-form";

export default function AdminImportPage() {
  return (
    <div className="grid max-w-4xl gap-5">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">AI 导入</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          粘贴来源材料，生成知识项、复习题、变量和关系并保存。
        </p>
      </header>

      <AdminImportForm />
    </div>
  );
}
