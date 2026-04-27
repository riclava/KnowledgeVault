import Link from "next/link";
import {
  BookOpen,
  Brain,
  ChartNoAxesColumn,
  ClipboardCheck,
  Compass,
  FlaskConical,
  Orbit,
  Target,
} from "lucide-react";

import { AccountEntry } from "@/components/app/account-entry";
import { LearningDomainSelector } from "@/components/app/learning-domain-selector";
import { ToolsMenu } from "@/components/app/phase-tools-menu";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LearningDomainContext } from "@/server/learning-domain";

export type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: typeof Brain;
  group: "primary" | "tool";
};

const navItems: NavItem[] = [
  {
    href: "/review",
    label: "今日复习",
    icon: ClipboardCheck,
    description: "直接开始今天该练的内容。",
    group: "primary",
  },
  {
    href: "/review?mode=weak",
    label: "补弱",
    icon: Target,
    description: "把 Again 和 Hard 的知识项拉回来。",
    group: "primary",
  },
  {
    href: "/knowledge-items",
    label: "知识项库",
    icon: BookOpen,
    description: "查找、回看和按主题浏览知识项。",
    group: "primary",
  },
  {
    href: "/diagnostic",
    label: "诊断校准",
    icon: Brain,
    description: "重新判断薄弱点并更新起始队列。",
    group: "tool",
  },
  {
    href: "/summary",
    label: "复习总结",
    icon: ChartNoAxesColumn,
    description: "查看最近一轮训练结果和下一步建议。",
    group: "tool",
  },
  {
    href: "/paths",
    label: "学习路径",
    icon: Compass,
    description: "按知识域查看内容集和当前进度。",
    group: "tool",
  },
  {
    href: "/deep-dive",
    label: "理解训练",
    icon: Orbit,
    description: "用结构拆解和深层解释强化知识项理解。",
    group: "tool",
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
  const primaryItems = navItems.filter((item) => item.group === "primary");
  const toolItems = navItems.filter((item) => item.group === "tool");
  const activeTool = toolItems.find((item) => item.href === activePath);
  const ActiveToolIcon = activeTool?.icon;
  const hasHeaderAside = Boolean(activeTool);
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
              {primaryItems.map((item) => {
                const Icon = item.icon;
                const href = addLearningDomainToHref(
                  item.href,
                  learningDomain?.currentDomain,
                );

                return (
                  <Link
                    key={item.href}
                    href={href}
                    aria-current={activePath === item.href ? "page" : undefined}
                    className={buttonVariants({
                      size: "sm",
                      variant: activePath === item.href ? "default" : "ghost",
                    })}
                  >
                    <Icon data-icon="inline-start" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <ToolsMenu active={Boolean(activeTool)}>
              {toolItems.map((item) => (
                <PhaseLink
                  key={item.href}
                  href={addLearningDomainToHref(
                    item.href,
                    learningDomain?.currentDomain,
                  )}
                  active={activeTool?.href === item.href}
                  icon={item.icon}
                  label={item.label}
                  description={item.description}
                />
              ))}
            </ToolsMenu>
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
            hasHeaderAside
              ? "flex flex-col lg:flex-row lg:items-end lg:justify-between"
              : "grid",
            density === "compact" ? "gap-3 pb-4" : "gap-5 pb-6",
          )}
        >
          <div
            className={cn(
              "flex min-w-0 flex-col",
              hasHeaderAside ? "max-w-3xl" : "max-w-4xl",
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

          {activeTool ? (
            <div className="flex max-w-sm items-start gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
                {ActiveToolIcon ? <ActiveToolIcon data-icon="inline-start" /> : null}
              </span>
              <div className="min-w-0">
                <p className="font-medium">{activeTool.label}</p>
                <p className="mt-1 text-muted-foreground">{activeTool.description}</p>
              </div>
            </div>
          ) : null}
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

function PhaseLink({
  href,
  active,
  icon: Icon,
  label,
  description,
}: {
  href: string;
  active: boolean;
  icon: typeof Brain;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "grid gap-1 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/70 hover:text-foreground",
        active ? "bg-muted text-foreground" : "text-muted-foreground",
      )}
    >
      <span className="flex items-center gap-2 font-medium text-foreground">
        <Icon data-icon="inline-start" />
        {label}
      </span>
      <span className="text-xs leading-5 text-muted-foreground">{description}</span>
    </Link>
  );
}
