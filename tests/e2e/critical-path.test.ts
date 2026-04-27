import assert from "node:assert/strict";
import { describe, it } from "node:test";

const baseUrl = process.env.E2E_BASE_URL;
const authCookie = process.env.E2E_AUTH_COOKIE;
const maybeIt = baseUrl && authCookie ? it : it.skip;

describe("critical learning path", () => {
  maybeIt("walks diagnostic to review summary through API smoke checks", async () => {
    assert.ok(baseUrl);
    assert.ok(authCookie);

    const cookieJar = new Map<string, string>();
    cookieJar.set(authCookie.split("=")[0], authCookie);

    const request = async (path: string, init?: RequestInit) => {
      const response = await fetch(new URL(path, baseUrl), {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(cookieJar.size > 0
            ? { cookie: Array.from(cookieJar.values()).join("; ") }
            : {}),
          ...init?.headers,
        },
      });
      const setCookie = response.headers.get("set-cookie");

      if (setCookie) {
        const cookie = setCookie.split(";")[0];
        const [name] = cookie.split("=");
        cookieJar.set(name, cookie);
      }

      return response;
    };

    const diagnosticStart = await request("/api/diagnostic/start");
    assert.equal(diagnosticStart.status, 200);
    const diagnosticStartBody = (await diagnosticStart.json()) as {
      data: {
        domain: string;
        questions: Array<{
          id: string;
          knowledgeItemId: string;
        }>;
      };
    };
    assert.ok(diagnosticStartBody.data.questions.length > 0);

    const diagnosticSubmit = await request("/api/diagnostic/submit", {
      method: "POST",
      body: JSON.stringify({
        domain: diagnosticStartBody.data.domain,
        answers: diagnosticStartBody.data.questions.slice(0, 3).map((question) => ({
          reviewItemId: question.id,
          assessment: "none",
        })),
      }),
    });
    assert.equal(diagnosticSubmit.status, 200);

    const reviewToday = await request("/api/review/today");
    assert.equal(reviewToday.status, 200);
    const reviewTodayBody = (await reviewToday.json()) as {
      data: {
        sessionId: string | null;
        items: Array<{
          reviewItemId: string;
          knowledgeItemId: string;
        }>;
      };
    };
    assert.ok(reviewTodayBody.data.sessionId);
    assert.ok(reviewTodayBody.data.items.length > 0);

    const firstItem = reviewTodayBody.data.items[0];
    const hint = await request("/api/review/hint", {
      method: "POST",
      body: JSON.stringify({
        knowledgeItemId: firstItem.knowledgeItemId,
      }),
    });
    assert.equal(hint.status, 200);

    const submitReview = await request("/api/review/submit", {
      method: "POST",
      body: JSON.stringify({
        sessionId: reviewTodayBody.data.sessionId,
        reviewItemId: firstItem.reviewItemId,
        knowledgeItemId: firstItem.knowledgeItemId,
        result: "again",
        completed: true,
      }),
    });
    assert.equal(submitReview.status, 200);

    const defer = await request("/api/review/defer", {
      method: "POST",
      body: JSON.stringify({
        knowledgeItemId: firstItem.knowledgeItemId,
        minutes: 10,
      }),
    });
    assert.equal(defer.status, 200);

    const summary = await request("/api/stats/summary");
    assert.equal(summary.status, 200);
    const summaryBody = (await summary.json()) as {
      data: {
        advancedStats: {
          totalReviews: number;
        };
        learningRecommendations: Array<{
          href: string;
        }>;
      };
    };
    assert.ok(summaryBody.data.advancedStats.totalReviews >= 1);
    assert.ok(summaryBody.data.learningRecommendations.length > 0);

    const weakReview = await request("/api/review/today?mode=weak");
    assert.equal(weakReview.status, 200);
    const weakReviewBody = (await weakReview.json()) as {
      data: {
        mode: string;
        items: Array<unknown>;
      };
    };
    assert.equal(weakReviewBody.data.mode, "weak");
    assert.ok(weakReviewBody.data.items.length > 0);

    const customTitle = `测试自定义单词 ${Date.now()}`;
    const createKnowledgeItem = await request("/api/knowledge-items", {
      method: "POST",
      body: JSON.stringify({
        title: customTitle,
        contentType: "vocabulary",
        renderPayload: {
          term: "resilient",
          definition: "能够从困难中恢复的；有韧性的。",
          partOfSpeech: "adjective",
          examples: ["A resilient learner returns after mistakes."],
        },
        domain: "测试知识项",
        summary: "描述能从错误或压力中恢复的状态。",
        body: "resilient 强调经历冲击后仍能恢复和继续推进。",
        tags: ["test-custom", "vocabulary"],
        memoryHook: "re-silient，重新站起来。",
      }),
    });
    assert.equal(createKnowledgeItem.status, 201);
    const createKnowledgeItemBody = (await createKnowledgeItem.json()) as {
      data: {
        slug: string;
        reviewItemCount: number;
      };
    };
    assert.ok(createKnowledgeItemBody.data.slug);
    assert.equal(createKnowledgeItemBody.data.reviewItemCount, 3);
  });
});
