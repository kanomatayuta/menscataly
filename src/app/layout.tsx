import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "メンズカタリ | メンズ医療・美容の総合メディア",
    template: "%s | メンズカタリ",
  },
  description:
    "メンズカタリは、AGA・ED・脱毛・スキンケアなどメンズ医療・美容に関する正確な情報をお届けする総合メディアです。",
  keywords: ["AGA", "薄毛", "ED", "メンズ脱毛", "スキンケア", "メンズ美容"],
  authors: [{ name: "メンズカタリ編集部" }],
  creator: "メンズカタリ",
  publisher: "メンズカタリ",
  metadataBase: new URL("https://menscataly.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "https://menscataly.com",
    siteName: "メンズカタリ",
    title: "メンズカタリ | メンズ医療・美容の総合メディア",
    description:
      "メンズカタリは、AGA・ED・脱毛・スキンケアなどメンズ医療・美容に関する正確な情報をお届けする総合メディアです。",
  },
  twitter: {
    card: "summary_large_image",
    title: "メンズカタリ | メンズ医療・美容の総合メディア",
    description:
      "メンズカタリは、AGA・ED・脱毛・スキンケアなどメンズ医療・美容に関する正確な情報をお届けする総合メディアです。",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
