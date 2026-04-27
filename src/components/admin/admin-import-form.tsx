"use client";

import { FormEvent, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ImportResult = unknown;

export function AdminImportForm() {
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult>(null);
  const [isPending, startTransition] = useTransition();

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
            required
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
        <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs leading-5">
          {JSON.stringify(result, null, 2)}
        </pre>
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
