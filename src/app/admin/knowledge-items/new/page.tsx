import { KnowledgeItemAdminForm } from "@/components/admin/knowledge-item-admin-form";

export default function NewAdminKnowledgeItemPage() {
  return (
    <div className="grid max-w-5xl gap-5">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">新建知识项</h1>
      </header>

      <KnowledgeItemAdminForm
        endpoint="/api/admin/knowledge-items"
        method="POST"
      />
    </div>
  );
}
