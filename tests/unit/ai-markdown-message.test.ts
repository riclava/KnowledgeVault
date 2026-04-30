import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseMarkdownBlocks,
  parseMarkdownInlines,
} from "@/components/ai/markdown-message";

describe("AI chat markdown message rendering", () => {
  it("parses common markdown blocks without treating raw HTML as markup", () => {
    const blocks = parseMarkdownBlocks(
      [
        "## 复习建议",
        "",
        "- **先回忆**核心概念",
        "- 再看例子",
        "",
        "```ts",
        "const ok = true;",
        "```",
        "",
        "<script>alert(1)</script>",
      ].join("\n"),
    );

    assert.equal(blocks[0].type, "heading");
    assert.equal(blocks[0].level, 2);
    assert.equal(blocks[1].type, "unordered-list");
    assert.equal(blocks[2].type, "code");
    assert.equal(blocks[2].language, "ts");
    assert.equal(blocks[2].content, "const ok = true;");
    assert.equal(blocks[3].type, "paragraph");
    assert.deepEqual(blocks[3].children, [
      { type: "text", text: "<script>alert(1)</script>" },
    ]);
  });

  it("parses inline code, emphasis, strong text, and safe links", () => {
    const inlines = parseMarkdownInlines(
      "用 `recall` 做 **主动回忆**，参考 [文档](https://example.com)，忽略 [坏链接](javascript:alert(1))。",
    );

    assert.deepEqual(inlines, [
      { type: "text", text: "用 " },
      { type: "code", text: "recall" },
      { type: "text", text: " 做 " },
      {
        type: "strong",
        children: [{ type: "text", text: "主动回忆" }],
      },
      { type: "text", text: "，参考 " },
      {
        type: "link",
        href: "https://example.com",
        children: [{ type: "text", text: "文档" }],
      },
      { type: "text", text: "，忽略 " },
      { type: "text", text: "坏链接" },
      { type: "text", text: "。" },
    ]);
  });
});
