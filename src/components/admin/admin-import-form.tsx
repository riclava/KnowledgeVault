"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ImportResult = unknown;

export function AdminImportForm() {
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult>(null);
  const [isPending, startTransition] = useTransition();
  const summary = useMemo(() => getImportSummary(result), [result]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const payload = {
      sourceTitle: String(formData.get("sourceTitle") ?? ""),
      defaultDomain: String(formData.get("defaultDomain") ?? ""),
      defaultSubdomain: String(formData.get("defaultSubdomain") ?? ""),
      sourceMaterial: String(formData.get("sourceMaterial") ?? ""),
    };

    startTransition(async () => {
      setError("");
      setResult(null);

      try {
        const response = await fetch("/api/admin/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const responseBody = await response.json().catch(() => null);

        if (!response.ok) {
          setError(
            getResponseError(responseBody) ?? `导入失败：${response.status}`,
          );
          return;
        }

        setResult(responseBody);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "导入请求失败。");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-lg border bg-background p-4 shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem_14rem]">
        <div className="grid gap-2">
          <Label htmlFor="sourceTitle">来源标题</Label>
          <Input
            id="sourceTitle"
            name="sourceTitle"
            placeholder="例如：间隔重复笔记"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="defaultDomain">默认领域</Label>
          <Input
            id="defaultDomain"
            name="defaultDomain"
            required
            placeholder="learning"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="defaultSubdomain">默认子领域</Label>
          <Input
            id="defaultSubdomain"
            name="defaultSubdomain"
            placeholder="memory"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="sourceMaterial">来源材料</Label>
        <Textarea
          id="sourceMaterial"
          name="sourceMaterial"
          required
          className="min-h-64 resize-y font-mono text-sm"
          placeholder="粘贴要结构化为知识项的材料..."
        />
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "处理中..." : "生成并保存"}
        </Button>
      </div>

      {result ? (
        <section className="grid gap-3 rounded-lg border border-success/25 bg-success/10 p-4">
          <div className="grid gap-1">
            <h2 className="text-base font-semibold text-success">导入完成</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              状态：{summary.statusLabel}。生成 {summary.generatedCount} 条，保存 {summary.savedCount} 条。
            </p>
          </div>
          {summary.errorCount > 0 ? (
            <p className="rounded-md border border-warning/30 bg-background/70 px-3 py-2 text-sm text-warning">
              有 {summary.errorCount} 个校验问题，请展开调试详情查看。
            </p>
          ) : null}
          {summary.importRunId ? (
            <p className="text-xs text-muted-foreground">
              导入批次：{summary.importRunId}
            </p>
          ) : null}
          <details className="rounded-lg border bg-background/80">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
              调试详情
            </summary>
            <pre className="max-h-96 overflow-auto border-t p-3 text-xs leading-5">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </section>
      ) : null}
    </form>
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

function getImportSummary(result: unknown) {
  const data = getRecord(getRecord(result)?.data) ?? getRecord(result);
  const importRun = getRecord(data?.importRun);
  const status = typeof data?.status === "string" ? data.status : "unknown";
  const generatedCount = numberValue(importRun?.generatedCount);
  const savedCount =
    numberValue(data?.savedCount) || numberValue(importRun?.savedCount);
  const errors = Array.isArray(data?.errors)
    ? data.errors
    : Array.isArray(importRun?.validationErrors)
      ? importRun.validationErrors
      : [];

  return {
    statusLabel: statusLabel(status),
    generatedCount,
    savedCount,
    errorCount: errors.length,
    importRunId: typeof importRun?.id === "string" ? importRun.id : "",
  };
}

function statusLabel(status: string) {
  if (status === "saved") {
    return "已保存";
  }

  if (status === "validation_failed") {
    return "校验未通过";
  }

  if (status === "ai_failed") {
    return "AI 生成失败";
  }

  return status;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : undefined;
}
