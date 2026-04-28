import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateAiReviewHint } from "@/server/services/review-service";

describe("review AI hints", () => {
  it("generates a short hint from review and knowledge item context", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const fetcher = async (_url: string | URL | Request, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)));

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "先判断题目里的关键条件，再选择公式。",
              },
            },
          ],
        }),
        { status: 200 },
      );
    };

    const hint = await generateAiReviewHint({
      env: {
        AI_PROVIDER: "deepseek",
        AI_API_KEY: "deepseek-key",
        AI_MODEL: "deepseek-chat",
      },
      fetcher,
      knowledgeItem: {
        title: "条件概率",
        summary: "条件概率描述在一个事件已经发生时另一个事件发生的概率。",
        body: "P(A|B)=P(A∩B)/P(B)。",
      },
      reviewItem: {
        prompt: "什么时候使用条件概率？",
        answer: "当题目给定某个条件已经发生时使用。",
        explanation: "关键是样本空间已经被条件缩小。",
      },
    });

    assert.equal(hint, "先判断题目里的关键条件，再选择公式。");
    assert.equal(requests.length, 1);
    assert.match(JSON.stringify(requests[0].messages), /主要使用中文/);
    assert.match(JSON.stringify(requests[0].messages), /不要直接泄露答案/);
    assert.match(JSON.stringify(requests[0].messages), /什么时候使用条件概率/);
  });

  it("returns null when AI is disabled or unavailable", async () => {
    const disabled = await generateAiReviewHint({
      env: { AI_PROVIDER: "mock" },
      knowledgeItem: {
        title: "线性方程",
        summary: "未知数最高次数为一。",
        body: "ax+b=0。",
      },
      reviewItem: {
        prompt: "什么是线性方程？",
        answer: "未知数最高次数为一的方程。",
        explanation: null,
      },
    });
    const failed = await generateAiReviewHint({
      env: { AI_PROVIDER: "deepseek", AI_API_KEY: "deepseek-key" },
      fetcher: async () => new Response("bad gateway", { status: 502 }),
      knowledgeItem: {
        title: "线性方程",
        summary: "未知数最高次数为一。",
        body: "ax+b=0。",
      },
      reviewItem: {
        prompt: "什么是线性方程？",
        answer: "未知数最高次数为一的方程。",
        explanation: null,
      },
    });

    assert.equal(disabled, null);
    assert.equal(failed, null);
  });
});
