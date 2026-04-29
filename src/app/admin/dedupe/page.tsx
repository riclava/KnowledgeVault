import { KnowledgeDedupePanel } from "@/components/admin/knowledge-dedupe-panel";
import {
  getKnowledgeDedupeRunDetailForAdmin,
  listKnowledgeDedupeRunsForAdmin,
} from "@/server/admin/admin-knowledge-dedupe-scan-service";
import { listAdminKnowledgeItemDomainOptions } from "@/server/admin/admin-knowledge-item-service";

type AdminDedupePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function AdminDedupePage({
  searchParams,
}: AdminDedupePageProps) {
  const params = await searchParams;
  const runId = stringParam(params.runId);
  const [domainOptions, runs, selectedRun] = await Promise.all([
    listAdminKnowledgeItemDomainOptions(),
    listKnowledgeDedupeRunsForAdmin(),
    runId ? getKnowledgeDedupeRunDetailForAdmin(runId) : null,
  ]);

  return (
    <div className="grid gap-5">
      <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">知识去重</h1>
          <p className="text-sm text-muted-foreground">
            周期性扫描公共知识库，人工确认后合并重复知识项。
          </p>
        </div>
      </header>

      <KnowledgeDedupePanel
        domainOptions={domainOptions}
        runs={toSerializable(runs)}
        selectedRun={toSerializable(selectedRun)}
      />
    </div>
  );
}

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toSerializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
