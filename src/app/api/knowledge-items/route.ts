import { NextResponse } from "next/server";

import { withAuthenticatedApi } from "@/server/auth/current-learner";
import {
  addCustomKnowledgeItem,
  getKnowledgeItemCatalog,
} from "@/server/services/knowledge-item-service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain") ?? undefined;
  const tag = url.searchParams.get("tag") ?? undefined;
  const query = url.searchParams.get("q") ?? undefined;
  const difficultyValue = url.searchParams.get("difficulty");
  const difficulty = difficultyValue ? Number(difficultyValue) : undefined;
  return withAuthenticatedApi(async (current) => {
    const catalog = await getKnowledgeItemCatalog({
      domain,
      tag,
      difficulty:
        typeof difficulty === "number" && Number.isFinite(difficulty)
          ? difficulty
          : undefined,
      query,
      userId: current.learner.id,
    });

    return NextResponse.json({
      data: catalog.knowledgeItems,
      meta: {
        filters: catalog.filters,
      },
    });
  });
}

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    title?: string;
    contentType?: string;
    renderPayload?: unknown;
    domain?: string;
    subdomain?: string;
    summary?: string;
    body?: string;
    deepDive?: string;
    useConditions?: string[];
    nonUseConditions?: string[];
    antiPatterns?: string[];
    typicalProblems?: string[];
    examples?: string[];
    difficulty?: number;
    tags?: string[];
    memoryHook?: string;
  };

  if (!payload.title?.trim() || !payload.renderPayload || !payload.summary?.trim()) {
    return NextResponse.json(
      {
        error: "title, renderPayload and summary are required",
      },
      { status: 400 },
    );
  }

  const title = payload.title.trim();
  const summary = payload.summary.trim();

  return withAuthenticatedApi(async (current) => {
    try {
      const knowledgeItem = await addCustomKnowledgeItem({
        userId: current.learner.id,
        input: {
          title,
          contentType: payload.contentType,
          renderPayload: payload.renderPayload,
          domain: payload.domain,
          subdomain: payload.subdomain,
          summary,
          body: payload.body,
          deepDive: payload.deepDive,
          useConditions: payload.useConditions,
          nonUseConditions: payload.nonUseConditions,
          antiPatterns: payload.antiPatterns,
          typicalProblems: payload.typicalProblems,
          examples: payload.examples,
          difficulty: payload.difficulty,
          tags: payload.tags,
          memoryHook: payload.memoryHook,
        },
      });
      return NextResponse.json(
        {
          data: knowledgeItem,
        },
        { status: 201 },
      );
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Failed to create knowledge item",
        },
        { status: 400 },
      );
    }
  });
}
