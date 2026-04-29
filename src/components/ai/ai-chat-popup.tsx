"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Bot,
  Loader2,
  MessageCircle,
  RefreshCcw,
  Send,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  data?: {
    message?: string;
  };
  error?: string;
};

export function AiChatPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ block: "end" });
    }
  }, [isOpen, messages, isPending]);

  function openPanel() {
    setSelectedText(readSelectedText());
    setIsOpen(true);
  }

  function refreshSelectedText() {
    setSelectedText(readSelectedText());
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = draft.trim();
    const context = selectedText.trim();

    if (!message && !context) {
      setError("请输入问题，或先选中页面上的一段文字。");
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message || "请帮我解释选中的内容。",
    };
    const history = messages.slice(-6).map(({ role, content }) => ({
      role,
      content,
    }));

    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setError(null);
    setIsPending(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          history,
          message,
          selectedText: context,
        }),
      });
      const payload = (await response.json().catch(() => null)) as ChatResponse | null;

      if (!response.ok || !payload?.data?.message) {
        throw new Error(payload?.error ?? `AI 助手请求失败：${response.status}`);
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: payload.data!.message!,
        },
      ]);
    } catch (caught) {
      setDraft(message);
      setError(caught instanceof Error ? caught.message : "AI 助手暂时不可用。");
    } finally {
      setIsPending(false);
    }
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-40 md:bottom-6 md:right-6">
        <Button
          type="button"
          size="icon-lg"
          className="rounded-full shadow-lg"
          aria-label="打开 AI 学习助手"
          onClick={openPanel}
        >
          <MessageCircle />
        </Button>
      </div>
    );
  }

  return (
    <section
      className="fixed inset-x-3 bottom-3 z-40 flex max-h-[min(42rem,calc(100svh-1.5rem))] flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-2xl sm:left-auto sm:right-5 sm:w-[24rem] md:bottom-5"
      aria-label="AI 学习助手"
    >
      <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Bot data-icon="inline-start" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">AI 学习助手</h2>
            <p className="truncate text-xs text-muted-foreground">
              解释、拆解、举例和生成练习
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="关闭 AI 学习助手"
          onClick={() => setIsOpen(false)}
        >
          <X />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        {selectedText ? (
          <div className="rounded-md border bg-muted/40 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">选中文本</p>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={refreshSelectedText}
              >
                <RefreshCcw data-icon="inline-start" />
                使用选中文字
              </Button>
            </div>
            <p className="line-clamp-4 text-xs leading-5">{selectedText}</p>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit bg-background"
            onClick={refreshSelectedText}
          >
            <RefreshCcw data-icon="inline-start" />
            使用选中文字
          </Button>
        )}

        {messages.length === 0 ? (
          <div className="rounded-md border border-dashed bg-background px-3 py-4 text-sm leading-6 text-muted-foreground">
            选中页面文字或直接提问，我会帮你拆解成更容易复习的说法。
          </div>
        ) : (
          <div className="grid gap-3">
            {messages.map((message) => (
              <article
                key={message.id}
                className={cn(
                  "max-w-[88%] rounded-lg px-3 py-2 text-sm leading-6",
                  message.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto border bg-background",
                )}
              >
                {message.content}
              </article>
            ))}
          </div>
        )}

        {isPending ? (
          <div className="mr-auto flex max-w-[88%] items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">
            <Loader2 data-icon="inline-start" className="animate-spin" />
            正在思考...
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <form className="grid gap-2 border-t bg-background p-3" onSubmit={handleSubmit}>
        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive">
            {error}
          </p>
        ) : null}
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={selectedText ? "围绕选中文本提问..." : "输入你的问题..."}
          className="max-h-32 min-h-20 resize-none bg-background text-sm"
          disabled={isPending}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">本次会话临时保留</p>
          <Button type="submit" size="sm" disabled={isPending || (!draft.trim() && !selectedText.trim())}>
            {isPending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Send data-icon="inline-start" />
            )}
            发送
          </Button>
        </div>
      </form>
    </section>
  );
}

function readSelectedText() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.getSelection()?.toString().trim() ?? "";
}
