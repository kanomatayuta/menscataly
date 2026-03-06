import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MENS CATALY — メンズ医療・美容の総合メディア",
    short_name: "MENS CATALY",
    description:
      "AGA治療・ED治療・医療脱毛・スキンケアなど、メンズ医療×美容の最新情報を専門家監修でお届けするメディアサイト。",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
