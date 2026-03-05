"use client";

import { useState, useRef } from "react";

interface UploadResult {
  imported: number;
  aspName: string;
  records: number;
}

export function CsvUploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setResult(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("asp_name", "a8");

      const res = await fetch("/api/admin/revenue/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "アップロードに失敗しました");
        return;
      }

      setResult(data);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setError("ネットワークエラーが発生しました");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-neutral-800">
          CSVインポート
        </h2>
        <span className="rounded bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700">
          A8.net
        </span>
      </div>

      <div className="space-y-4 p-5">
        {/* 手順説明 */}
        <div className="rounded-md bg-neutral-50 p-3 text-xs text-neutral-600">
          <p className="mb-1.5 font-medium text-neutral-700">A8.net CSVダウンロード手順:</p>
          <ol className="list-inside list-decimal space-y-0.5">
            <li>A8.net管理画面にログイン</li>
            <li>「レポート」→「成果報酬レポート」を選択</li>
            <li>期間を指定して「CSV出力」をクリック</li>
            <li>ダウンロードしたCSVをここにアップロード</li>
          </ol>
        </div>

        {/* ファイル選択 */}
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50">
            <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            ファイルを選択
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setResult(null);
                setError(null);
              }}
            />
          </label>

          {file && (
            <span className="truncate text-sm text-neutral-600">
              {file.name}
              <span className="ml-1 text-xs text-neutral-400">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </span>
          )}
        </div>

        {/* アップロードボタン */}
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="inline-flex items-center gap-2 rounded-md bg-neutral-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {uploading ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              インポート中...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              インポート
            </>
          )}
        </button>

        {/* 結果表示 */}
        {result && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2">
            <svg className="h-4 w-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-xs text-green-700">
              {result.records}件のレコードを読み込み、{result.imported}件をインポートしました。
              ページを再読み込みすると反映されます。
            </p>
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
            </svg>
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
