import type { Metadata } from "next";
import { Toaster } from "sonner";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "KnowledgeVault",
  description: "Review-first training for knowledgeItem-based learning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <Toaster richColors closeButton position="top-center" />
      </body>
    </html>
  );
}
