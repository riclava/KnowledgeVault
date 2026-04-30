import assert from "node:assert/strict";
import { describe, it } from "node:test";

const baseUrl = process.env.E2E_BASE_URL;
const accountEmail = process.env.E2E_EMAIL ?? "ricl@hyperits.com";
const accountPassword = process.env.E2E_PASSWORD ?? "12345678";
const maybeIt = baseUrl ? it : it.skip;

type ApiEnvelope<T> = {
  data: T;
};

type DiagnosticStartBody = ApiEnvelope<{
  domain: string;
  questions: Array<{
    id: string;
    knowledgeItemIds: string[];
  }>;
}>;

type ReviewTodayBody = ApiEnvelope<{
  sessionId: string | null;
  domain: string | null;
  mode: "today" | "weak";
  items: Array<{
    questionId: string;
    knowledgeItemId: string;
    answer: unknown;
  }>;
}>;

describe("critical learning path", () => {
  maybeIt("signs in with the default learner account and reviews current content", async () => {
    assert.ok(baseUrl);

    const client = new E2EClient(baseUrl);

    const signIn = await client.post("/api/auth/sign-in/email", {
      email: accountEmail,
      password: accountPassword,
    });
    const signInBody = await expectJson<{
      user: {
        email: string;
      };
    }>(signIn, "sign in");

    assert.equal(signInBody.user.email, accountEmail);
    assert.ok(client.hasCookies(), "sign in should set auth cookies");

    const e2eDomain = `端到端测试${Date.now()}`;
    const importPreview = await client.post("/api/import", {
      mode: "preview",
      sourceTitle: "端到端测试知识",
      sourceMaterial:
        "线性方程是未知数最高次数为一的方程。求解时保持等式两边平衡，并用逆运算隔离未知数。",
      defaultDomain: e2eDomain,
      defaultSubdomain: "自动化流程",
      preferredContentTypes: ["plain_text", "concept_card", "procedure"],
    });
    const importPreviewBody = await expectJson<ApiEnvelope<{
      status: "previewed";
      importRun: {
        id: string;
      };
      generatedCount: number;
    }>>(importPreview, "preview private import");

    assert.equal(importPreviewBody.data.status, "previewed");
    assert.ok(importPreviewBody.data.importRun.id);
    assert.ok(importPreviewBody.data.generatedCount > 0);

    const importSave = await client.post("/api/import", {
      mode: "save",
      importRunId: importPreviewBody.data.importRun.id,
    });
    const importSaveBody = await expectJson<ApiEnvelope<{
      status: "saved";
      savedCount: number;
    }>>(importSave, "save private import");

    assert.equal(importSaveBody.data.status, "saved");
    assert.ok(importSaveBody.data.savedCount > 0);

    const diagnosticStart = await client.get(
      `/api/diagnostic/start?domain=${encodeURIComponent(e2eDomain)}`,
    );
    const diagnosticStartBody = await expectJson<DiagnosticStartBody>(
      diagnosticStart,
      "start diagnostic",
    );

    assert.ok(diagnosticStartBody.data.domain);
    assert.equal(diagnosticStartBody.data.domain, e2eDomain);
    assert.ok(diagnosticStartBody.data.questions.length > 0);

    const diagnosticSubmit = await client.post("/api/diagnostic/submit", {
      domain: diagnosticStartBody.data.domain,
      answers: diagnosticStartBody.data.questions.slice(0, 3).map((question) => ({
        questionId: question.id,
        assessment: "none",
      })),
    });
    const diagnosticSubmitBody = await expectJson<ApiEnvelope<{
      weakKnowledgeItemIds: string[];
      reviewQueueKnowledgeItemIds: string[];
    }>>(diagnosticSubmit, "submit diagnostic");

    assert.ok(diagnosticSubmitBody.data.reviewQueueKnowledgeItemIds.length > 0);

    const reviewToday = await client.get(
      `/api/review/today?domain=${encodeURIComponent(diagnosticStartBody.data.domain)}`,
    );
    const reviewTodayBody = await expectJson<ReviewTodayBody>(
      reviewToday,
      "load today review",
    );

    assert.equal(reviewTodayBody.data.mode, "today");
    assert.ok(reviewTodayBody.data.sessionId);
    assert.ok(reviewTodayBody.data.items.length > 0);

    const firstItem = reviewTodayBody.data.items[0]!;

    const knowledgeDetail = await client.get(
      `/api/knowledge-items/${encodeURIComponent(firstItem.knowledgeItemId)}`,
    );
    const knowledgeDetailBody = await expectJson<ApiEnvelope<{
      id: string;
      title: string;
      questionCount: number;
    }>>(knowledgeDetail, "load knowledge detail");

    assert.equal(knowledgeDetailBody.data.id, firstItem.knowledgeItemId);
    assert.ok(knowledgeDetailBody.data.title);
    assert.ok(knowledgeDetailBody.data.questionCount > 0);

    const memoryHookContent = `e2e-${Date.now()}：先说核心区别，再看题目条件。`;
    const saveMemoryHook = await client.post(
      `/api/knowledge-items/${encodeURIComponent(firstItem.knowledgeItemId)}/memory-hooks`,
      {
        content: memoryHookContent,
      },
    );
    const saveMemoryHookBody = await expectJson<ApiEnvelope<{
      content: string;
    }>>(saveMemoryHook, "save memory hook", 201);

    assert.equal(saveMemoryHookBody.data.content, memoryHookContent);

    const hint = await client.post("/api/review/hint", {
      knowledgeItemId: firstItem.knowledgeItemId,
    });
    const hintBody = await expectJson<ApiEnvelope<{
      knowledgeItemId: string;
      content: string;
      source: string;
    }>>(hint, "load review hint");

    assert.equal(hintBody.data.knowledgeItemId, firstItem.knowledgeItemId);
    assert.equal(hintBody.data.content, memoryHookContent);
    assert.equal(hintBody.data.source, "memory_hook");

    const submitReview = await client.post("/api/review/submit", {
      sessionId: reviewTodayBody.data.sessionId,
      questionId: firstItem.questionId,
      knowledgeItemId: firstItem.knowledgeItemId,
      submittedAnswer: firstItem.answer,
      completed: true,
    });
    const submitReviewBody = await expectJson<ApiEnvelope<{
      knowledgeItemId: string;
      result: string;
    }>>(submitReview, "submit review");

    assert.equal(submitReviewBody.data.knowledgeItemId, firstItem.knowledgeItemId);
    assert.match(submitReviewBody.data.result, /^(again|hard|good|easy)$/);

    const defer = await client.post("/api/review/defer", {
      knowledgeItemId: firstItem.knowledgeItemId,
      minutes: 10,
    });
    const deferBody = await expectJson<ApiEnvelope<{
      knowledgeItemId: string;
      nextReviewAt: string;
    }>>(defer, "defer review");

    assert.equal(deferBody.data.knowledgeItemId, firstItem.knowledgeItemId);
    assert.ok(Date.parse(deferBody.data.nextReviewAt));

    const weakReview = await client.get(
      `/api/review/today?mode=weak&domain=${encodeURIComponent(diagnosticStartBody.data.domain)}`,
    );
    const weakReviewBody = await expectJson<ReviewTodayBody>(
      weakReview,
      "load weak review",
    );

    assert.equal(weakReviewBody.data.mode, "weak");
    assert.ok(weakReviewBody.data.items.length > 0);
  });
});

