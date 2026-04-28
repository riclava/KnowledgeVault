"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookMarked } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  function handleChange(nextDomain: string | null) {
    if (!nextDomain || nextDomain === currentDomain) {
      return;
    }

    const params = new URLSearchParams(searchParams);
    params.set("domain", nextDomain);
    document.cookie = `${LEARNING_DOMAIN_COOKIE}=${encodeURIComponent(
      nextDomain,
    )}; path=/; max-age=31536000; samesite=lax`;
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex min-h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm">
      <BookMarked data-icon="inline-start" className="text-muted-foreground" />
      <span className="whitespace-nowrap text-muted-foreground">知识域</span>
      <Select value={currentDomain} onValueChange={handleChange}>
        <SelectTrigger
          aria-label="当前知识域"
          className="h-7 min-w-28 border-0 px-0 py-0 font-medium shadow-none focus-visible:border-transparent focus-visible:ring-0 data-[size=default]:h-7"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectGroup>
            {options.map((domain) => (
              <SelectItem key={domain} value={domain}>
                {domain}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
