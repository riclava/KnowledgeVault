"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  Settings2,
  Trash2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ImportDomainOptions = {
  domains: string[];
  subdomainsByDomain: Record<string, string[]>;
};

type RunStatus = "pending" | "running" | "completed" | "failed" | "canceled";
type RowStatus =
  | "pending"
  | "processing"
  | "imported"
  | "duplicate_skipped"
  | "ai_failed"
  | "validation_failed"
  | "save_failed"
  | "canceled";

type BulkRunDetail = {
  id: string;
  status: RunStatus;
  contentType: string;
  domain: string;
  subdomain?: string;
  totalCount: number;
  importedCount: number;
  failedCount: number;
  duplicateSkippedCount: number;
  canceledCount: number;
  pendingCount: number;
  processingCount: number;
  errorMessage?: string;
  rows: BulkRunRow[];
};

type BulkRunSummary = Omit<BulkRunDetail, "rows"> & {
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
};

type BulkRunRow = {
  id: string;
  lineNumber: number;
  sourceText: string;
  status: RowStatus;
  generatedSlug?: string;
  generatedTitle?: string;
  savedKnowledgeItemId?: string;
  duplicateWarnings: Array<{
    score: number;
    existingItem: {
      slug: string;
      title: string;
    };
  }>;
  validationErrors: Array<{
    message: string;
  }>;
  errorMessage?: string;
};

type AdminBulkGenerateImportFormProps = {
  domainOptions: ImportDomainOptions;
  initialRuns: BulkRunSummary[];
};

const CONTENT_TYPE_OPTIONS = [
  { value: "concept_card", label: "概念卡" },
  { value: "procedure", label: "流程" },
  { value: "comparison_table", label: "对比表" },
  { value: "math_formula", label: "公式" },
  { value: "vocabulary", label: "词汇" },
  { value: "plain_text", label: "纯文本" },
] as const;

const TERMINAL_RUN_STATUSES = new Set<RunStatus>([
  "completed",
  "failed",
  "canceled",
]);
const SELECT_EXISTING_OPTION_VALUE = "__select_existing_option__";

