/**
 * Header コンポーネント テスト
 *
 * ナビゲーションリンクの存在確認とモバイルメニューの開閉動作を検証する。
 */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Header } from "@/components/layout/Header";

// next/link のモック
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

describe("Header", () => {
  beforeEach(() => {
    render(<Header />);
  });

  // ==================================================================
  // ブランドロゴ
  // ==================================================================

  it("ブランドロゴ（トップページリンク）が存在する", () => {
    const logoLink = screen.getByRole("link", {
      name: "メンズカタリ トップページ",
    });
    expect(logoLink).toBeInTheDocument();
    expect(logoLink).toHaveAttribute("href", "/");
  });

  // ==================================================================
  // デスクトップナビゲーションリンク
  // ==================================================================

  const NAV_LINKS = [
    { label: "AGA治療", expectedHref: "/articles?category=aga" },
    { label: "ED治療", expectedHref: "/articles?category=ed" },
    {
      label: "医療脱毛",
      expectedHref: "/articles?category=hair-removal",
    },
    {
      label: "スキンケア",
      expectedHref: "/articles?category=skincare",
    },
  ] as const;

  it.each(NAV_LINKS)(
    "メインナビリンク「$label」が正しいパス $expectedHref を持つ",
    ({ label, expectedHref }) => {
      const links = screen.getAllByRole("link", { name: label });
      // デスクトップ版に少なくとも1つ存在
      expect(links.length).toBeGreaterThanOrEqual(1);
      expect(links[0]).toHaveAttribute("href", expectedHref);
    }
  );

  const SECONDARY_LINKS = [
    { label: "監修者紹介", expectedHref: "/supervisors" },
    { label: "運営情報", expectedHref: "/about" },
  ] as const;

  it.each(SECONDARY_LINKS)(
    "セカンダリナビリンク「$label」が正しいパス $expectedHref を持つ",
    ({ label, expectedHref }) => {
      const links = screen.getAllByRole("link", { name: label });
      expect(links.length).toBeGreaterThanOrEqual(1);
      expect(links[0]).toHaveAttribute("href", expectedHref);
    }
  );

  // ==================================================================
  // モバイルメニューの動作
  // ==================================================================

  it("初期状態でモバイルメニューが閉じている", () => {
    const mobileMenu = screen.queryByLabelText("モバイルナビゲーション");
    expect(mobileMenu).not.toBeInTheDocument();
  });

  it("ハンバーガーボタンをクリックするとモバイルメニューが開く", () => {
    const toggleButton = screen.getByRole("button", {
      name: "メニューを開く",
    });
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggleButton);

    const mobileMenu = screen.getByLabelText("モバイルナビゲーション");
    expect(mobileMenu).toBeInTheDocument();
  });

  it("モバイルメニューを開いた後、閉じるボタンで閉じられる", () => {
    // メニューを開く
    const openButton = screen.getByRole("button", {
      name: "メニューを開く",
    });
    fireEvent.click(openButton);

    // メニューが開いている
    expect(
      screen.getByLabelText("モバイルナビゲーション")
    ).toBeInTheDocument();

    // 閉じるボタンをクリック
    const closeButton = screen.getByRole("button", {
      name: "メニューを閉じる",
    });
    expect(closeButton).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(closeButton);

    // メニューが閉じている
    expect(
      screen.queryByLabelText("モバイルナビゲーション")
    ).not.toBeInTheDocument();
  });

  it("モバイルメニュー内のリンクをクリックするとメニューが閉じる", () => {
    // メニューを開く
    const openButton = screen.getByRole("button", {
      name: "メニューを開く",
    });
    fireEvent.click(openButton);

    // モバイルメニュー内のリンクをクリック
    const mobileNav = screen.getByLabelText("モバイルナビゲーション");
    const agaLink = mobileNav.querySelector('a[href="/articles?category=aga"]');
    expect(agaLink).not.toBeNull();
    fireEvent.click(agaLink!);

    // メニューが閉じている
    expect(
      screen.queryByLabelText("モバイルナビゲーション")
    ).not.toBeInTheDocument();
  });

  // ==================================================================
  // アクセシビリティ
  // ==================================================================

  it("メインナビゲーションに aria-label が設定されている", () => {
    const mainNav = screen.getByLabelText("メインナビゲーション");
    expect(mainNav).toBeInTheDocument();
    expect(mainNav.tagName).toBe("NAV");
  });

  it("ハンバーガーボタンに aria-controls が設定されている", () => {
    const button = screen.getByRole("button", {
      name: "メニューを開く",
    });
    expect(button).toHaveAttribute("aria-controls", "mobile-menu");
  });
});
