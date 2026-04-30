import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type MarkdownInline =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "strong"; children: MarkdownInline[] }
  | { type: "emphasis"; children: MarkdownInline[] }
  | { type: "link"; href: string; children: MarkdownInline[] };

export type MarkdownBlock =
  | { type: "paragraph"; children: MarkdownInline[] }
  | { type: "heading"; level: number; children: MarkdownInline[] }
  | { type: "unordered-list"; items: MarkdownInline[][] }
  | { type: "ordered-list"; items: Array<{ index: number; children: MarkdownInline[] }> }
  | { type: "blockquote"; children: MarkdownInline[] }
  | { type: "code"; language: string | null; content: string };

export function MarkdownMessage({
  className,
  content,
}: {
  className?: string;
  content: string;
}) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <div className={cn("grid gap-2 whitespace-normal break-words", className)}>
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
}

export function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const codeFence = line.match(/^```([\w-]+)?\s*$/);
    if (codeFence) {
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({
        type: "code",
        language: codeFence[1] ?? null,
        content: codeLines.join("\n"),
      });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        children: parseMarkdownInlines(heading[2].trim()),
      });
      index += 1;
      continue;
    }

    const unorderedItems = collectList(lines, index, /^[-*]\s+(.+)$/);
    if (unorderedItems) {
      blocks.push({
        type: "unordered-list",
        items: unorderedItems.items.map(parseMarkdownInlines),
      });
      index = unorderedItems.nextIndex;
      continue;
    }

    const orderedItems = collectOrderedList(lines, index);
    if (orderedItems) {
      blocks.push({
        type: "ordered-list",
        items: orderedItems.items.map((item) => ({
          index: item.index,
          children: parseMarkdownInlines(item.content),
        })),
      });
      index = orderedItems.nextIndex;
      continue;
    }

    const quote = line.match(/^>\s?(.+)$/);
    if (quote) {
      const quoteLines = [quote[1]];
      index += 1;

      while (index < lines.length) {
        const nextQuote = lines[index].match(/^>\s?(.+)$/);
        if (!nextQuote) {
          break;
        }

        quoteLines.push(nextQuote[1]);
        index += 1;
      }

      blocks.push({
        type: "blockquote",
        children: parseMarkdownInlines(quoteLines.join("\n")),
      });
      continue;
    }

    const paragraphLines = [line.trim()];
    index += 1;

    while (
      index < lines.length &&
      lines[index].trim() &&
      !isBlockStart(lines[index])
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push({
      type: "paragraph",
      children: parseMarkdownInlines(paragraphLines.join("\n")),
    });
  }

  return blocks;
}

export function parseMarkdownInlines(content: string): MarkdownInline[] {
  const inlines: MarkdownInline[] = [];
  let index = 0;

  while (index < content.length) {
    if (content.startsWith("`", index)) {
      const end = content.indexOf("`", index + 1);
      if (end > index + 1) {
        inlines.push({ type: "code", text: content.slice(index + 1, end) });
        index = end + 1;
        continue;
      }
    }

    if (content.startsWith("**", index)) {
      const end = content.indexOf("**", index + 2);
      if (end > index + 2) {
        inlines.push({
          type: "strong",
          children: parseMarkdownInlines(content.slice(index + 2, end)),
        });
        index = end + 2;
        continue;
      }
    }

    if (content.startsWith("*", index)) {
      const end = content.indexOf("*", index + 1);
      if (end > index + 1) {
        inlines.push({
          type: "emphasis",
          children: parseMarkdownInlines(content.slice(index + 1, end)),
        });
        index = end + 1;
        continue;
      }
    }

    if (content.startsWith("[", index)) {
      const labelEnd = content.indexOf("]", index + 1);
      const hrefStart = labelEnd >= 0 ? content.indexOf("(", labelEnd + 1) : -1;
      const hrefEnd = hrefStart >= 0 ? findLinkEnd(content, hrefStart) : -1;

      if (labelEnd > index + 1 && hrefStart === labelEnd + 1 && hrefEnd > hrefStart + 1) {
        const label = content.slice(index + 1, labelEnd);
        const href = content.slice(hrefStart + 1, hrefEnd).trim();
        const children = parseMarkdownInlines(label);

        if (isSafeHref(href)) {
          inlines.push({ type: "link", href, children });
        } else {
          inlines.push(...children);
        }

        index = hrefEnd + 1;
        continue;
      }
    }

    const nextSpecial = findNextSpecial(content, index + 1);
    inlines.push({
      type: "text",
      text: content.slice(index, nextSpecial),
    });
    index = nextSpecial;
  }

  return inlines;
}

