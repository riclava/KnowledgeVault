import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeAdminImportBatch,
  validateAdminImportBatch,
} from "@/server/admin/admin-import-validation";
import type { AdminImportBatch } from "@/server/admin/admin-import-types";

const validBatch: AdminImportBatch = {
  sourceTitle: "Algebra notes",
  defaultDomain: "数学",
  items: [
    {
      slug: "linear-equation",
      title: "Linear Equation",
      contentType: "plain_text",
      renderPayload: { text: "A linear equation has degree one." },
      domain: "数学",
      subdomain: "代数",
      summary: "一次方程是未知数最高次数为一的方程。",
      body: "一次方程可以通过等式两边同做逆运算求解。",
      intuition: "把未知数隔离出来。",
      deepDive: "",
      useConditions: ["未知数最高次数为一"],
      nonUseConditions: ["含有二次项"],
      antiPatterns: ["移项后忘记变号"],
      typicalProblems: ["Solve 2x + 3 = 7"],
      examples: ["2x + 3 = 7 -> x = 2"],
      difficulty: 1,
      tags: [" algebra ", "equation", "algebra"],
      variables: [],
      reviewItems: [
        {
          type: "recall",
          prompt: "什么是一次方程？",
          answer: "未知数最高次数为一的方程。",
          explanation: "次数由未知数最高幂决定。",
          difficulty: 1,
        },
      ],
    },
  ],
  relations: [],
};

