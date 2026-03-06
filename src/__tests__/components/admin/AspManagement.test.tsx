/**
 * AspManagement コンポーネント テスト
 *
 * ASPプログラム管理画面の表示・フィルタ・モーダル操作を検証する。
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AspManagement from "@/components/admin/AspManagement";
import type { AspProgram } from "@/types/asp-config";

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

// ------------------------------------------------------------------
// Test data
// ------------------------------------------------------------------

const MOCK_CATEGORIES = [
  { slug: "aga", name: "AGA治療" },
  { slug: "hair-removal", name: "医療脱毛" },
  { slug: "skincare", name: "メンズスキンケア" },
  { slug: "ed", name: "ED治療" },
];

const MOCK_PROGRAMS: AspProgram[] = [
  {
    id: "prog-1",
    aspName: "a8",
    programName: "テストAGAクリニック",
    programId: "09-0717",
    category: "aga",
    rewardTiers: [{ condition: "初回来院完了", amount: 15000, type: "fixed" }],
    approvalRate: 85,
    epc: 120,
    itpSupport: true,
    cookieDuration: 30,
    isActive: true,
    priority: 1,
    recommendedAnchors: ["公式サイト"],
    notes: "",
    adCreatives: [],
    advertiserName: "テストAGA広告主",
    partnershipStatus: "active",
  },
  {
    id: "prog-2",
    aspName: "afb",
    programName: "テスト脱毛クリニック",
    programId: "afb-001",
    category: "hair-removal",
    rewardTiers: [{ condition: "カウンセリング予約", amount: 8000, type: "fixed" }],
    approvalRate: 70,
    epc: 80,
    itpSupport: false,
    cookieDuration: 60,
    isActive: true,
    priority: 2,
    recommendedAnchors: ["詳細を見る"],
    notes: "",
    adCreatives: [],
    advertiserName: "テスト脱毛広告主",
    partnershipStatus: "active",
  },
  {
    id: "prog-3",
    aspName: "a8",
    programName: "停止済みテストプログラム",
    programId: "09-9999",
    category: "skincare",
    rewardTiers: [{ condition: "購入完了", amount: 3000, type: "fixed" }],
    approvalRate: 50,
    epc: 30,
    itpSupport: false,
    cookieDuration: 30,
    isActive: false,
    priority: 5,
    recommendedAnchors: [],
    notes: "終了予定",
    adCreatives: [],
    advertiserName: "テストメーカー",
    partnershipStatus: "ended",
  },
];

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function mockFetchSuccess(programs: AspProgram[] = MOCK_PROGRAMS) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ programs, total: programs.length }),
  });
}

function mockFetchError(message = "Server error") {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: () => Promise.resolve({ error: message }),
  });
}

/**
 * Wait for the component to finish loading.
 * Programs appear in both table and category mapping, so use getAllByText.
 */
