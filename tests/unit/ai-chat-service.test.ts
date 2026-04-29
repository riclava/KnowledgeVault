import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  generateAiChatReply,
  normalizeAiChatRequest,
} from "@/server/services/ai-chat-service";

describe("popup AI chat service", () => {
  it("normalizes message, selected text, and recent history", () => {
    const request = normalizeAiChatRequest({
      message: "  帮我解释一下  ",
      selectedText: "  这是一段选中的材料  ",
      history: [
        { role: "assistant", content: "旧回复" },
        { role: "user", content: "旧问题" },
        { role: "system", content: "非法角色" },
        { role: "user", content: "   " },
      ],
    });

    assert.equal(request.message, "帮我解释一下");
    assert.equal(request.selectedText, "这是一段选中的材料");
    assert.deepEqual(request.history, [
      { role: "assistant", content: "旧回复" },
      { role: "user", content: "旧问题" },
    ]);
  });

  it("rejects requests without a question or selected text", () => {
    assert.throws(
      () => normalizeAiChatRequest({ message: " ", selectedText: " " }),
      /请输入问题或先选中一段文本/,
    );
  });

  it("trims long message, selected text, and history content", () => {
    const request = normalizeAiChatRequest({
      message: "问".repeat(5000),
      selectedText: "文".repeat(9000),
      history: Array.from({ length: 12 }, (_, index) => ({
        role: index % 2 === 0 ? "user" : "assistant",
        content: `第 ${index} 轮 ${"长".repeat(3000)}`,
      })),
    });

    assert.equal(request.message.length, 2000);
    assert.equal(request.selectedText?.length, 4000);
    assert.equal(request.history.length, 6);
    assert.ok(request.history.every((entry) => entry.content.length <= 1200));
    assert.match(request.message, /…$/);
    assert.match(request.selectedText ?? "", /…$/);
  });

  it("builds a Chinese learning-assistant prompt with selected text", async () => {
    const requests: Array<{
      body: { messages: Array<{ role: string; content: string }> };
    }> = [];
    const fetcher = async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push({ body: JSON.parse(String(init?.body)) });

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "这是拆解后的解释。" } }],
        }),
        { status: 200 },
      );
    };

    const reply = await generateAiChatReply({
      env: {
        AI_PROVIDER: "deepseek",
        AI_API_KEY: "deepseek-key",
        AI_MODEL: "deepseek-chat",
      },
      fetcher,
      input: {
        message: "这段话是什么意思？",
        selectedText: "间隔重复可以降低遗忘速度。",
        history: [{ role: "assistant", content: "上一轮回复" }],
      },
    });

    assert.equal(reply.message, "这是拆解后的解释。");
    const serialized = JSON.stringify(requests[0].body.messages);
    assert.match(serialized, /KnowledgeVault 的学习助手/);
    assert.match(serialized, /主要使用中文/);
    assert.match(serialized, /间隔重复可以降低遗忘速度/);
    assert.match(serialized, /这段话是什么意思/);
    assert.match(serialized, /上一轮回复/);
  });

  it("returns a deterministic mock response for local development", async () => {
    const reply = await generateAiChatReply({
      env: { AI_PROVIDER: "mock" },
      input: {
        message: "怎么复习？",
        selectedText: "主动回忆比反复阅读更可靠。",
        history: [],
      },
    });

    assert.match(reply.message, /本地模拟回复/);
    assert.match(reply.message, /主动回忆/);
  });
});
