import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";

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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendMagicLinkEmail({
  email,
  url,
}: {
  email: string;
  url: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.AUTH_FROM_EMAIL;
  const fromName = process.env.AUTH_FROM_NAME ?? "KnowledgeVault";
  const safeUrl = escapeHtml(url);

  if (resendApiKey && fromEmail) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [email],
        subject: "登录 KnowledgeVault",
        html: [
          "<div style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #111827;\">",
          "<h1 style=\"font-size: 20px; margin-bottom: 16px;\">登录 KnowledgeVault</h1>",
          "<p>点击下面的链接，继续你的知识复习进度。</p>",
          `<p><a href="${safeUrl}" style="display: inline-block; padding: 10px 16px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 8px;">打开 KnowledgeVault</a></p>`,
          `<p style="word-break: break-all; color: #4b5563;">${safeUrl}</p>`,
          "<p style=\"color: #6b7280; font-size: 14px;\">如果这不是你发起的请求，可以直接忽略这封邮件。</p>",
          "</div>",
        ].join(""),
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to send magic link email");
    }

    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(`[KnowledgeVault auth] Magic link for ${email}: ${url}`);
    return;
  }

  throw new Error(
    "Magic link delivery is not configured. Set RESEND_API_KEY and AUTH_FROM_EMAIL.",
  );
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
  plugins: [
    nextCookies(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail({
          email,
          url,
        });
      },
    }),
  ],
});
