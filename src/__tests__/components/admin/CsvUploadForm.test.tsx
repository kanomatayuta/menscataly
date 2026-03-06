/**
 * CsvUploadForm コンポーネント テスト
 *
 * CSV アップロードフォームの表示、ファイル選択、
 * アップロード成功・エラーメッセージの表示を検証する。
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CsvUploadForm } from "@/components/admin/CsvUploadForm";

describe("CsvUploadForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ================================================================
  // Rendering
  // ================================================================

  it("CSVインポートタイトルが表示される", () => {
    render(<CsvUploadForm />);
    expect(screen.getByText("CSVインポート")).toBeInTheDocument();
  });

  it("A8.net バッジが表示される", () => {
    render(<CsvUploadForm />);
    expect(screen.getByText("A8.net")).toBeInTheDocument();
  });

  it("ファイル選択ボタンが表示される", () => {
    render(<CsvUploadForm />);
    expect(screen.getByText("ファイルを選択")).toBeInTheDocument();
  });

  it("手順説明が表示される", () => {
    render(<CsvUploadForm />);
    expect(screen.getByText("A8.net CSVダウンロード手順:")).toBeInTheDocument();
    expect(screen.getByText(/A8.net管理画面にログイン/)).toBeInTheDocument();
  });

  it("ファイル input が hidden で CSV のみ受け付ける", () => {
    render(<CsvUploadForm />);
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    expect(fileInput.accept).toBe(".csv");
    expect(fileInput.className).toContain("hidden");
  });

  it("インポートボタンはファイル未選択時に disabled", () => {
    render(<CsvUploadForm />);
    const importButton = screen.getByRole("button", { name: /インポート/ });
    expect(importButton).toBeDisabled();
  });

  // ================================================================
  // File selection
  // ================================================================

  it("ファイル選択後にファイル名とサイズが表示される", async () => {
    const user = userEvent.setup();
    render(<CsvUploadForm />);

    const file = new File(["col1,col2\nval1,val2"], "test-report.csv", {
      type: "text/csv",
    });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, file);

    expect(screen.getByText("test-report.csv")).toBeInTheDocument();
    // サイズ表示を確認 (KB)
    expect(screen.getByText(/KB/)).toBeInTheDocument();
  });

  it("ファイル選択後にインポートボタンが有効になる", async () => {
    const user = userEvent.setup();
    render(<CsvUploadForm />);

    const file = new File(["data"], "report.csv", { type: "text/csv" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(fileInput, file);

    const importButton = screen.getByRole("button", { name: /インポート/ });
    expect(importButton).not.toBeDisabled();
  });

  // ================================================================
  // Upload success
  // ================================================================

  it("アップロード成功時に結果メッセージが表示される", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          imported: 10,
          aspName: "a8",
          records: 15,
        }),
    });

    render(<CsvUploadForm />);

    const file = new File(["data"], "report.csv", { type: "text/csv" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    const importButton = screen.getByRole("button", { name: /インポート/ });
    await user.click(importButton);

    await waitFor(() => {
      expect(
        screen.getByText(/15件のレコードを読み込み、10件をインポートしました/)
      ).toBeInTheDocument();
    });
  });

  it("アップロード成功後にファイル選択がリセットされる", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          imported: 5,
          aspName: "a8",
          records: 5,
        }),
    });

    render(<CsvUploadForm />);

    const file = new File(["data"], "report.csv", { type: "text/csv" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    const importButton = screen.getByRole("button", { name: /インポート/ });
    await user.click(importButton);

    await waitFor(() => {
      expect(screen.getByText(/5件をインポートしました/)).toBeInTheDocument();
    });

    // ファイル名が消えている
    expect(screen.queryByText("report.csv")).not.toBeInTheDocument();
    // ボタンが再度 disabled になっている
    expect(screen.getByRole("button", { name: /インポート/ })).toBeDisabled();
  });

  // ================================================================
  // Upload error
  // ================================================================

  it("サーバーエラー時にエラーメッセージが表示される", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () =>
        Promise.resolve({
          error: "ファイル形式が不正です",
        }),
    });

    render(<CsvUploadForm />);

    const file = new File(["bad data"], "bad.csv", { type: "text/csv" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    const importButton = screen.getByRole("button", { name: /インポート/ });
    await user.click(importButton);

    await waitFor(() => {
      expect(screen.getByText("ファイル形式が不正です")).toBeInTheDocument();
    });
  });

  it("ネットワークエラー時にエラーメッセージが表示される", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

    render(<CsvUploadForm />);

    const file = new File(["data"], "report.csv", { type: "text/csv" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    const importButton = screen.getByRole("button", { name: /インポート/ });
    await user.click(importButton);

    await waitFor(() => {
      expect(
        screen.getByText("ネットワークエラーが発生しました")
      ).toBeInTheDocument();
    });
  });

  it("サーバーエラー時にデフォルトメッセージが使われる", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    render(<CsvUploadForm />);

    const file = new File(["data"], "report.csv", { type: "text/csv" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    const importButton = screen.getByRole("button", { name: /インポート/ });
    await user.click(importButton);

    await waitFor(() => {
      expect(
        screen.getByText("アップロードに失敗しました")
      ).toBeInTheDocument();
    });
  });

  // ================================================================
  // Fetch call verification
  // ================================================================

  it("正しいエンドポイントにPOSTリクエストが送信される", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          imported: 1,
          aspName: "a8",
          records: 1,
        }),
    });
    global.fetch = fetchMock;

    render(<CsvUploadForm />);

    const file = new File(["data"], "report.csv", { type: "text/csv" });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    const importButton = screen.getByRole("button", { name: /インポート/ });
    await user.click(importButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/revenue/import",
        expect.objectContaining({
          method: "POST",
        })
      );
    });
  });
});
