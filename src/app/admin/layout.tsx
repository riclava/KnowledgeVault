import type { ReactNode } from "react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireAdminPage } from "@/server/admin/admin-auth";

const navItems = [
  { href: "/admin", label: "总览" },
  { href: "/admin/import", label: "AI 导入" },
  { href: "/admin/knowledge-items", label: "知识项" },
];

export default async function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const admin = await requireAdminPage();

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <div className="grid min-h-screen md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="border-b bg-background px-4 py-4 md:border-b-0 md:border-r">
          <div className="grid gap-5">
            <div className="grid gap-1">
              <Link href="/admin" className="text-base font-semibold">
                KnowledgeVault 管理后台
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                {admin.email ?? admin.displayName ?? "admin"}
              </p>
            </div>

            <nav className="flex gap-2 md:grid">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "justify-start rounded-md px-2 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="border-t pt-3">
              <Link
                href="/"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "w-fit justify-start rounded-md px-2 text-muted-foreground hover:text-foreground md:w-full",
                )}
              >
                返回主页
              </Link>
            </div>
          </div>
        </aside>

        <main className="min-w-0 px-4 py-5 md:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
