import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  collectGeneratedImportSlugs,
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

  it("rejects missing source material and domain", () => {
    assert.throws(
      () => normalizeAdminImportRequest({ sourceMaterial: "", defaultDomain: "" }),
      /素材和默认领域不能为空/,
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
});
