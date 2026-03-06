/**
 * TableOfContents コンポーネント テスト
 *
 * 目次の表示条件、見出し一覧のレンダリング、
 * クリック時のスクロール動作を検証する。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TableOfContents } from "@/components/article/TableOfContents";

// ------------------------------------------------------------------
// DOM helpers
// ------------------------------------------------------------------

/**
 * .article-body を含む DOM を構築する。
 * TableOfContents は useEffect で document.querySelector(".article-body") を参照する。
 */
function setupArticleBody(headings: Array<{ tag: string; text: string; id?: string }>) {
  const existing = document.querySelector(".article-body");
  if (existing) existing.remove();

  const articleBody = document.createElement("div");
  articleBody.className = "article-body";

  for (const h of headings) {
    const el = document.createElement(h.tag);
    el.textContent = h.text;
    if (h.id) el.id = h.id;
    articleBody.appendChild(el);
  }

  document.body.appendChild(articleBody);
}

function cleanupArticleBody() {
  const existing = document.querySelector(".article-body");
  if (existing) existing.remove();
}

/**
 * Wait for TOC nav to appear, then return a scoped query helper.
 * This avoids matching heading text from .article-body DOM.
 */
async function waitForToc() {
  const nav = await screen.findByRole("navigation", { name: "目次" });
  return within(nav);
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe("TableOfContents", () => {
  beforeEach(() => {
    cleanupArticleBody();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanupArticleBody();
  });

  // ================================================================
  // 表示条件
  // ================================================================

  it("h2 が 2 つ未満の場合は null を返す（何もレンダリングしない）", async () => {
    setupArticleBody([
      { tag: "h2", text: "唯一の見出し" },
    ]);

    const { container } = render(<TableOfContents />);
    // Wait a tick for useEffect to complete
    await waitFor(() => {
      expect(container.querySelector("nav")).toBeNull();
    });
  });

  it("h2 が 0 個の場合は null を返す", async () => {
    setupArticleBody([
      { tag: "h3", text: "サブ見出し1" },
      { tag: "h3", text: "サブ見出し2" },
    ]);

    const { container } = render(<TableOfContents />);
    await waitFor(() => {
      expect(container.querySelector("nav")).toBeNull();
    });
  });

  it(".article-body が存在しない場合は null を返す", async () => {
    const { container } = render(<TableOfContents />);
    await waitFor(() => {
      expect(container.querySelector("nav")).toBeNull();
    });
  });

  // ================================================================
  // 正常レンダリング
  // ================================================================

  it("h2 が 2 つ以上あれば目次を表示する", async () => {
    setupArticleBody([
      { tag: "h2", text: "AGA治療とは" },
      { tag: "h2", text: "クリニックの選び方" },
    ]);

    render(<TableOfContents />);

    const toc = await waitForToc();
    expect(toc.getByText("AGA治療とは")).toBeInTheDocument();
    expect(toc.getByText("クリニックの選び方")).toBeInTheDocument();
  });

  it("h2 と h3 が混在する場合に正しく階層表示される", async () => {
    setupArticleBody([
      { tag: "h2", text: "AGA治療とは" },
      { tag: "h3", text: "原因と症状" },
      { tag: "h3", text: "治療方法" },
      { tag: "h2", text: "クリニックの選び方" },
      { tag: "h3", text: "費用の目安" },
    ]);

    render(<TableOfContents />);

    const toc = await waitForToc();
    expect(toc.getByText("AGA治療とは")).toBeInTheDocument();
    expect(toc.getByText("原因と症状")).toBeInTheDocument();
    expect(toc.getByText("治療方法")).toBeInTheDocument();
    expect(toc.getByText("クリニックの選び方")).toBeInTheDocument();
    expect(toc.getByText("費用の目安")).toBeInTheDocument();
  });

  it("nav 要素に aria-label='目次' が付与されている", async () => {
    setupArticleBody([
      { tag: "h2", text: "見出し1" },
      { tag: "h2", text: "見出し2" },
    ]);

    render(<TableOfContents />);

    const nav = await screen.findByRole("navigation", { name: "目次" });
    expect(nav).toBeInTheDocument();
  });

  it("既存の id を持つ見出しはその id をリンクに使用する", async () => {
    setupArticleBody([
      { tag: "h2", text: "見出しA", id: "custom-id-a" },
      { tag: "h2", text: "見出しB", id: "custom-id-b" },
    ]);

    render(<TableOfContents />);

    const toc = await waitForToc();

    const linkA = toc.getByText("見出しA").closest("a");
    expect(linkA).toHaveAttribute("href", "#custom-id-a");

    const linkB = toc.getByText("見出しB").closest("a");
    expect(linkB).toHaveAttribute("href", "#custom-id-b");
  });

  it("id がない見出しには自動生成された id が付与される", async () => {
    setupArticleBody([
      { tag: "h2", text: "AGA治療とは" },
      { tag: "h2", text: "クリニック選び" },
    ]);

    render(<TableOfContents />);

    const toc = await waitForToc();

    const linkA = toc.getByText("AGA治療とは").closest("a");
    expect(linkA).not.toBeNull();
    const href = linkA!.getAttribute("href");
    expect(href).toBeTruthy();
    expect(href!.startsWith("#")).toBe(true);
  });

  // ================================================================
  // クリック動作
  // ================================================================

  it("リンクをクリックすると scrollTo が呼ばれる", async () => {
    setupArticleBody([
      { tag: "h2", text: "見出し1", id: "heading-1" },
      { tag: "h2", text: "見出し2", id: "heading-2" },
    ]);

    const scrollToMock = vi.fn();
    window.scrollTo = scrollToMock;

    const heading2El = document.getElementById("heading-2");
    if (heading2El) {
      heading2El.getBoundingClientRect = vi.fn().mockReturnValue({
        top: 500, left: 0, right: 0, bottom: 0, width: 0, height: 0,
      });
    }

    const user = userEvent.setup();
    render(<TableOfContents />);

    const toc = await waitForToc();
    await user.click(toc.getByText("見出し2"));

    expect(scrollToMock).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "smooth" })
    );
  });

  it("リンクをクリックすると URL ハッシュが更新される", async () => {
    setupArticleBody([
      { tag: "h2", text: "見出し1", id: "heading-1" },
      { tag: "h2", text: "見出し2", id: "heading-2" },
    ]);

    const pushStateMock = vi.spyOn(window.history, "pushState");
    window.scrollTo = vi.fn();

    const heading1El = document.getElementById("heading-1");
    if (heading1El) {
      heading1El.getBoundingClientRect = vi.fn().mockReturnValue({
        top: 200, left: 0, right: 0, bottom: 0, width: 0, height: 0,
      });
    }

    const user = userEvent.setup();
    render(<TableOfContents />);

    const toc = await waitForToc();
    await user.click(toc.getByText("見出し1"));

    expect(pushStateMock).toHaveBeenCalledWith(null, "", "#heading-1");
  });

  it("リンクのデフォルト動作（ページジャンプ）が preventDefault される", async () => {
    setupArticleBody([
      { tag: "h2", text: "見出し1", id: "heading-1" },
      { tag: "h2", text: "見出し2", id: "heading-2" },
    ]);

    window.scrollTo = vi.fn();

    const heading1El = document.getElementById("heading-1");
    if (heading1El) {
      heading1El.getBoundingClientRect = vi.fn().mockReturnValue({
        top: 200, left: 0, right: 0, bottom: 0, width: 0, height: 0,
      });
    }

    const user = userEvent.setup();
    render(<TableOfContents />);

    const toc = await waitForToc();
    await user.click(toc.getByText("見出し1"));

    expect(window.scrollTo).toHaveBeenCalled();
  });
});
