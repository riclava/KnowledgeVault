export type KnowledgeDedupeScoredItem = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  contentType: string;
  tags: string[];
};

export type KnowledgeDedupeReason = {
  kind: string;
  score: number;
  detail: string;
};

export type KnowledgeDedupePair = {
  itemIds: [string, string];
  score: number;
  reasons: KnowledgeDedupeReason[];
};

export type KnowledgeDedupeGroup = {
  itemIds: string[];
  score: number;
  reasons: KnowledgeDedupeReason[];
};

const TOKEN_PATTERN = /[\p{Script=Han}]|[a-z0-9]+/gu;

export function scoreKnowledgeDedupePair(
  first: KnowledgeDedupeScoredItem,
  second: KnowledgeDedupeScoredItem,
): KnowledgeDedupePair {
  const titleScore = diceSimilarity(tokens(first.title), tokens(second.title));
  const slugScore = jaccardSimilarity(slugTokens(first.slug), slugTokens(second.slug));
  const summaryScore = diceSimilarity(
    tokens(`${first.summary} ${first.body}`),
    tokens(`${second.summary} ${second.body}`),
  );
  const facetScore = jaccardSimilarity(facetTokens(first), facetTokens(second));
  const contentTypeScore = first.contentType === second.contentType ? 1 : 0;
  const weightedScore =
    titleScore * 0.34 +
    slugScore * 0.16 +
    summaryScore * 0.25 +
    facetScore * 0.2 +
    contentTypeScore * 0.05;
  const reasons = [
    reason("title", titleScore, "标题相似度"),
    reason("slug", slugScore, "slug token 重叠"),
    reason("text", summaryScore, "摘要和正文相似度"),
    reason("facets", facetScore, "标签重叠"),
    reason("contentType", contentTypeScore, "内容类型一致"),
  ].filter((entry) => entry.score > 0);

  return {
    itemIds: [first.id, second.id],
    score: roundScore(weightedScore),
    reasons,
  };
}

export function findKnowledgeDedupePairs(
  items: KnowledgeDedupeScoredItem[],
  threshold: number,
) {
  const pairs: KnowledgeDedupePair[] = [];

  for (let firstIndex = 0; firstIndex < items.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < items.length; secondIndex += 1) {
      const first = items[firstIndex];
      const second = items[secondIndex];

      if (!first || !second) {
        continue;
      }

      const pair = scoreKnowledgeDedupePair(first, second);

      if (pair.score >= threshold) {
        pairs.push(pair);
      }
    }
  }

  return pairs.sort((first, second) => second.score - first.score);
}

export function clusterKnowledgeDedupePairs(
  pairs: KnowledgeDedupePair[],
): KnowledgeDedupeGroup[] {
  const parent = new Map<string, string>();

  for (const pair of pairs) {
    const [firstId, secondId] = pair.itemIds;
    union(parent, firstId, secondId);
  }

  const itemIdsByRoot = new Map<string, Set<string>>();

  for (const pair of pairs) {
    for (const itemId of pair.itemIds) {
      const root = find(parent, itemId);
      const itemIds = itemIdsByRoot.get(root) ?? new Set<string>();
      itemIds.add(itemId);
      itemIdsByRoot.set(root, itemIds);
    }
  }

  return Array.from(itemIdsByRoot.values())
    .map((itemIds) => {
      const groupItemIds = Array.from(itemIds).sort();
      const groupPairs = pairs.filter((pair) =>
        groupItemIds.includes(pair.itemIds[0]) &&
        groupItemIds.includes(pair.itemIds[1]),
      );
      const reasonsByKey = new Map<string, KnowledgeDedupeReason>();

      for (const pair of groupPairs) {
        for (const pairReason of pair.reasons) {
          const existing = reasonsByKey.get(pairReason.kind);

          if (!existing || pairReason.score > existing.score) {
            reasonsByKey.set(pairReason.kind, pairReason);
          }
        }
      }

      return {
        itemIds: groupItemIds,
        score: roundScore(
          average(groupPairs.map((pair) => pair.score)),
        ),
        reasons: Array.from(reasonsByKey.values()).sort(
          (first, second) => second.score - first.score,
        ),
      };
    })
    .sort((first, second) => first.itemIds[0].localeCompare(second.itemIds[0]));
}

function tokens(value: string) {
  return new Set(value.toLowerCase().match(TOKEN_PATTERN) ?? []);
}

function slugTokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .map((token) => token.trim())
      .filter(Boolean),
  );
}

function facetTokens(item: KnowledgeDedupeScoredItem) {
  return tokens(
    [
      ...item.tags,
    ].join(" "),
  );
}

function diceSimilarity(first: Set<string>, second: Set<string>) {
  if (first.size === 0 || second.size === 0) {
    return 0;
  }

  return (2 * intersectionSize(first, second)) / (first.size + second.size);
}

function jaccardSimilarity(first: Set<string>, second: Set<string>) {
  if (first.size === 0 || second.size === 0) {
    return 0;
  }

  return intersectionSize(first, second) / unionSize(first, second);
}

function intersectionSize(first: Set<string>, second: Set<string>) {
  let count = 0;

  for (const token of first) {
    if (second.has(token)) {
      count += 1;
    }
  }

  return count;
}

function unionSize(first: Set<string>, second: Set<string>) {
  return new Set([...first, ...second]).size;
}

function reason(kind: string, score: number, detail: string): KnowledgeDedupeReason {
  return {
    kind,
    score: roundScore(score),
    detail,
  };
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundScore(value: number) {
  return Math.round(value * 1000) / 1000;
}

function find(parent: Map<string, string>, itemId: string): string {
  const currentParent = parent.get(itemId);

  if (!currentParent) {
    parent.set(itemId, itemId);
    return itemId;
  }

  if (currentParent === itemId) {
    return itemId;
  }

  const root = find(parent, currentParent);
  parent.set(itemId, root);

  return root;
}

function union(parent: Map<string, string>, firstId: string, secondId: string) {
  const firstRoot = find(parent, firstId);
  const secondRoot = find(parent, secondId);

  if (firstRoot !== secondRoot) {
    parent.set(secondRoot, firstRoot);
  }
}
