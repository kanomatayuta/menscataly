import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { GA4Script } from "@/components/analytics/GA4Script";
import { A8LinkManager } from "@/components/tracking/A8LinkManager";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "メンズカタリ | メンズ医療・美容の総合メディア",
    template: "%s | メンズカタリ",
  },
  description:
    "メンズカタリは、AGA・ED・脱毛・スキンケアなどメンズ医療・美容に関する正確な情報をお届けする総合メディアです。専門医監修のもと、信頼性の高いコンテンツを提供しています。",
  keywords: [
    "AGA",
    "薄毛",
    "ED",
    "勃起不全",
    "メンズ脱毛",
    "医療脱毛",
    "スキンケア",
    "メンズ美容",
    "メンズ医療",
  ],
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
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "メンズカタリ",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "メンズカタリ | メンズ医療・美容の総合メディア",
    description:
      "メンズカタリは、AGA・ED・脱毛・スキンケアなどメンズ医療・美容に関する正確な情報をお届けする総合メディアです。",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={notoSansJP.variable}>
      <body className="flex min-h-screen flex-col antialiased">
        <GA4Script />
        <A8LinkManager />
        <Header />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