describe("admin import validation", () => {
  it("normalizes generated item fields", () => {
    const normalized = normalizeAdminImportBatch(validBatch);

    assert.equal(normalized.items[0].slug, "linear-equation");
    assert.deepEqual(normalized.items[0].tags, ["algebra", "equation"]);
    assert.equal(normalized.items[0].subdomain, "代数");
  });

  it("accepts a valid generated batch", () => {
    const result = validateAdminImportBatch(validBatch, new Set());

    assert.equal(result.ok, true);
    assert.equal(result.ok ? result.batch.items.length : 0, 1);
  });

  it("rejects variables with blank symbol or name", () => {
    const invalid: AdminImportBatch = {
      ...validBatch,
      items: [
        {
          ...validBatch.items[0],
          variables: [
            {
              symbol: " ",
              name: "",
              description: "coefficient",
            },
          ],
        },
      ],
    };

    const result = validateAdminImportBatch(invalid, new Set());

    assert.equal(result.ok, false);
    assert.deepEqual(
      result.ok ? [] : result.errors.map((error) => error.code),
      ["missing_item_field", "missing_item_field"],
    );
  });

  it("rejects malformed array fields without throwing", () => {
    const invalid = {
      ...validBatch,
      items: [
        {
          ...validBatch.items[0],
          tags: ["ok", 123],
        },
      ],
    } as unknown as AdminImportBatch;
    let result: ReturnType<typeof validateAdminImportBatch> | undefined;

    assert.doesNotThrow(() => {
      result = validateAdminImportBatch(invalid, new Set());
    });
    assert.equal(result?.ok, false);
    assert.deepEqual(
      result?.ok ? [] : result?.errors.map((error) => error.code),
      ["invalid_array_field"],
    );
  });

  it("rejects malformed top-level items without throwing", () => {
    const invalid = {
      ...validBatch,
      items: "not array",
    } as unknown as AdminImportBatch;
    let result: ReturnType<typeof validateAdminImportBatch> | undefined;

    assert.doesNotThrow(() => {
      result = validateAdminImportBatch(invalid, new Set());
    });
    assert.equal(result?.ok, false);
    assert.equal(
      result?.ok
        ? false
        : result?.errors.some((error) => error.code === "invalid_array_field"),
      true,
    );
  });

  it("rejects malformed item variables without throwing", () => {
    const invalid = {
      ...validBatch,
      items: [
        {
          ...validBatch.items[0],
          variables: null,
        },
      ],
    } as unknown as AdminImportBatch;
    let result: ReturnType<typeof validateAdminImportBatch> | undefined;

    assert.doesNotThrow(() => {
      result = validateAdminImportBatch(invalid, new Set());
    });
    assert.equal(result?.ok, false);
    assert.equal(
      result?.ok
        ? false
        : result?.errors.some((error) => error.code === "invalid_array_field"),
      true,
    );
  });

  it("rejects malformed item review items without throwing", () => {
    const invalid = {
      ...validBatch,
      items: [
        {
          ...validBatch.items[0],
          reviewItems: "not array",
        },
      ],
    } as unknown as AdminImportBatch;
    let result: ReturnType<typeof validateAdminImportBatch> | undefined;

    assert.doesNotThrow(() => {
      result = validateAdminImportBatch(invalid, new Set());
    });
    assert.equal(result?.ok, false);
    assert.equal(
      result?.ok
        ? false
        : result?.errors.some((error) => error.code === "invalid_array_field"),
      true,
    );
  });

  it("rejects null item elements without throwing", () => {
    const invalid = {
      ...validBatch,
      items: [null],
    } as unknown as AdminImportBatch;
    let result: ReturnType<typeof validateAdminImportBatch> | undefined;

    assert.doesNotThrow(() => {
      result = validateAdminImportBatch(invalid, new Set());
    });
    assert.equal(result?.ok, false);
    assert.equal(
      result?.ok
        ? false
        : result?.errors.some((error) => error.code === "invalid_array_field"),
      true,
    );
  });

  it("rejects null relation elements without throwing", () => {
    const invalid = {
      ...validBatch,
      relations: [null],
    } as unknown as AdminImportBatch;
    let result: ReturnType<typeof validateAdminImportBatch> | undefined;

    assert.doesNotThrow(() => {
      result = validateAdminImportBatch(invalid, new Set());
    });
    assert.equal(result?.ok, false);
    assert.equal(
      result?.ok
        ? false
        : result?.errors.some((error) => error.code === "invalid_array_field"),
      true,
    );
  });

  it("rejects null variable elements without throwing", () => {
    const invalid = {
      ...validBatch,
      items: [
        {
          ...validBatch.items[0],
          variables: [null],
        },
      ],
    } as unknown as AdminImportBatch;
    let result: ReturnType<typeof validateAdminImportBatch> | undefined;

    assert.doesNotThrow(() => {
      result = validateAdminImportBatch(invalid, new Set());
    });
    assert.equal(result?.ok, false);
    assert.equal(
      result?.ok
        ? false
        : result?.errors.some((error) => error.code === "invalid_array_field"),
      true,
    );
  });

  it("rejects null review item elements without throwing", () => {
    const invalid = {
      ...validBatch,
      items: [
        {
          ...validBatch.items[0],
          reviewItems: [null],
        },
      ],
    } as unknown as AdminImportBatch;
    let result: ReturnType<typeof validateAdminImportBatch> | undefined;

    assert.doesNotThrow(() => {
      result = validateAdminImportBatch(invalid, new Set());
    });
    assert.equal(result?.ok, false);
    assert.equal(
      result?.ok
        ? false
        : result?.errors.some((error) => error.code === "invalid_array_field"),
      true,
    );
  });

  it("rejects duplicate slugs and missing relation endpoints", () => {
    const invalid: AdminImportBatch = {
      ...validBatch,
      items: [validBatch.items[0], { ...validBatch.items[0], title: "Duplicate" }],
      relations: [
        {
          fromSlug: "linear-equation",
          toSlug: "missing-target",
          relationType: "related",
          note: "",
        },
      ],
    };

    const result = validateAdminImportBatch(invalid, new Set());

    assert.equal(result.ok, false);
    assert.deepEqual(
      result.ok ? [] : result.errors.map((error) => error.code),
      ["duplicate_slug", "unknown_relation_target"],
    );
  });
});