async function waitForLoaded() {
  await waitFor(() => {
    expect(screen.getAllByText("テストAGAクリニック").length).toBeGreaterThan(0);
  });
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe("AspManagement", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ================================================================
  // Rendering
  // ================================================================

  it("読み込み中はローディング表示を出す", () => {
    global.fetch = vi.fn().mockImplementation(
      () => new Promise(() => {})
    );
    render(<AspManagement categories={MOCK_CATEGORIES} />);
    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("fetch エラー時にエラーメッセージを表示する", async () => {
    mockFetchError("接続できません");
    render(<AspManagement categories={MOCK_CATEGORIES} />);
    await waitFor(() => {
      expect(screen.getByText("データの取得に失敗しました")).toBeInTheDocument();
    });
    expect(screen.getByText("接続できません")).toBeInTheDocument();
  });

  it("プログラム一覧が正しくレンダリングされる", async () => {
    mockFetchSuccess();
    render(<AspManagement categories={MOCK_CATEGORIES} />);
    await waitForLoaded();

    // プログラム名がページに表示される（テーブル + カテゴリマッピングの両方に出る場合あり）
    expect(screen.getAllByText("テストAGAクリニック").length).toBeGreaterThan(0);
    expect(screen.getAllByText("テスト脱毛クリニック").length).toBeGreaterThan(0);
    // 停止済みはカテゴリマッピング(isActive=falseなので表示されない)にはないがテーブルには出る
    expect(screen.getAllByText("停止済みテストプログラム").length).toBeGreaterThan(0);
  });

  it("サマリーカードに正しい数値が表示される", async () => {
    mockFetchSuccess();
    render(<AspManagement categories={MOCK_CATEGORIES} />);
    await waitForLoaded();

    // 全プログラム数カード
    const allCard = screen.getByText("全プログラム数").closest("div")!;
    expect(within(allCard).getByText("3")).toBeInTheDocument();

    // 有効カード (テーブルヘッダーにも「有効」があるので、summary cards 領域内で探す)
    const summarySection = screen.getByText("全プログラム数").closest("div.grid")!;
    const activeLabels = within(summarySection).getAllByText("有効");
    expect(activeLabels.length).toBeGreaterThan(0);
    const activeCard = activeLabels[0].closest("div")!;
    expect(within(activeCard).getByText("2")).toBeInTheDocument();

    // ITP対応カード
    const itpCard = screen.getByText("ITP対応").closest("div")!;
    expect(within(itpCard).getByText("1")).toBeInTheDocument();
  });

  it("カテゴリラベルが props の categories から正しく表示される", async () => {
    mockFetchSuccess();
    render(<AspManagement categories={MOCK_CATEGORIES} />);
    await waitForLoaded();

    expect(screen.getByText("カテゴリ別マッピング設定")).toBeInTheDocument();
    expect(screen.getAllByText("AGA治療").length).toBeGreaterThan(0);
    expect(screen.getAllByText("医療脱毛").length).toBeGreaterThan(0);
    expect(screen.getAllByText("メンズスキンケア").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ED治療").length).toBeGreaterThan(0);
  });

  // ================================================================
  // Filters
  // ================================================================

  it("ASP名でフィルタリングできる", async () => {
    mockFetchSuccess();
    const user = userEvent.setup();
    render(<AspManagement categories={MOCK_CATEGORIES} />);
    await waitForLoaded();

    const aspSelect = screen.getByLabelText("ASP:");
    await user.selectOptions(aspSelect, "afb");

    // テーブル内を確認
    const table = screen.getByRole("table");
    expect(within(table).getAllByText("テスト脱毛クリニック").length).toBeGreaterThan(0);
    expect(within(table).queryByText("テストAGAクリニック")).not.toBeInTheDocument();
    expect(within(table).queryByText("停止済みテストプログラム")).not.toBeInTheDocument();
  });

  it("カテゴリでフィルタリングできる", async () => {
    mockFetchSuccess();
    const user = userEvent.setup();
    render(<AspManagement categories={MOCK_CATEGORIES} />);
    await waitForLoaded();

    const categorySelect = screen.getByLabelText("カテゴリ:");
    await user.selectOptions(categorySelect, "aga");

    const table = screen.getByRole("table");
    expect(within(table).getAllByText("テストAGAクリニック").length).toBeGreaterThan(0);
    expect(within(table).queryByText("テスト脱毛クリニック")).not.toBeInTheDocument();
  });

  it("ステータスでフィルタリングできる（有効のみ）", async () => {
    mockFetchSuccess();
    const user = userEvent.setup();
    render(<AspManagement categories={MOCK_CATEGORIES} />);
    await waitForLoaded();

    const activeSelect = screen.getByLabelText("ステータス:");
    await user.selectOptions(activeSelect, "active");

    const table = screen.getByRole("table");
    expect(within(table).getAllByText("テストAGAクリニック").length).toBeGreaterThan(0);
    expect(within(table).getAllByText("テスト脱毛クリニック").length).toBeGreaterThan(0);
    expect(within(table).queryByText("停止済みテストプログラム")).not.toBeInTheDocument();
  });

  it("フィルタ結果の件数が表示される", async () => {
    mockFetchSuccess();
    const user = userEvent.setup();
    render(<AspManagement categories={MOCK_CATEGORIES} />);
    await waitFor(() => {
      expect(screen.getByText("3 件表示")).toBeInTheDocument();
    });

    const activeSelect = screen.getByLabelText("ステータス:");
    await user.selectOptions(activeSelect, "active");

    expect(screen.getByText("2 件表示")).toBeInTheDocument();
  });

  // ================================================================
  // Add modal
  // ================================================================

  it("「プログラム追加」ボタンで追加モーダルが開く", async () => {
    mockFetchSuccess();
    const user = userEvent.setup();
    render(<AspManagement categories={MOCK_CATEGORIES} />);
    await waitForLoaded();

    const addButton = screen.getByText("+ プログラム追加");
    await user.click(addButton);

    expect(screen.getByRole("heading", { name: "プログラム追加" })).toBeInTheDocument();
    expect(screen.getByText("保存")).toBeInTheDocument();
    expect(screen.getByText("キャンセル")).toBeInTheDocument();
  });

  it("追加モーダルをキャンセルで閉じられる", async () => {
    mockFetchSuccess();
    const user = userEvent.setup();
    render(<AspManagement categories={MOCK_CATEGORIES} />);
    await waitForLoaded();

    await user.click(screen.getByText("+ プログラム追加"));
    expect(screen.getByRole("heading", { name: "プログラム追加" })).toBeInTheDocument();

    await user.click(screen.getByText("キャンセル"));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "プログラム追加" })).not.toBeInTheDocument();
    });
  });

  // ================================================================
  // Edit modal
  // ================================================================

  it("編集ボタンクリックで編集モーダルが開く", async () => {
    mockFetchSuccess();
    const user = userEvent.setup();
    render(<AspManagement categories={MOCK_CATEGORIES} />);
    await waitForLoaded();

    const editButtons = screen.getAllByTitle("編集");
    await user.click(editButtons[0]);

    expect(screen.getByRole("heading", { name: "プログラム編集" })).toBeInTheDocument();
  });

  // ================================================================
  // Delete confirmation
  // ================================================================

  it("削除ボタンクリックで確認ダイアログが表示される", async () => {
    mockFetchSuccess();
    const user = userEvent.setup();
    render(<AspManagement categories={MOCK_CATEGORIES} />);
    await waitForLoaded();

    const deleteButtons = screen.getAllByTitle("削除");
    await user.click(deleteButtons[0]);

    expect(screen.getByRole("heading", { name: "プログラム削除" })).toBeInTheDocument();
    expect(screen.getByText(/を削除しますか/)).toBeInTheDocument();
  });

  it("削除確認ダイアログでキャンセルすると閉じる", async () => {
    mockFetchSuccess();
    const user = userEvent.setup();
    render(<AspManagement categories={MOCK_CATEGORIES} />);
    await waitForLoaded();

    const deleteButtons = screen.getAllByTitle("削除");
    await user.click(deleteButtons[0]);

    expect(screen.getByRole("heading", { name: "プログラム削除" })).toBeInTheDocument();

    const cancelButtons = screen.getAllByText("キャンセル");
    await user.click(cancelButtons[cancelButtons.length - 1]);

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "プログラム削除" })).not.toBeInTheDocument();
    });
  });

  it("削除確認後にプログラムが削除される", async () => {
    mockFetchSuccess();
    const user = userEvent.setup();
    render(<AspManagement categories={MOCK_CATEGORIES} />);
    await waitForLoaded();

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const deleteButtons = screen.getAllByTitle("削除");
    await user.click(deleteButtons[0]);

    // 確認ダイアログ内の「削除」ボタンを見つける
    // ダイアログ内のh3「プログラム削除」の親コンテナから「削除」ボタンを取得
    const dialogHeading = screen.getByRole("heading", { name: "プログラム削除" });
    const dialog = dialogHeading.closest("div.fixed")!;
    const deleteConfirmButton = within(dialog).getByRole("button", { name: "削除" });
    await user.click(deleteConfirmButton);

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "プログラム削除" })).not.toBeInTheDocument();
    });
  });
});