export function AdminBulkGenerateImportForm({
  domainOptions,
  initialRuns,
}: AdminBulkGenerateImportFormProps) {
  const [run, setRun] = useState<BulkRunDetail | null>(null);
  const [runs, setRuns] = useState<BulkRunSummary[]>(initialRuns);
  const [contentType, setContentType] = useState("concept_card");
  const [domain, setDomain] = useState(domainOptions.domains[0] ?? "");
  const [subdomain, setSubdomain] = useState("");
  const [isRefreshingRuns, setIsRefreshingRuns] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const availableSubdomains = useMemo(
    () => domainOptions.subdomainsByDomain[domain] ?? [],
    [domain, domainOptions.subdomainsByDomain],
  );
  const progressValue = useMemo(() => {
    if (!run || run.totalCount === 0) {
      return 0;
    }

    const done =
      run.importedCount +
      run.failedCount +
      run.duplicateSkippedCount +
      run.canceledCount;

    return Math.round((done / run.totalCount) * 100);
  }, [run]);
  const activeRunId =
    run && !TERMINAL_RUN_STATUSES.has(run.status) ? run.id : null;

  const refreshRuns = useCallback(async () => {
    setIsRefreshingRuns(true);

    try {
      const response = await fetch("/api/admin/bulk-generate-import/runs");
      const responseBody = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(getResponseError(responseBody) ?? "批量生成任务列表读取失败。");
        return;
      }

      setRuns(responseBody?.data ?? []);
    } finally {
      setIsRefreshingRuns(false);
    }
  }, []);

  const pollRun = useCallback(async (runId: string) => {
    const response = await fetch(
      `/api/admin/bulk-generate-import/runs/${encodeURIComponent(runId)}`,
    );
    const responseBody = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(getResponseError(responseBody) ?? "批量生成任务读取失败。");
      return;
    }

    setRun(responseBody?.data ?? null);
  }, []);

  const loadRun = useCallback(
    async (runId: string) => {
      await pollRun(runId);
    },
    [pollRun],
  );

  useEffect(() => {
    if (!activeRunId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void pollRun(activeRunId);
    }, 1500);

    return () => window.clearInterval(intervalId);
  }, [activeRunId, pollRun]);

  async function createRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];

    if (!file) {
      toast.error("请选择要上传的文件。");
      return;
    }

    startTransition(async () => {
      try {
        const text = await file.text();
        const lines = text.split(/\r?\n/);
        const response = await fetch("/api/admin/bulk-generate-import/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentType,
            domain,
            subdomain,
            lines,
          }),
        });
        const responseBody = await response.json().catch(() => null);

        if (!response.ok) {
          toast.error(getResponseError(responseBody) ?? "批量生成任务创建失败。");
          return;
        }

        const runId = responseBody?.data?.runId;

        if (!runId) {
          toast.error("批量生成任务缺少编号。");
          return;
        }

        await pollRun(runId);
        await refreshRuns();
        await startProcessing(runId);
        toast.success("批量生成任务已启动。");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "批量生成任务创建失败。");
      }
    });
  }

  async function startProcessing(runId: string) {
    const response = await fetch(
      `/api/admin/bulk-generate-import/runs/${encodeURIComponent(runId)}/process`,
      { method: "POST" },
    );
    const responseBody = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(getResponseError(responseBody) ?? "批量生成任务启动失败。");
      return;
    }

    await pollRun(runId);
    await refreshRuns();
  }

  async function cancelRun(runId: string) {
    const response = await fetch(
      `/api/admin/bulk-generate-import/runs/${encodeURIComponent(runId)}/cancel`,
      { method: "POST" },
    );
    const responseBody = await response.json().catch(() => null);

    if (!response.ok) {
      toast.error(getResponseError(responseBody) ?? "批量生成任务取消失败。");
      return;
    }

    await pollRun(runId);
    await refreshRuns();
    toast.success("批量生成任务已取消。");
  }

  function deleteRun(runId: string) {
    toast("确认删除批量生成任务", {
      description: "删除后会移除该任务和所有行级处理记录，已导入的知识项不会被删除。",
      action: {
        label: "删除",
        onClick: () => performDeleteRun(runId),
      },
      cancel: {
        label: "取消",
        onClick: () => undefined,
      },
    });
  }

  function performDeleteRun(runId: string) {
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/admin/bulk-generate-import/runs/${encodeURIComponent(runId)}`,
          { method: "DELETE" },
        );
        const responseBody = await response.json().catch(() => null);

        if (!response.ok) {
          toast.error(getResponseError(responseBody) ?? "批量生成任务删除失败。");
          return;
        }

        setRuns((current) => current.filter((summary) => summary.id !== runId));
        setRun((current) => (current?.id === runId ? null : current));
        await refreshRuns();
        toast.success("批量生成任务已删除。");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "批量生成任务删除失败。");
      }
    });
  }

  return (
    <section className="grid gap-5">
      <form
        onSubmit={createRun}
        className="overflow-hidden rounded-lg border bg-background shadow-sm"
      >
        <div className="grid gap-5 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-md border bg-muted/40 text-primary">
                <Settings2 className="size-4" />
              </span>
              <div className="grid gap-0.5">
                <h2 className="text-sm font-semibold">生成设置</h2>
                <p className="text-xs text-muted-foreground">
                  {labelForContentType(contentType)} · {domain || "待填写领域"}
                  {subdomain ? ` / ${subdomain}` : ""}
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="w-fit">
              每行一个知识点
            </Badge>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="grid gap-2">
              <Label htmlFor="bulk-content-type">内容类型</Label>
              <Select
                id="bulk-content-type"
                name="contentType"
                value={contentType}
                onValueChange={(value) => {
                  if (value) setContentType(value);
                }}
              >
                <SelectTrigger className="h-10 w-full bg-background data-[size=default]:h-10">
                  <SelectValue>{labelForContentType(contentType)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {CONTENT_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <BulkDomainInput
              id="bulk-domain"
              label="领域"
              name="domain"
              value={domain}
              placeholder="填写或选择领域"
              required
              disabled={isPending}
              options={domainOptions.domains}
              selectLabel="选择已有领域"
              onChange={(value) => {
                setDomain(value);
                setSubdomain("");
              }}
            />
            <BulkDomainInput
              id="bulk-subdomain"
              label="子领域"
              name="subdomain"
              value={subdomain}
              placeholder="填写或选择子领域"
              disabled={isPending}
              options={availableSubdomains}
              selectLabel="选择已有子领域"
              onChange={setSubdomain}
            />
          </div>

          <div className="grid gap-3 border-t pt-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-md border bg-muted/40 text-primary">
                <FileText className="size-4" />
              </span>
              <div className="grid gap-0.5">
                <Label htmlFor="bulk-source-file" className="text-sm font-semibold">
                  来源文件
                </Label>
                <p className="text-xs text-muted-foreground">
                  支持 .txt 或 .csv 文本文件
                </p>
              </div>
            </div>
            <Input
              ref={fileInputRef}
              id="bulk-source-file"
              className="h-11 cursor-pointer bg-background file:mr-4 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary"
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-xs text-muted-foreground">
            {domain ? `将导入到「${domain}${subdomain ? ` / ${subdomain}` : ""}」` : "填写领域后即可创建任务"}
          </p>
          <Button type="submit" disabled={isPending} className="h-10 w-full sm:w-auto">
            {isPending ? <Loader2 className="animate-spin" /> : <UploadCloud />}
            创建并开始处理
          </Button>
        </div>
      </form>

      <section className="grid gap-4 rounded-lg border bg-background p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-1">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Clock3 className="size-4 text-primary" />
              任务管理
            </h2>
            <p className="text-sm text-muted-foreground">
              最近任务可刷新、恢复查看，等待中的任务可继续处理。
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRefreshingRuns}
            onClick={() => void refreshRuns()}
          >
            <RefreshCw className={isRefreshingRuns ? "animate-spin" : ""} />
            刷新任务
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[54rem] text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">最近任务</th>
                <th className="px-3 py-2 font-medium">范围</th>
                <th className="px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 font-medium">进度</th>
                <th className="px-3 py-2 font-medium">创建时间</th>
                <th className="px-3 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {runs.length > 0 ? (
                runs.map((summary) => (
                  <tr
                    key={summary.id}
                    className={run?.id === summary.id ? "border-t bg-muted/30" : "border-t"}
                  >
                    <td className="px-3 py-2 font-medium">
                      {summary.id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {summary.domain}
                      {summary.subdomain ? ` / ${summary.subdomain}` : ""} ·{" "}
                      {labelForContentType(summary.contentType)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={summary.status === "failed" ? "destructive" : "secondary"}>
                        {labelForRunStatus(summary.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {progressText(summary)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatDateTime(summary.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void loadRun(summary.id)}
                        >
                          查看
                        </Button>
                        {summary.status === "pending" ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void startProcessing(summary.id)}
                          >
                            <Play />
                            继续处理
                          </Button>
                        ) : null}
                        {canCancelRun(summary.status) ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void cancelRun(summary.id)}
                          >
                            <XCircle />
                            取消任务
                          </Button>
                        ) : null}
                        {canDeleteRun(summary) ? (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            disabled={isPending}
                            onClick={() => deleteRun(summary.id)}
                          >
                            <Trash2 />
                            删除任务
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-8 text-center text-sm text-muted-foreground"
                  >
                    暂无批量生成任务
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {run ? (
        <section className="grid gap-4 rounded-lg border bg-background p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid gap-1">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                {run.status === "completed" ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : (
                  <Play className="size-4 text-primary" />
                )}
                处理进度
              </h2>
              <p className="text-sm text-muted-foreground">
                {run.domain}
                {run.subdomain ? ` / ${run.subdomain}` : ""} · {labelForContentType(run.contentType)}
              </p>
            </div>
            <Badge variant={run.status === "failed" ? "destructive" : "secondary"}>
              {labelForRunStatus(run.status)}
            </Badge>
          </div>

          <div className="grid gap-2">
            <Progress value={progressValue} />
            <div className="grid gap-2 sm:grid-cols-6">
              <Metric label="已导入" value={run.importedCount} />
              <Metric label="重复跳过" value={run.duplicateSkippedCount} />
              <Metric label="失败" value={run.failedCount} />
              <Metric label="已取消" value={run.canceledCount} />
              <Metric label="处理中" value={run.processingCount} />
              <Metric label="等待中" value={run.pendingCount} />
            </div>
          </div>

          {run.errorMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {run.errorMessage}
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">行</th>
                  <th className="px-3 py-2 font-medium">原始文本</th>
                  <th className="px-3 py-2 font-medium">状态</th>
                  <th className="px-3 py-2 font-medium">生成结果</th>
                  <th className="px-3 py-2 font-medium">详情</th>
                </tr>
              </thead>
              <tbody>
                {run.rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.lineNumber}
                    </td>
                    <td className="px-3 py-2">{row.sourceText}</td>
                    <td className="px-3 py-2">
                      <Badge variant={badgeVariantForRow(row.status)}>
                        {labelForRowStatus(row.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {row.generatedTitle || row.generatedSlug || "-"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {rowDetail(row)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  );
}

function BulkDomainInput({
  id,
  label,
  name,
  value,
  placeholder,
  required = false,
  disabled = false,
  options,
  selectLabel,
  onChange,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
  options: string[];
  selectLabel: string;
  onChange: (value: string) => void;
}) {
  const hasOptions = options.length > 0;
  const selectDisplayLabel = hasOptions ? "从存量选择" : "暂无存量可选";

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <Input
          id={id}
          name={name}
          value={value}
          placeholder={placeholder}
          className="h-10"
          required={required}
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
            }
          }}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        <Select
          aria-label={selectLabel}
          value={SELECT_EXISTING_OPTION_VALUE}
          disabled={disabled || !hasOptions}
          onValueChange={(nextValue) => {
            if (nextValue && nextValue !== SELECT_EXISTING_OPTION_VALUE) {
              onChange(nextValue);
            }
          }}
        >
          <SelectTrigger className="h-10 min-w-0 data-[size=default]:h-10">
            <SelectValue>{selectDisplayLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value={SELECT_EXISTING_OPTION_VALUE}>
                {selectDisplayLabel}
              </SelectItem>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function progressText(run: Pick<
  BulkRunSummary,
  | "totalCount"
  | "importedCount"
  | "failedCount"
  | "duplicateSkippedCount"
  | "canceledCount"
  | "processingCount"
  | "pendingCount"
>) {
  const done =
    run.importedCount +
    run.failedCount +
    run.duplicateSkippedCount +
    run.canceledCount;

  return `${done}/${run.totalCount} · 处理中 ${run.processingCount} · 等待 ${run.pendingCount}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function labelForContentType(value: string) {
  return CONTENT_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function labelForRunStatus(status: RunStatus) {
  if (status === "pending") return "等待中";
  if (status === "running") return "处理中";
  if (status === "completed") return "已完成";
  if (status === "canceled") return "已取消";
  return "失败";
}

function canCancelRun(status: RunStatus) {
  return status === "pending" || status === "running";
}

function canDeleteRun(
  run: Pick<BulkRunSummary, "status" | "processingCount">,
) {
  return TERMINAL_RUN_STATUSES.has(run.status) && run.processingCount === 0;
}

function labelForRowStatus(status: RowStatus) {
  if (status === "pending") return "等待中";
  if (status === "processing") return "处理中";
  if (status === "imported") return "已导入";
  if (status === "duplicate_skipped") return "重复跳过";
  if (status === "canceled") return "已取消";
  return "失败";
}

function badgeVariantForRow(status: RowStatus) {
  if (status === "imported") return "secondary";
  if (status === "duplicate_skipped") return "outline";
  if (status === "pending" || status === "processing" || status === "canceled") {
    return "secondary";
  }
  return "destructive";
}

function rowDetail(row: BulkRunRow) {
  if (row.errorMessage) {
    return row.errorMessage;
  }

  if (row.validationErrors.length > 0) {
    return row.validationErrors.map((error) => error.message).join("；");
  }

  if (row.duplicateWarnings.length > 0) {
    const first = row.duplicateWarnings[0];

    return first
      ? `与「${first.existingItem.title}」相似度 ${Math.round(first.score * 100)}%`
      : "疑似重复";
  }

  if (row.savedKnowledgeItemId) {
    return row.savedKnowledgeItemId;
  }

  return "-";
}

function getResponseError(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }

  return undefined;
}
