import Link from "next/link";
import {
  Brain,
  ClipboardCheck,
  FlaskConical,
  Sparkles,
  Target,
} from "lucide-react";

import { AccountEntry } from "@/components/app/account-entry";
import { LearningDomainSelector } from "@/components/app/learning-domain-selector";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LearningDomainContext } from "@/server/learning-domain";

export type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: typeof Brain;
};

const navItems: NavItem[] = [
  {
    href: "/review",
    label: "今日复习",
    icon: ClipboardCheck,
    description: "直接开始今天该练的内容。",
  },
  {
    href: "/review?mode=weak",
    label: "补弱",
    icon: Target,
    description: "把 Again 和 Hard 的知识项拉回来。",
  },
  {
    href: "/diagnostic",
    label: "诊断",
    icon: Brain,
    description: "校准薄弱点并生成起始队列。",
  },
  {
    href: "/import",
    label: "添加知识",
    icon: Sparkles,
    description: "用 AI 把材料整理进我的知识库。",
  },
];

export function PhaseShell({
  activePath,
  eyebrow,
  title,
  description,
  density = "default",
  learningDomain,
  children,
}: {
  activePath: string;
  eyebrow: string;
  title: string;
  description?: string;
  density?: "default" | "compact";
  learningDomain?: LearningDomainContext;
  children: React.ReactNode;
}) {
  const homeHref = addLearningDomainToHref("/review", learningDomain?.currentDomain);
  const returnTo = addLearningDomainToHref(activePath || "/review", learningDomain?.currentDomain);

  return (
    <main className="min-h-svh bg-background">
      <header className="border-b bg-background/95">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-4 md:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <Link href={homeHref} className="flex w-fit items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <FlaskConical data-icon="inline-start" />
              </span>
              <span>
                <span className="block text-base font-semibold leading-none">
                  KnowledgeVault
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  今日复习优先
                </span>
              </span>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            {learningDomain ? (
              <LearningDomainSelector
                currentDomain={learningDomain.currentDomain}
                domains={learningDomain.domains}
              />
            ) : null}

            <nav aria-label="主任务" className="flex flex-wrap gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const href = addLearningDomainToHref(
                  item.href,
                  learningDomain?.currentDomain,
                );

                return (
                  <Link
                    key={item.href}
                    href={href}
                    aria-current={isActiveNavItem(activePath, item.href) ? "page" : undefined}
                    className={buttonVariants({
                      size: "sm",
                      variant: isActiveNavItem(activePath, item.href) ? "default" : "ghost",
                    })}
                  >
                    <Icon data-icon="inline-start" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <AccountEntry returnTo={returnTo} />
          </div>
        </div>
      </header>

      <div
        className={cn(
          "mx-auto flex w-full max-w-6xl flex-col px-5 md:px-8",
          density === "compact" ? "gap-5 py-5 md:py-6" : "gap-8 py-8 md:py-10",
        )}
      >
        <div
          className={cn(
            "border-b",
            "grid",
            density === "compact" ? "gap-3 pb-4" : "gap-5 pb-6",
          )}
        >
          <div
            className={cn(
              "flex min-w-0 flex-col",
              "max-w-4xl",
              density === "compact" ? "gap-2" : "gap-3",
            )}
          >
            <Badge variant="secondary" className="w-fit">
              {eyebrow}
            </Badge>
            <h1
              className={cn(
                "font-semibold tracking-tight",
                density === "compact" ? "text-2xl md:text-3xl" : "text-3xl md:text-4xl",
              )}
            >
              {title}
            </h1>
            {description ? (
              <p className="text-base leading-7 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        <div
          className={cn(
            "flex min-w-0 flex-col",
            density === "compact" ? "gap-5" : "gap-8",
          )}
        >
          {children}
        </div>
      </div>
    </main>
  );
}

function isActiveNavItem(activePath: string, href: string) {
  return activePath === href;
}

function addLearningDomainToHref(href: string, domain?: string) {
  if (!domain || href.startsWith("/knowledge-items") || href.startsWith("/account")) {
    return href;
  }

  const [pathname, search = ""] = href.split("?");
  const params = new URLSearchParams(search);
  params.set("domain", domain);
  const query = params.toString();

  return query ? `${pathname}?${query}` : pathname;
}
