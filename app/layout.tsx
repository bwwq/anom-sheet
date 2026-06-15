import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "风险部外勤档案",
  description: "多用户车卡档案管理网站",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
