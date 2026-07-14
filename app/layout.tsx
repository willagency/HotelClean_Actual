import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ホテル客室清掃管理システム",
  description: "客室清掃の実績・シフト・売上を一元管理する社内向けツール",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
