"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookMarked } from "lucide-react";

import { LEARNING_DOMAIN_COOKIE } from "@/lib/learning-domain";

export function LearningDomainSelector({
  currentDomain,
  domains,
}: {
  currentDomain: string;
  domains: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const options = domains.includes(currentDomain)
    ? domains
    : [currentDomain, ...domains];

  function handleChange(nextDomain: string) {
    const params = new URLSearchParams(searchParams);
    params.set("domain", nextDomain);
    document.cookie = `${LEARNING_DOMAIN_COOKIE}=${encodeURIComponent(
      nextDomain,
    )}; path=/; max-age=31536000; samesite=lax`;
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <label className="flex min-h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm">
      <BookMarked data-icon="inline-start" className="text-muted-foreground" />
      <span className="whitespace-nowrap text-muted-foreground">知识域</span>
      <select
        aria-label="当前知识域"
        className="min-w-28 bg-transparent font-medium outline-none"
        value={currentDomain}
        onChange={(event) => handleChange(event.target.value)}
      >
        {options.map((domain) => (
          <option key={domain} value={domain}>
            {domain}
          </option>
        ))}
      </select>
    </label>
  );
}
