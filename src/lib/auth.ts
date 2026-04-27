import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "@/lib/db/prisma";

const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;

function getAuthBaseUrl() {
  return (
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  );
}

function getAuthSecret() {
  if (process.env.BETTER_AUTH_SECRET) {
    return process.env.BETTER_AUTH_SECRET;
  }

  if (process.env.NODE_ENV !== "production") {
    return "knowledgevault-dev-auth-secret";
  }

  throw new Error("BETTER_AUTH_SECRET is required in production");
}

export const auth = betterAuth({
  appName: "KnowledgeVault",
  secret: getAuthSecret(),
  baseURL: getAuthBaseUrl(),
  basePath: "/api/auth",
  trustedOrigins: [getAuthBaseUrl()],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  user: {
    modelName: "AuthUser",
  },
  session: {
    modelName: "AuthSession",
    expiresIn: THIRTY_DAYS_IN_SECONDS,
  },
  account: {
    modelName: "AuthAccount",
  },
  verification: {
    modelName: "AuthVerification",
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  plugins: [nextCookies()],
});
