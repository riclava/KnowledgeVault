import { cookies } from "next/headers";

import { LEARNING_DOMAIN_COOKIE } from "@/lib/learning-domain";
import { getKnowledgeItemDomains } from "@/server/services/knowledge-item-service";

export type LearningDomainContext = {
  currentDomain: string;
  domains: string[];
};

export async function resolveLearningDomain(
  requestedDomain?: string | null,
): Promise<LearningDomainContext> {
  const domains = await getKnowledgeItemDomains();
  const cookieStore = await cookies();
  const cookieDomain = decodeCookieValue(
    cookieStore.get(LEARNING_DOMAIN_COOKIE)?.value,
  );
  const requested = requestedDomain?.trim();

  if (requested && (domains.length === 0 || domains.includes(requested))) {
    return {
      currentDomain: requested,
      domains,
    };
  }

  if (cookieDomain && domains.includes(cookieDomain)) {
    return {
      currentDomain: cookieDomain,
      domains,
    };
  }

  return {
    currentDomain: domains[0] ?? "默认知识域",
    domains,
  };
}

function decodeCookieValue(value?: string) {
  if (!value) {
    return null;
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
