import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateAiMemoryHookDraft } from "@/server/services/knowledge-item-service";

describe("memory hook AI drafts", () => {
  it("generates a short self-reminder from knowledge item context", async () => {
    const fetcher = async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));

      assert.match(JSON.stringify(body.messages), /主要使用中文/);
      assert.match(JSON.stringify(body.messages), /用第一人称提醒自己/);
      assert.match(JSON.stringify(body.messages), /贝叶斯公式/);

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "先找条件和目标，再决定是否反推概率。",
              },
            },
          ],
        }),
        { status: 200 },
      );
    };

    const draft = await generateAiMemoryHookDraft({
      env: {
        AI_PROVIDER: "deepseek",
        AI_API_KEY: "deepseek-key",
        AI_MODEL: "deepseek-chat",
      },
      fetcher,
      knowledgeItem: {
        title: "贝叶斯公式",
        summary: "贝叶斯公式用于从结果反推原因概率。",
        body: "P(A|B)=P(B|A)P(A)/P(B)。",
      },
    });

    assert.equal(draft, "先找条件和目标，再决定是否反推概率。");
  });

  it("returns null when AI cannot produce a draft", async () => {
    const draft = await generateAiMemoryHookDraft({
      env: { AI_PROVIDER: "mock" },
      knowledgeItem: {
        title: "线性方程",
        summary: "未知数最高次数为一。",
        body: "ax+b=0。",
      },
    });

    assert.equal(draft, null);
  });
});