class E2EClient {
  private readonly cookieJar = new Map<string, string>();
  private readonly origin: string;

  constructor(private readonly baseUrl: string) {
    this.origin = authOriginFor(baseUrl);
  }

  hasCookies() {
    return this.cookieJar.size > 0;
  }

  get(path: string) {
    return this.request(path);
  }

  post(path: string, body: unknown) {
    return this.request(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  private async request(path: string, init: RequestInit = {}) {
    const response = await fetch(new URL(path, this.baseUrl), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Origin: this.origin,
        ...(this.cookieJar.size > 0 ? { Cookie: this.cookieHeader() } : {}),
        ...init.headers,
      },
    });

    this.storeCookies(response.headers);

    return response;
  }

  private cookieHeader() {
    return Array.from(this.cookieJar.values()).join("; ");
  }

  private storeCookies(headers: Headers) {
    for (const cookie of getSetCookies(headers)) {
      const cookiePair = cookie.split(";")[0]?.trim();

      if (!cookiePair) {
        continue;
      }

      const [name] = cookiePair.split("=");

      if (name) {
        this.cookieJar.set(name, cookiePair);
      }
    }
  }
}

async function expectJson<T>(
  response: Response,
  label: string,
  expectedStatus = 200,
): Promise<T> {
  const text = await response.text();

  assert.equal(
    response.status,
    expectedStatus,
    `${label} returned ${response.status}: ${text}`,
  );

  return JSON.parse(text) as T;
}

function getSetCookies(headers: Headers) {
  const headersWithGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies = headersWithGetSetCookie.getSetCookie?.();

  if (setCookies && setCookies.length > 0) {
    return setCookies;
  }

  const combined = headers.get("set-cookie");

  return combined ? splitCombinedSetCookieHeader(combined) : [];
}

function splitCombinedSetCookieHeader(value: string) {
  return value.split(/,(?=\s*[^;,=\s]+=[^;,]+)/g).map((cookie) => cookie.trim());
}

function authOriginFor(baseUrl: string) {
  const url = new URL(baseUrl);

  if (url.hostname === "127.0.0.1" || url.hostname === "::1") {
    url.hostname = "localhost";
  }

  return url.origin;
}
