import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://menscataly.com";

/**
 * robots.txt 生成
 *
 * - /admin/* と /api/* をクローラーから除外
 * - サイトマップURL を明示
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/*", "/api/*"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
