import Link from "next/link";
import { ArrowRight, Bot, FileCheck2, FilePenLine } from "lucide-react";

import { PhaseShell } from "@/components/app/phase-shell";
import { ContentAssistWorkspace } from "@/components/content-assist/content-assist-workspace";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireCurrentLearner } from "@/server/auth/current-learner";
import { resolveLearningDomain } from "@/server/learning-domain";
import { listContentAssistWorkspace } from "@/server/services/content-assist-service";

export const dynamic = "force-dynamic";

export default async function ContentAssistPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  await requireCurrentLearner();
  const params = await searchParams;
  const learningDomain = await resolveLearningDomain(params.domain);
  const items = await listContentAssistWorkspace({
    domain: learningDomain.currentDomain,
  });
  const approvedCount = items.filter((item) => item.draftStatus === "approved").length;
  const draftCount = items.filter((item) => item.draftStatus === "draft").length;

  return (
    <PhaseShell
      activePath="/content-assist"
      eyebrow="Phase 8 / Internal AI Content Assist"
      title="内容辅助工作台"
      learningDomain={learningDomain}
    >
      <section className="grid gap-4 rounded-lg border bg-background p-6 shadow-sm md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>
              <Bot data-icon="inline-start" />
              内部能力
            </Badge>
            <Badge variant="secondary">
              <FilePenLine data-icon="inline-start" />
              草稿 {draftCount}
            </Badge>
            <Badge variant="outline">
              <FileCheck2 data-icon="inline-start" />
              已审核 {approvedCount}
            </Badge>
          </div>
        </div>

        <div className="flex items-end">
          <Link
            href={`/review?domain=${encodeURIComponent(learningDomain.currentDomain)}`}
            className={buttonVariants({ variant: "outline" })}
          >
            回到今日复习
            <ArrowRight data-icon="inline-end" />
          </Link>
        </div>
      </section>

      <ContentAssistWorkspace items={items} />
    </PhaseShell>
  );
}
