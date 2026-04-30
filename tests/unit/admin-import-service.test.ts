import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  buildAdminImportDedupeWarnings,
  collectGeneratedImportSlugs,
  normalizeAdminImportActionRequest,
  normalizeAdminImportRequest,
} from "@/server/admin/admin-import-service";

describe("admin import service", () => {
  it("normalizes import request body", () => {
    assert.deepEqual(
      normalizeAdminImportRequest({
        sourceMaterial: "  lesson text  ",
        sourceTitle: "  Lesson  ",
        defaultDomain: " 数学 ",
        defaultSubdomain: " 代数 ",
        preferredContentTypes: ["math_formula", "plain_text"],
      }),
      {
        sourceMaterial: "lesson text",
        sourceTitle: "Lesson",
        defaultDomain: "数学",
        defaultSubdomain: "代数",
        preferredContentTypes: ["math_formula", "plain_text"],
      },
    );
  });

  it("lets AI infer the domain when the admin only provides material", () => {
    assert.deepEqual(
      normalizeAdminImportRequest({
        sourceMaterial: "  lesson text  ",
        defaultDomain: "",
      }),
      {
        sourceMaterial: "lesson text",
      },
    );
  });

  it("rejects missing source material", () => {
    assert.throws(
      () => normalizeAdminImportRequest({ sourceMaterial: "", defaultDomain: "" }),
      /素材不能为空/,
    );
  });

  it("trims preferred content types and drops blanks", () => {
    assert.deepEqual(
      normalizeAdminImportRequest({
        sourceMaterial: "lesson text",
        defaultDomain: "数学",
        preferredContentTypes: [
          " math_formula ",
          "",
          "  ",
          "plain_text",
          42,
        ],
      }),
      {
        sourceMaterial: "lesson text",
        defaultDomain: "数学",
        preferredContentTypes: ["math_formula", "plain_text"],
      },
    );
  });

  it("collects generated slugs without throwing on malformed entries", () => {
    assert.deepEqual(
      collectGeneratedImportSlugs({
        items: [null, { slug: "alpha" }, { slug: 42 }, { slug: "  beta  " }],
        relations: [
          null,
          { fromSlug: "alpha", toSlug: "gamma" },
          { fromSlug: 1, toSlug: "  delta  " },
        ],
      }),
      ["alpha", "beta", "gamma", "delta"],
    );
  });

  it("normalizes two-step preview and save import actions", () => {
    assert.deepEqual(
      normalizeAdminImportActionRequest({
        mode: "preview",
        sourceMaterial: "  lesson text  ",
        defaultDomain: " 数学 ",
      }),
      {
        mode: "preview",
        input: {
          sourceMaterial: "lesson text",
          defaultDomain: "数学",
        },
      },
    );

    assert.deepEqual(
      normalizeAdminImportActionRequest({
        mode: "save",
        importRunId: " import_123 ",
        allowDedupeOverride: true,
      }),
      {
        mode: "save",
        importRunId: "import_123",
        allowDedupeOverride: true,
      },
    );
  });

  it("keeps an edited preview batch on save actions", () => {
    const action = normalizeAdminImportActionRequest({
      mode: "save",
      importRunId: " import_123 ",
      batch: {
        defaultDomain: "数学",
        items: [
          {
            slug: "new-item",
            title: "New Item",
            contentType: "plain_text",
            renderPayload: { text: "New" },
            domain: " 几何 ",
            subdomain: " 三角形 ",
            summary: "Summary",
            body: "Body",
            tags: [" angle "],
            difficulty: 2,
            questions: [
              {
                type: "recall",
                prompt: "Q",
                answer: "A",
                difficulty: 2,
              },
            ],
          },
        ],
        relations: [],
      },
    });

    assert.equal(action.mode, "save");
    assert.equal(action.importRunId, "import_123");
    assert.equal(action.batch?.items[0]?.domain, "几何");
    assert.equal(action.batch?.items[0]?.subdomain, "三角形");
  });

  it("requires a preview import run id before saving", () => {
    assert.throws(
      () => normalizeAdminImportActionRequest({ mode: "save", importRunId: "" }),
      /预览批次不能为空/,
    );
  });

  it("keeps previewed as an API status instead of a Prisma enum status", () => {
    const service = readText("src/server/admin/admin-import-service.ts");
    const repository = readText("src/server/admin/admin-import-repository.ts");

    assert.match(service, /status: "previewed" as const/);
    assert.match(service, /status: "validation_failed"/);
    assert.doesNotMatch(repository, /"previewed" \|/);
    assert.doesNotMatch(repository, /status: "previewed"/);
  });

  it("stores normalized AI output for preview rendering", () => {
    const service = readText("src/server/admin/admin-import-service.ts");

    assert.match(service, /aiOutput: validation\.batch/);
  });

  it("builds dedupe warnings against public knowledge without flagging same-slug updates", () => {
    const warnings = buildAdminImportDedupeWarnings({
      batch: {
        defaultDomain: "数学",
        items: [
          {
            slug: "quadratic-formula-import",
            title: "一元二次方程求根公式",
            contentType: "plain_text",
            renderPayload: { text: "一元二次方程求根公式" },
            domain: "数学",
            subdomain: "代数",
            summary: "用判别式和求根公式解一元二次方程。",
            body: "一元二次方程 ax^2+bx+c=0 可以用求根公式和判别式求解。",
            tags: ["方程", "判别式"],
            difficulty: 2,
            questions: [],
          },
          {
            slug: "linear-equation",
            title: "一次方程",
            contentType: "plain_text",
            renderPayload: { text: "一次方程" },
            domain: "数学",
            subdomain: "代数",
            summary: "一次方程的移项求解。",
            body: "一次方程可以通过移项和合并同类项求解。",
            tags: [],
            difficulty: 1,
            questions: [],
          },
        ],
        relations: [],
      },
      existingItems: [
        {
          id: "existing-1",
          slug: "quadratic-formula",
          title: "一元二次方程求根公式",
          contentType: "plain_text",
          domain: "数学",
          subdomain: "代数",
          summary: "用判别式和求根公式解一元二次方程。",
          body: "一元二次方程 ax^2+bx+c=0 可以用求根公式和判别式求解。",
          tags: ["方程", "判别式"],
        },
        {
          id: "existing-2",
          slug: "linear-equation",
          title: "一次方程",
          contentType: "plain_text",
          domain: "数学",
          subdomain: "代数",
          summary: "一次方程的移项求解。",
          body: "一次方程可以通过移项和合并同类项求解。",
          tags: [],
        },
      ],
    });

    assert.equal(warnings.length, 1);
    assert.equal(warnings[0]?.generatedSlug, "quadratic-formula-import");
    assert.equal(warnings[0]?.existingItem.slug, "quadratic-formula");
    assert.ok((warnings[0]?.score ?? 0) >= 0.55);
  });
});

function readText(path: string) {
  return readFileSync(path, "utf8");
}
