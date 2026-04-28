import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
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
      }),
      {
        mode: "save",
        importRunId: "import_123",
      },
    );
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
});

function readText(path: string) {
  return readFileSync(path, "utf8");
}