function collectList(
  lines: string[],
  startIndex: number,
  pattern: RegExp,
): { items: string[]; nextIndex: number } | null {
  const items: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const match = lines[index].match(pattern);
    if (!match) {
      break;
    }

    items.push(match[1].trim());
    index += 1;
  }

  return items.length ? { items, nextIndex: index } : null;
}

function collectOrderedList(
  lines: string[],
  startIndex: number,
): { items: Array<{ index: number; content: string }>; nextIndex: number } | null {
  const items: Array<{ index: number; content: string }> = [];
  let index = startIndex;

  while (index < lines.length) {
    const match = lines[index].match(/^(\d+)[.)]\s+(.+)$/);
    if (!match) {
      break;
    }

    items.push({
      index: Number(match[1]),
      content: match[2].trim(),
    });
    index += 1;
  }

  return items.length ? { items, nextIndex: index } : null;
}

function findNextSpecial(content: string, startIndex: number) {
  const candidates = ["`", "*", "["]
    .map((character) => content.indexOf(character, startIndex))
    .filter((candidate) => candidate >= 0);

  return candidates.length ? Math.min(...candidates) : content.length;
}

function findLinkEnd(content: string, hrefStart: number) {
  let depth = 0;

  for (let index = hrefStart + 1; index < content.length; index += 1) {
    if (content[index] === "(") {
      depth += 1;
      continue;
    }

    if (content[index] !== ")") {
      continue;
    }

    if (depth === 0) {
      return index;
    }

    depth -= 1;
  }

  return -1;
}

function isBlockStart(line: string) {
  return /^```/.test(line) ||
    /^(#{1,6})\s+/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^(\d+)[.)]\s+/.test(line) ||
    /^>\s?/.test(line);
}

function isSafeHref(href: string) {
  return /^(https?:\/\/|mailto:|\/|#)/i.test(href);
}

function renderBlock(block: MarkdownBlock, index: number) {
  if (block.type === "heading") {
    const className = "mt-1 text-[0.95rem] font-semibold leading-6";

    return block.level <= 2 ? (
      <h3 key={index} className={className}>
        {renderInlines(block.children)}
      </h3>
    ) : (
      <h4 key={index} className={className}>
        {renderInlines(block.children)}
      </h4>
    );
  }

  if (block.type === "paragraph") {
    return (
      <p key={index} className="whitespace-pre-wrap">
        {renderInlines(block.children)}
      </p>
    );
  }

  if (block.type === "unordered-list") {
    return (
      <ul key={index} className="list-disc space-y-1 pl-4">
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>{renderInlines(item)}</li>
        ))}
      </ul>
    );
  }

  if (block.type === "ordered-list") {
    return (
      <ol key={index} className="list-decimal space-y-1 pl-4">
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex} value={item.index}>
            {renderInlines(item.children)}
          </li>
        ))}
      </ol>
    );
  }

  if (block.type === "blockquote") {
    return (
      <blockquote key={index} className="border-l-2 border-current/25 pl-3 text-current/80">
        {renderInlines(block.children)}
      </blockquote>
    );
  }

  return (
    <pre
      key={index}
      className="overflow-x-auto rounded-md bg-foreground/10 p-2 text-xs leading-5"
    >
      <code>{block.content}</code>
    </pre>
  );
}

function renderInlines(inlines: MarkdownInline[]): ReactNode {
  return inlines.map((inline, index) => {
    if (inline.type === "text") {
      return <Fragment key={index}>{inline.text}</Fragment>;
    }

    if (inline.type === "code") {
      return (
        <code key={index} className="rounded bg-foreground/10 px-1 py-0.5 text-[0.86em]">
          {inline.text}
        </code>
      );
    }

    if (inline.type === "strong") {
      return <strong key={index}>{renderInlines(inline.children)}</strong>;
    }

    if (inline.type === "emphasis") {
      return <em key={index}>{renderInlines(inline.children)}</em>;
    }

    return (
      <a
        key={index}
        href={inline.href}
        target={inline.href.startsWith("#") || inline.href.startsWith("/") ? undefined : "_blank"}
        rel={inline.href.startsWith("#") || inline.href.startsWith("/") ? undefined : "noreferrer"}
        className="font-medium underline underline-offset-2"
      >
        {renderInlines(inline.children)}
      </a>
    );
  });
}
