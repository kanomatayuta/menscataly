/**
 * Footer コンポーネント テスト
 *
 * フッターの法的ページリンク（privacy, disclaimer, advertising-policy）が
 * 正しいパスを持ち、404 にならないことを保証する。
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "@/components/layout/Footer";

// next/link のモック: Link を <a> タグとしてレンダリング
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("Footer", () => {
  // ==================================================================
  // 法的ページリンクの検証
  // ==================================================================

  const LEGAL_LINKS = [
    { label: "プライバシーポリシー", expectedHref: "/privacy" },
    { label: "免責事項", expectedHref: "/disclaimer" },
    { label: "広告掲載ポリシー", expectedHref: "/advertising-policy" },
  ] as const;

  it.each(LEGAL_LINKS)(
    "法的リンク「$label」が正しいパス $expectedHref を持つ",
    ({ label, expectedHref }) => {
      render(<Footer />);
      const link = screen.getByRole("link", { name: label });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", expectedHref);
    }
  );

  // ==================================================================
  // サイト情報リンクの検証
  // ==================================================================

  const SITE_INFO_LINKS = [
    { label: "メンズカタリについて", expectedHref: "/about" },
    { label: "監修者紹介", expectedHref: "/supervisors" },
    { label: "お問い合わせ", expectedHref: "/contact" },
  ] as const;

  it.each(SITE_INFO_LINKS)(
    "サイト情報リンク「$label」が正しいパス $expectedHref を持つ",
    ({ label, expectedHref }) => {
      render(<Footer />);
      const link = screen.getByRole("link", { name: label });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", expectedHref);
    }
  );

  // ==================================================================
  // カテゴリリンクの検証
  // ==================================================================

  const CATEGORY_LINKS = [
    { label: "AGA治療", expectedHref: "/articles?category=aga" },
    {
      label: "医療脱毛",
      expectedHref: "/articles?category=hair-removal",
    },
    {
      label: "メンズスキンケア",
      expectedHref: "/articles?category=skincare",
    },
    { label: "ED治療", expectedHref: "/articles?category=ed" },
  ] as const;

  it.each(CATEGORY_LINKS)(
    "カテゴリリンク「$label」が正しいパス $expectedHref を持つ",
    ({ label, expectedHref }) => {
      render(<Footer />);
      const link = screen.getByRole("link", { name: label });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", expectedHref);
    }
  );

  // ==================================================================
  // 構造の検証
  // ==================================================================

  it("ブランドロゴ（トップページリンク）が存在する", () => {
    render(<Footer />);
    const logoLink = screen.getByRole("link", {
      name: "メンズカタリ トップページ",
    });
    expect(logoLink).toBeInTheDocument();
    expect(logoLink).toHaveAttribute("href", "/");
  });

  it("コピーライト表記が存在する", () => {
    render(<Footer />);
    expect(screen.getByText(/メンズカタリ. All rights reserved/)).toBeInTheDocument();
  });

  it("3つのナビゲーションセクションが存在する", () => {
    render(<Footer />);
    const navs = screen.getAllByRole("navigation");
    // カテゴリ, サイト情報, 法的情報 の3つ
    expect(navs.length).toBe(3);
  });

  it("医療免責事項が表示されている", () => {
    render(<Footer />);
    expect(
      screen.getByText(/本サイトの情報は医療診断を代替するものではありません/)
    ).toBeInTheDocument();
  });
});
