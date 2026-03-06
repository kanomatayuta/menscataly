"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import type { AspName, AspProgram, AdCreative, AdCreativeType, RewardTier } from "@/types/asp-config";
import type { ContentCategory } from "@/types/content";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface CategoryOption {
  slug: string;
  name: string;
}

interface AspManagementProps {
  categories: CategoryOption[];
}

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const ASP_DISPLAY_NAMES: Record<AspName, string> = {
  afb: "afb",
  a8: "A8.net",
  accesstrade: "アクセストレード",
  valuecommerce: "バリューコマース",
  felmat: "Felmat",
  moshimo: "もしもアフィリエイト",
};

function createEmptyCreative(): AdCreative {
  return {
    id: `cr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: "text",
    label: "",
    affiliateUrl: "",
    anchorText: "",
    rawHtml: "",
    isActive: true,
    useForInjection: false,
    useForBanner: false,
  };
}

/**
 * ASP発行HTMLから情報を自動パースする
 * - <a href="..."> から affiliateUrl を抽出
 * - テキストリンクの場合、<a> 内テキストから anchorText を抽出
 * - バナーの場合、img src/width/height/alt から imageUrl, bannerSize, altText を抽出
 *   (1x1 トラッキングピクセルはスキップ)
 */
function parseAspHtml(html: string, type: 'text' | 'banner'): Partial<AdCreative> {
  const updates: Partial<AdCreative> = { rawHtml: html }

  // <a href="..."> から affiliateUrl を抽出
  const hrefMatch = html.match(/<a\s[^>]*href="([^"]+)"/)
  if (hrefMatch) {
    updates.affiliateUrl = hrefMatch[1]
  }

  if (type === 'text') {
    // テキストリンク: <a>タグ内のテキストを抽出
    const anchorMatch = html.match(/<a\s[^>]*>([^<]+)<\/a>/)
    if (anchorMatch) {
      updates.anchorText = anchorMatch[1].trim()
    }
  }

  if (type === 'banner') {
    // バナー: すべての<img>/<iframe>タグを取得し、1x1トラッキングピクセルをスキップ
    const elemRegex = /<(?:img|iframe)\s[^>]*>/gi
    let elemMatch: RegExpExecArray | null
    while ((elemMatch = elemRegex.exec(html)) !== null) {
      const tag = elemMatch[0]

      // width/height を HTML属性から抽出
      let w = 0, h = 0
      const widthAttr = tag.match(/\bwidth\s*=\s*["']?(\d+)["']?/i)
      const heightAttr = tag.match(/\bheight\s*=\s*["']?(\d+)["']?/i)
      if (widthAttr && heightAttr) {
        w = parseInt(widthAttr[1], 10)
        h = parseInt(heightAttr[1], 10)
      }

      // style属性からのフォールバック
      if (w === 0 || h === 0) {
        const styleMatch = tag.match(/style\s*=\s*["']([^"']+)["']/i)
        if (styleMatch) {
          const wm = styleMatch[1].match(/width\s*:\s*(\d+)\s*px/i)
          const hm = styleMatch[1].match(/height\s*:\s*(\d+)\s*px/i)
          if (wm && hm) {
            w = parseInt(wm[1], 10)
            h = parseInt(hm[1], 10)
          }
        }
      }

      // 1x1 トラッキングピクセルをスキップ
      if (w <= 2 && h <= 2 && w > 0 && h > 0) continue

      // imageUrl を抽出
      const srcMatch = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)
      if (srcMatch) {
        updates.imageUrl = srcMatch[1]
      }

      // width/height を数値でセット (サイズ自動登録)
      if (w > 0 && h > 0 && w <= 2000 && h <= 2000) {
        updates.width = w
        updates.height = h
      }

      // altText を抽出
      const altMatch = tag.match(/alt="([^"]*)"/)
      if (altMatch) {
        (updates as Record<string, unknown>).altText = altMatch[1]
      }

      break // 最初の非トラッキングピクセル要素のみ使用
    }
  }

  return updates
}

// ------------------------------------------------------------------
// Form type
// ------------------------------------------------------------------

interface ProgramFormData {
  aspName: string;
  programName: string;
  programId: string;
  category: string;
  rewardTiers: RewardTier[];
  approvalRate: number;
  epc: number;
  itpSupport: boolean;
  cookieDuration: number;
  isActive: boolean;
  priority: number;
  recommendedAnchors: string;
  notes: string;
  adCreatives: AdCreative[];
  advertiserName: string;
  aspCategory: string;
  confirmationPeriodDays: number;
  partnershipStatus: string;
  lastApprovalDate: string;
}

function createEmptyRewardTier(): RewardTier {
  return { condition: "", amount: 0, type: "fixed" };
}

const PARTNERSHIP_STATUS_LABELS: Record<string, string> = {
  active: "提携中",
  pending: "申請中",
  ended: "終了",
};

const EMPTY_FORM: ProgramFormData = {
  aspName: "a8",
  programName: "",
  programId: "",
  category: "aga",
  rewardTiers: [createEmptyRewardTier()],
  approvalRate: 0,
  epc: 0,
  itpSupport: false,
  cookieDuration: 30,
  isActive: true,
  priority: 3,
  recommendedAnchors: "",
  notes: "",
  adCreatives: [],
  advertiserName: "",
  aspCategory: "",
  confirmationPeriodDays: 30,
  partnershipStatus: "active",
  lastApprovalDate: "",
};

// ------------------------------------------------------------------
// API helpers
// ------------------------------------------------------------------

interface FetchProgramsResponse {
  programs: AspProgram[];
  total: number;
}

async function fetchPrograms(): Promise<FetchProgramsResponse> {
  const res = await fetch("/api/admin/asp?active=false&limit=200", {
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiUpdateProgram(
  id: string,
  updates: Record<string, unknown>,
): Promise<AspProgram> {
  const res = await fetch(`/api/admin/asp/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.program;
}

async function apiCreateProgram(
  data: ProgramFormData,
): Promise<AspProgram> {
  const res = await fetch("/api/admin/asp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const result = await res.json();
  return result.program;
}

async function apiDeleteProgram(id: string): Promise<void> {
  const res = await fetch(`/api/admin/asp/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
}

// ------------------------------------------------------------------
// Ad Creatives sub-component
// ------------------------------------------------------------------

function AdCreativesSection({
  creatives,
  onChange,
}: {
  creatives: AdCreative[];
  onChange: (creatives: AdCreative[]) => void;
}) {
  const [expanded, setExpanded] = useState(creatives.length > 0);

  const updateCreative = (index: number, updates: Partial<AdCreative>) => {
    const next = creatives.map((c, i) => (i === index ? { ...c, ...updates } : c));
    onChange(next);
  };

  const removeCreative = (index: number) => {
    onChange(creatives.filter((_, i) => i !== index));
  };

  const addCreative = () => {
    onChange([...creatives, createEmptyCreative()]);
    setExpanded(true);
  };

  return (
    <div className="rounded-lg border border-neutral-200">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-neutral-700">
          広告クリエイティブ
          {creatives.length > 0 && (
            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              {creatives.length}
            </span>
          )}
        </span>
        <svg className={`h-4 w-4 text-neutral-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-neutral-200 px-4 py-3 space-y-4">
          {creatives.map((creative, idx) => (
            <div key={creative.id} className={`rounded-lg border border-neutral-100 bg-neutral-50 p-3 space-y-3 ${!creative.isActive ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${creative.type === "text" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                    {creative.type === "text" ? "テキスト" : "バナー"}
                  </span>
                  <span className="text-xs text-neutral-500">{creative.label || `クリエイティブ ${idx + 1}`}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-neutral-500">
                    <input
                      type="checkbox"
                      checked={creative.isActive}
                      onChange={(e) => updateCreative(idx, { isActive: e.target.checked })}
                      className="rounded border-neutral-300"
                    />
                    有効
                  </label>
                  <button type="button" onClick={() => removeCreative(idx)} className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600" title="削除">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>

              {/* Type + Label */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-neutral-500">種別</label>
                  <select
                    value={creative.type}
                    onChange={(e) => updateCreative(idx, { type: e.target.value as AdCreativeType, useForInjection: e.target.value === "text" ? creative.useForInjection : false, useForBanner: e.target.value === "banner" ? creative.useForBanner : false })}
                    className="w-full rounded border border-neutral-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none"
                  >
                    <option value="text">テキストリンク</option>
                    <option value="banner">バナー</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-neutral-500">ラベル</label>
                  <input
                    type="text"
                    value={creative.label}
                    onChange={(e) => updateCreative(idx, { label: e.target.value })}
                    placeholder="例: 300x250 バナー"
                    className="w-full rounded border border-neutral-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
              </div>

              {/* ASP HTMLコード貼り付け */}
              <div>
                <label className="mb-1 block text-[10px] font-medium text-neutral-500">
                  ASP発行HTMLコード
                  <span className="ml-1 text-neutral-400">(貼り付けると自動パース)</span>
                </label>
                <textarea
                  value={creative.rawHtml ?? ""}
                  onChange={(e) => {
                    const html = e.target.value
                    if (html.trim()) {
                      const parsed = parseAspHtml(html, creative.type)
                      updateCreative(idx, { ...parsed })
                    } else {
                      updateCreative(idx, { rawHtml: "" })
                    }
                  }}
                  placeholder={creative.type === "banner"
                    ? '<a href="https://px.a8.net/..."><img ...></a>\n<img ... src="https://...0.gif..." alt="">'
                    : '<a href="https://px.a8.net/...">テキスト</a>\n<img ... src="https://...0.gif..." alt="">'}
                  rows={3}
                  className="w-full rounded border border-neutral-300 px-2 py-1.5 font-mono text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none"
                />
                {/* プレビュー */}
                {creative.rawHtml && (
                  <div className="mt-2 rounded border border-neutral-200 bg-white p-2">
                    <p className="mb-1 text-[10px] font-medium text-neutral-400">プレビュー:</p>
                    <div
                      className="text-sm"
                      dangerouslySetInnerHTML={{ __html: creative.rawHtml }}
                    />
                  </div>
                )}
              </div>


              {/* パース結果の表示（rawHtml入力時） */}
              {creative.rawHtml && creative.affiliateUrl && (() => {
                return (
                  <div className="rounded bg-green-50 px-2 py-1.5 text-[10px] text-green-700 space-y-0.5">
                    <div>URL抽出済み: <span className="font-mono">{creative.affiliateUrl!.slice(0, 60)}...</span></div>
                    {creative.type === "text" && creative.anchorText && (
                      <div>アンカー: {creative.anchorText}</div>
                    )}
                    {creative.type === "banner" && creative.imageUrl && (
                      <div>画像URL: <span className="font-mono">{creative.imageUrl.slice(0, 60)}...</span></div>
                    )}
                    {creative.type === "banner" && creative.width && creative.height && (
                      <div>サイズ自動検出: <span className="font-semibold">{creative.width}x{creative.height}</span></div>
                    )}
                  </div>
                )
              })()}

              {/* バナーサイズ (自動検出 + 手動編集) */}
              {creative.type === "banner" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-neutral-500">
                      幅 (px)
                      {creative.rawHtml && creative.width && <span className="ml-1 text-green-600">自動検出</span>}
                    </label>
                    <input
                      type="number"
                      value={creative.width ?? ""}
                      onChange={(e) => updateCreative(idx, { width: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                      placeholder="例: 300"
                      min={1}
                      max={2000}
                      className="w-full rounded border border-neutral-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-neutral-500">
                      高さ (px)
                      {creative.rawHtml && creative.height && <span className="ml-1 text-green-600">自動検出</span>}
                    </label>
                    <input
                      type="number"
                      value={creative.height ?? ""}
                      onChange={(e) => updateCreative(idx, { height: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                      placeholder="例: 250"
                      min={1}
                      max={2000}
                      className="w-full rounded border border-neutral-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* 用途チェックボックス */}
              {creative.type === "text" && (
                <label className="flex items-center gap-2 text-xs text-neutral-600">
                  <input
                    type="checkbox"
                    checked={creative.useForInjection}
                    onChange={(e) => updateCreative(idx, { useForInjection: e.target.checked })}
                    className="rounded border-neutral-300"
                  />
                  記事内テキストリンク注入に使用
                </label>
              )}
              {creative.type === "banner" && (
                <label className="flex items-center gap-2 text-xs text-neutral-600">
                  <input
                    type="checkbox"
                    checked={creative.useForBanner}
                    onChange={(e) => updateCreative(idx, { useForBanner: e.target.checked })}
                    className="rounded border-neutral-300"
                  />
                  バナー配置に使用
                </label>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addCreative}
            className="w-full rounded-md border border-dashed border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-500 hover:border-blue-400 hover:text-blue-600"
          >
            + クリエイティブ追加
          </button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// Modal component
// ------------------------------------------------------------------

function ProgramModal({
  isOpen,
  title,
  form,
  isSaving,
  onClose,
  onChange,
  onSave,
  categoryKeys,
  categoryLabels,
}: {
  isOpen: boolean;
  title: string;
  form: ProgramFormData;
  isSaving: boolean;
  onClose: () => void;
  onChange: (updates: Partial<ProgramFormData>) => void;
  onSave: () => void;
  categoryKeys: string[];
  categoryLabels: Record<string, string>;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* === 基本情報（最小限） === */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">ASP *</label>
              <select value={form.aspName} onChange={(e) => onChange({ aspName: e.target.value })} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
                {(Object.keys(ASP_DISPLAY_NAMES) as AspName[]).map((asp) => (
                  <option key={asp} value={asp}>{ASP_DISPLAY_NAMES[asp]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">カテゴリ *</label>
              <select value={form.category} onChange={(e) => onChange({ category: e.target.value })} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
                {categoryKeys.map((cat) => (
                  <option key={cat} value={cat}>{categoryLabels[cat]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">プログラム名 *</label>
              <input type="text" value={form.programName} onChange={(e) => onChange({ programName: e.target.value })} placeholder="AGAスキンクリニック" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">プログラムID *</label>
              <input type="text" value={form.programId} onChange={(e) => onChange({ programId: e.target.value })} placeholder="09-0717" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
            </div>
          </div>

          {/* === 報酬テーブル === */}
          <div className="rounded-lg border border-neutral-200 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-neutral-600">成果条件・報酬 *</label>
              <button
                type="button"
                onClick={() => onChange({ rewardTiers: [...form.rewardTiers, createEmptyRewardTier()] })}
                className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
              >
                + 成果条件を追加
              </button>
            </div>
            {form.rewardTiers.map((tier, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_80px_90px_32px] gap-2 items-end">
                <div>
                  {idx === 0 && <label className="mb-1 block text-[10px] font-medium text-neutral-500">成果条件</label>}
                  <input
                    type="text"
                    value={tier.condition}
                    onChange={(e) => {
                      const next = [...form.rewardTiers];
                      next[idx] = { ...tier, condition: e.target.value };
                      onChange({ rewardTiers: next });
                    }}
                    placeholder="初回来院完了"
                    className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
                <div>
                  {idx === 0 && <label className="mb-1 block text-[10px] font-medium text-neutral-500">{tier.type === "percentage" ? "率(%)" : "報酬額"}</label>}
                  <input
                    type="number"
                    value={tier.amount}
                    onChange={(e) => {
                      const next = [...form.rewardTiers];
                      next[idx] = { ...tier, amount: Number(e.target.value) };
                      onChange({ rewardTiers: next });
                    }}
                    className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none"
                  />
                </div>
                <div>
                  {idx === 0 && <label className="mb-1 block text-[10px] font-medium text-neutral-500">タイプ</label>}
                  <select
                    value={tier.type}
                    onChange={(e) => {
                      const next = [...form.rewardTiers];
                      next[idx] = { ...tier, type: e.target.value as "fixed" | "percentage" };
                      onChange({ rewardTiers: next });
                    }}
                    className="w-full rounded-md border border-neutral-300 px-1 py-1.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none"
                  >
                    <option value="fixed">固定</option>
                    <option value="percentage">%</option>
                  </select>
                </div>
                <div>
                  {form.rewardTiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = form.rewardTiers.filter((_, i) => i !== idx);
                        onChange({ rewardTiers: next });
                      }}
                      className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                      title="削除"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
                {/* 成果報酬%の場合: 商品金額から予想額計算 */}
                {tier.type === "percentage" && (
                  <div className="col-span-4 rounded bg-blue-50 px-2 py-1.5 flex items-center gap-2">
                    <span className="text-[10px] text-blue-600">商品金額:</span>
                    <input
                      type="number"
                      value={tier.productPrice ?? 0}
                      onChange={(e) => {
                        const next = [...form.rewardTiers];
                        next[idx] = { ...tier, productPrice: Number(e.target.value) };
                        onChange({ rewardTiers: next });
                      }}
                      placeholder="10000"
                      className="w-24 rounded border border-blue-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-neutral-500">× {tier.amount}% =</span>
                    <span className="text-xs font-bold text-green-700">
                      {Math.round((tier.productPrice ?? 0) * tier.amount / 100).toLocaleString()}円
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* === 詳細設定 (折りたたみ) === */}
          <details className="rounded-lg border border-neutral-200">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
              詳細設定
            </summary>
            <div className="space-y-3 border-t border-neutral-100 px-4 py-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">広告主名</label>
                <input type="text" value={form.advertiserName} onChange={(e) => onChange({ advertiserName: e.target.value })} placeholder="株式会社◯◯" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">EPC (円)</label>
                  <input type="number" step="0.01" value={form.epc} onChange={(e) => onChange({ epc: Number(e.target.value) })} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">確定率 (%)</label>
                  <input type="number" step="0.01" value={form.approvalRate} onChange={(e) => onChange({ approvalRate: Number(e.target.value) })} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">優先度</label>
                  <select value={form.priority} onChange={(e) => onChange({ priority: Number(e.target.value) })} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
                    <option value={1}>1 最優先</option>
                    <option value={2}>2 高</option>
                    <option value={3}>3 標準</option>
                    <option value={4}>4 低</option>
                    <option value={5}>5 最低</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">ASPカテゴリ</label>
                  <input type="text" value={form.aspCategory} onChange={(e) => onChange({ aspCategory: e.target.value })} placeholder="ボディケア" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">提携状況</label>
                  <select value={form.partnershipStatus} onChange={(e) => onChange({ partnershipStatus: e.target.value })} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
                    <option value="active">提携中</option>
                    <option value="pending">申請中</option>
                    <option value="ended">終了</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">確定目安</label>
                  <div className="flex items-center gap-1">
                    <input type="number" value={form.confirmationPeriodDays} onChange={(e) => onChange({ confirmationPeriodDays: Number(e.target.value) })} min={0} className="w-16 rounded-md border border-neutral-300 px-2 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                    <span className="text-xs text-neutral-500">日</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">Cookie</label>
                  <div className="flex items-center gap-1">
                    <input type="number" value={form.cookieDuration} onChange={(e) => onChange({ cookieDuration: Number(e.target.value) })} className="w-16 rounded-md border border-neutral-300 px-2 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                    <span className="text-xs text-neutral-500">日</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">推奨アンカー (カンマ区切り)</label>
                <input type="text" value={form.recommendedAnchors} onChange={(e) => onChange({ recommendedAnchors: e.target.value })} placeholder="公式サイト, 詳細を見る" className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">メモ</label>
                <textarea value={form.notes} onChange={(e) => onChange({ notes: e.target.value })} placeholder="プログラムに関するメモ" rows={2} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600">最終承認日</label>
                  <input type="date" value={form.lastApprovalDate} onChange={(e) => onChange({ lastApprovalDate: e.target.value })} className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none" />
                </div>
                <div className="flex items-center gap-4 pt-5">
                  <label className="flex items-center gap-1.5 text-sm text-neutral-700">
                    <input type="checkbox" checked={form.itpSupport} onChange={(e) => onChange({ itpSupport: e.target.checked })} className="rounded border-neutral-300" />
                    ITP対応
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-neutral-700">
                    <input type="checkbox" checked={form.isActive} onChange={(e) => onChange({ isActive: e.target.checked })} className="rounded border-neutral-300" />
                    有効
                  </label>
                </div>
              </div>
            </div>
          </details>

          {/* Ad Creatives Section */}
          <AdCreativesSection
            creatives={form.adCreatives}
            onChange={(adCreatives) => onChange({ adCreatives })}
          />
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || !form.programName}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Page component
// ------------------------------------------------------------------

export default function AspManagement({ categories }: AspManagementProps) {
  // Build category labels map from microCMS data
  const CATEGORY_LABELS: Record<string, string> = {};
  for (const cat of categories) {
    CATEGORY_LABELS[cat.slug] = cat.name;
  }
  const categoryKeys = categories.map((c) => c.slug);
  const [filterAsp, setFilterAsp] = useState<AspName | "all">("all");
  const [filterCategory, setFilterCategory] = useState<ContentCategory | "all">("all");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [programs, setPrograms] = useState<AspProgram[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProgramFormData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadPrograms = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPrograms();
      setPrograms(data.programs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "データの取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  const filteredPrograms = programs.filter((p) => {
    if (filterAsp !== "all" && p.aspName !== filterAsp) return false;
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    if (filterActive === "active" && !p.isActive) return false;
    if (filterActive === "inactive" && p.isActive) return false;
    return true;
  });

  // Open add modal
  const handleAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalTitle("プログラム追加");
    setModalOpen(true);
  };

  // Open edit modal
  const handleEdit = (program: AspProgram) => {
    setEditingId(program.id);
    setForm({
      aspName: program.aspName,
      programName: program.programName,
      programId: program.programId ?? "",
      category: program.category,
      rewardTiers: program.rewardTiers.length > 0 ? program.rewardTiers : [createEmptyRewardTier()],
      approvalRate: program.approvalRate ?? 0,
      epc: program.epc ?? 0,
      itpSupport: program.itpSupport,
      cookieDuration: program.cookieDuration ?? 30,
      isActive: program.isActive,
      priority: program.priority ?? 3,
      recommendedAnchors: (program.recommendedAnchors ?? []).join(", "),
      notes: program.notes ?? "",
      adCreatives: program.adCreatives ?? [],
      advertiserName: program.advertiserName ?? "",
      aspCategory: program.aspCategory ?? "",
      confirmationPeriodDays: program.confirmationPeriodDays ?? 30,
      partnershipStatus: program.partnershipStatus ?? "active",
      lastApprovalDate: program.lastApprovalDate ?? "",
    });
    setModalTitle("プログラム編集");
    setModalOpen(true);
  };

  // Save (create or update)
  const handleSave = async () => {
    setIsSaving(true);
    setUpdateError(null);
    try {
      // recommendedAnchors をカンマ区切り文字列→配列に変換
      const payload = {
        ...form,
        recommendedAnchors: form.recommendedAnchors
          ? form.recommendedAnchors.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
      };
      if (editingId) {
        await apiUpdateProgram(editingId, { ...payload });
      } else {
        await apiCreateProgram(payload as unknown as ProgramFormData);
      }
      setModalOpen(false);
      await loadPrograms();
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete
  const handleDelete = async (id: string) => {
    setUpdateError(null);
    try {
      await apiDeleteProgram(id);
      setDeletingId(null);
      setPrograms((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "削除に失敗しました");
      setDeletingId(null);
    }
  };

  const handleToggleItp = async (id: string) => {
    setUpdateError(null);
    const program = programs.find((p) => p.id === id);
    if (!program) return;
    const newValue = !program.itpSupport;
    setPrograms((prev) => prev.map((p) => p.id === id ? { ...p, itpSupport: newValue } : p));
    try {
      await apiUpdateProgram(id, { itpSupport: newValue });
    } catch (err) {
      setPrograms((prev) => prev.map((p) => p.id === id ? { ...p, itpSupport: !newValue } : p));
      setUpdateError(`ITP設定の更新に失敗しました: ${err instanceof Error ? err.message : "不明なエラー"}`);
    }
  };

  const handleToggleActive = async (id: string) => {
    setUpdateError(null);
    const program = programs.find((p) => p.id === id);
    if (!program) return;
    const newValue = !program.isActive;
    setPrograms((prev) => prev.map((p) => p.id === id ? { ...p, isActive: newValue } : p));
    try {
      await apiUpdateProgram(id, { isActive: newValue });
    } catch (err) {
      setPrograms((prev) => prev.map((p) => p.id === id ? { ...p, isActive: !newValue } : p));
      setUpdateError(`有効/無効の切り替えに失敗しました: ${err instanceof Error ? err.message : "不明なエラー"}`);
    }
  };

  // Summary stats
  const totalPrograms = programs.length;
  const activePrograms = programs.filter((p) => p.isActive).length;
  const itpSupportCount = programs.filter((p) => p.itpSupport).length;
  const avgEpc =
    programs.length > 0
      ? programs.reduce((sum, p) => sum + (p.epc ?? 0), 0) / programs.length
      : 0;

  if (isLoading) {
    return (
      <>
        <AdminHeader title="ASPリンク管理" breadcrumbs={[{ label: "ASP管理" }]} />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-600" />
            <p className="text-sm text-neutral-500">読み込み中...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <AdminHeader title="ASPリンク管理" breadcrumbs={[{ label: "ASP管理" }]} />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="mb-2 text-sm font-medium text-neutral-900">データの取得に失敗しました</p>
            <p className="mb-4 text-xs text-neutral-500">{error}</p>
            <button type="button" onClick={loadPrograms} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">再試行</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-start justify-between">
        <AdminHeader title="ASPリンク管理" breadcrumbs={[{ label: "ASP管理" }]} />
        <button
          type="button"
          onClick={handleAdd}
          className="shrink-0 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          + プログラム追加
        </button>
      </div>

      {/* Modal */}
      <ProgramModal
        isOpen={modalOpen}
        title={modalTitle}
        form={form}
        isSaving={isSaving}
        onClose={() => setModalOpen(false)}
        onChange={(updates) => setForm((prev) => ({ ...prev, ...updates }))}
        onSave={handleSave}
        categoryKeys={categoryKeys}
        categoryLabels={CATEGORY_LABELS}
      />

      {/* Delete confirm dialog */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="mb-2 text-base font-bold text-neutral-900">プログラム削除</h3>
            <p className="mb-4 text-sm text-neutral-600">
              「{programs.find((p) => p.id === deletingId)?.programName}」を削除しますか？この操作は取り消せません。
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setDeletingId(null)} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">キャンセル</button>
              <button type="button" onClick={() => handleDelete(deletingId)} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">削除</button>
            </div>
          </div>
        </div>
      )}

      {/* Update error toast */}
      {updateError && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-800">{updateError}</p>
          <button type="button" onClick={() => setUpdateError(null)} className="ml-4 text-sm font-medium text-red-600 hover:text-red-800">閉じる</button>
        </div>
      )}

      {/* PR表記 notice */}
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-800">広告表示・PR表記について</p>
            <p className="mt-1 text-xs text-blue-700">
              ステマ規制に基づき、アフィリエイトリンクを含む全記事に「【PR】本記事には広告・アフィリエイトリンクが含まれています」のPR表記が自動挿入されます。
            </p>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="mb-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-neutral-500">全プログラム数</p>
            <p className="mt-1 text-xl font-bold text-neutral-900">{totalPrograms}</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50/50 p-4 shadow-sm">
            <p className="text-xs font-medium text-neutral-500">有効</p>
            <p className="mt-1 text-xl font-bold text-green-700">{activePrograms}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
            <p className="text-xs font-medium text-neutral-500">ITP対応</p>
            <p className="mt-1 text-xl font-bold text-blue-700">{itpSupportCount}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-neutral-500">平均EPC</p>
            <p className="mt-1 text-xl font-bold text-neutral-900">{Math.round(avgEpc)}円</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div>
          <label htmlFor="filter-asp" className="mr-2 text-xs font-medium text-neutral-600">ASP:</label>
          <select id="filter-asp" value={filterAsp} onChange={(e) => setFilterAsp(e.target.value as AspName | "all")} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
            <option value="all">すべて</option>
            {(Object.keys(ASP_DISPLAY_NAMES) as AspName[]).map((asp) => (
              <option key={asp} value={asp}>{ASP_DISPLAY_NAMES[asp]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-category" className="mr-2 text-xs font-medium text-neutral-600">カテゴリ:</label>
          <select id="filter-category" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as ContentCategory | "all")} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
            <option value="all">すべて</option>
            {categoryKeys.map((cat) => (
              <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-active" className="mr-2 text-xs font-medium text-neutral-600">ステータス:</label>
          <select id="filter-active" value={filterActive} onChange={(e) => setFilterActive(e.target.value as "all" | "active" | "inactive")} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
            <option value="all">すべて</option>
            <option value="active">有効のみ</option>
            <option value="inactive">無効のみ</option>
          </select>
        </div>
        <div className="ml-auto text-sm text-neutral-500">{filteredPrograms.length} 件表示</div>
      </div>

      {/* Programs table */}
      <div className="max-h-[70vh] overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-20">
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="sticky left-0 z-30 min-w-[200px] bg-slate-50 px-4 py-3 font-medium text-slate-600 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">プログラム名</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-600">広告主</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-600">ASP</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-600">カテゴリ</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-600">提携</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-600">優先度</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-600">報酬</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-600">成果条件</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-600">承認率</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-600">EPC</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-600">ITP</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-600">有効</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredPrograms.map((program) => {
              return (
                <tr key={program.id} className={`group hover:bg-blue-50/40 ${!program.isActive ? "opacity-60" : ""}`}>
                  <td className="sticky left-0 z-10 min-w-[200px] max-w-[200px] bg-white px-4 py-3 font-medium text-slate-800 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] group-hover:bg-[#eff5fb]">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate">{program.programName}</p>
                      {program.adCreatives && program.adCreatives.length > 0 && (
                        <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-500" title="広告クリエイティブ数">
                          {program.adCreatives.length}素材
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{program.advertiserName || program.programId}</p>
                  </td>
                  <td className="max-w-[120px] truncate px-4 py-3 text-xs text-slate-500">{program.advertiserName || "-"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{ASP_DISPLAY_NAMES[program.aspName]}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{CATEGORY_LABELS[program.category] ?? program.category}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{PARTNERSHIP_STATUS_LABELS[program.partnershipStatus ?? "active"] ?? program.partnershipStatus}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex items-center justify-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{program.priority ?? 3}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">
                    {(() => {
                      const tiers = program.rewardTiers ?? [];
                      if (tiers.length === 0) return "-";
                      const maxTier = tiers.reduce((max, t) => (t.amount > max.amount ? t : max), tiers[0]);
                      const display = maxTier.type === "percentage" ? `${maxTier.amount}%` : `${maxTier.amount.toLocaleString()}円`;
                      return tiers.length > 1 ? <>{display} <span className="text-xs text-slate-400">+他{tiers.length - 1}件</span></> : display;
                    })()}
                  </td>
                  <td className="max-w-[150px] truncate whitespace-nowrap px-4 py-3 text-xs text-slate-500">{program.rewardTiers?.[0]?.condition || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {program.approvalRate != null ? (
                      <span className="text-sm font-medium text-slate-700">{program.approvalRate}%</span>
                    ) : <span className="text-slate-400">-</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{program.epc != null ? `${program.epc}円` : "-"}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => handleToggleItp(program.id)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${program.itpSupport ? "bg-blue-500" : "bg-slate-300"}`} aria-label={`ITP対応を${program.itpSupport ? "無効" : "有効"}にする`}>
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${program.itpSupport ? "translate-x-4.5" : "translate-x-0.5"}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => handleToggleActive(program.id)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${program.isActive ? "bg-blue-500" : "bg-slate-300"}`} aria-label={`プログラムを${program.isActive ? "無効" : "有効"}にする`}>
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${program.isActive ? "translate-x-4.5" : "translate-x-0.5"}`} />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => handleEdit(program)} className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="編集">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button type="button" onClick={() => setDeletingId(program.id)} className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="削除">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredPrograms.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-sm text-neutral-500">条件に一致するプログラムがありません</p>
          </div>
        )}
      </div>

      {/* Category mapping section */}
      <div className="mt-8">
        <h2 className="mb-2 text-lg font-semibold text-neutral-800">カテゴリ別マッピング設定</h2>
        <p className="mb-4 text-xs text-neutral-500">
          各カテゴリの記事にどのASPプログラムを優先的にリンク注入するかを管理します。優先度が高い(数値が小さい)プログラムが先に挿入されます。
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {categoryKeys.map((category) => {
              const categoryPrograms = programs.filter((p) => p.category === category && p.isActive);
              const avgApproval = categoryPrograms.length > 0 ? Math.round(categoryPrograms.reduce((sum, p) => sum + (p.approvalRate ?? 0), 0) / categoryPrograms.length) : 0;
              const totalReward = categoryPrograms.reduce((sum, p) => {
                const maxFixed = (p.rewardTiers ?? []).filter((t) => t.type === "fixed").reduce((max, t) => Math.max(max, t.amount), 0);
                return sum + maxFixed;
              }, 0);
              const sorted = [...categoryPrograms].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));

              return (
                <div key={category} className="rounded-lg border border-neutral-200 bg-white shadow-sm">
                  {/* Card header */}
                  <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
                    <h3 className="text-sm font-semibold text-neutral-800">{CATEGORY_LABELS[category]}</h3>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">{categoryPrograms.length}件</span>
                      <span className={`text-xs font-medium ${avgApproval >= 80 ? "text-green-600" : avgApproval >= 60 ? "text-yellow-600" : "text-red-600"}`}>承認率 {avgApproval}%</span>
                      <span className="text-xs text-neutral-500">合計 {totalReward.toLocaleString()}円</span>
                    </div>
                  </div>

                  {/* Program list with priority */}
                  {sorted.length === 0 ? (
                    <div className="px-5 py-6 text-center text-xs text-neutral-400">
                      このカテゴリには有効なプログラムがありません
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-50">
                      {sorted.map((p, idx) => (
                        <div key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                          {/* Priority badge */}
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            idx === 0 ? "bg-amber-100 text-amber-700" :
                            idx === 1 ? "bg-neutral-200 text-neutral-600" :
                            idx === 2 ? "bg-orange-100 text-orange-600" :
                            "bg-neutral-50 text-neutral-400"
                          }`}>{idx + 1}</span>

                          {/* Program info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-neutral-800">{p.programName}</span>
                              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                ({
                                  afb: "bg-purple-50 text-purple-600",
                                  a8: "bg-orange-50 text-orange-600",
                                  accesstrade: "bg-cyan-50 text-cyan-600",
                                  valuecommerce: "bg-emerald-50 text-emerald-600",
                                  felmat: "bg-pink-50 text-pink-600",
                                  moshimo: "bg-teal-50 text-teal-600",
                                } as Record<string, string>)[p.aspName] ?? "bg-neutral-50 text-neutral-500"
                              }`}>{ASP_DISPLAY_NAMES[p.aspName]}</span>
                            </div>
                            {/* Recommended anchors */}
                            {p.recommendedAnchors && p.recommendedAnchors.length > 0 && (
                              <div className="mt-0.5 flex flex-wrap gap-1">
                                {p.recommendedAnchors.slice(0, 3).map((anchor, i) => (
                                  <span key={i} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600">
                                    {anchor}
                                  </span>
                                ))}
                                {p.recommendedAnchors.length > 3 && (
                                  <span className="text-[10px] text-neutral-400">+{p.recommendedAnchors.length - 3}</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Reward + priority selector */}
                          <div className="flex shrink-0 items-center gap-3">
                            <span className="text-sm font-semibold text-neutral-800">
                              {(() => {
                                const tiers = p.rewardTiers ?? [];
                                if (tiers.length === 0) return "-";
                                const maxTier = tiers.reduce((max, t) => (t.amount > max.amount ? t : max), tiers[0]);
                                return maxTier.type === "percentage" ? `${maxTier.amount}%` : `${maxTier.amount.toLocaleString()}円`;
                              })()}
                            </span>
                            <select
                              value={p.priority ?? 3}
                              onChange={async (e) => {
                                const newPriority = Number(e.target.value);
                                setPrograms((prev) => prev.map((prog) => prog.id === p.id ? { ...prog, priority: newPriority } : prog));
                                try {
                                  await apiUpdateProgram(p.id, { priority: newPriority });
                                } catch {
                                  setPrograms((prev) => prev.map((prog) => prog.id === p.id ? { ...prog, priority: p.priority } : prog));
                                  setUpdateError("優先度の更新に失敗しました");
                                }
                              }}
                              className="rounded border border-neutral-200 px-1.5 py-1 text-xs text-neutral-600 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 focus:outline-none"
                              title="優先度を変更"
                            >
                              <option value={1}>P1</option>
                              <option value={2}>P2</option>
                              <option value={3}>P3</option>
                              <option value={4}>P4</option>
                              <option value={5}>P5</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleEdit(p)}
                              className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-blue-600"
                              title="編集"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ITP summary */}
                  <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-2 text-xs text-neutral-500">
                    <span>ITP対応: {categoryPrograms.filter((p) => p.itpSupport).length}/{categoryPrograms.length}</span>
                    <span>最大リンク挿入: 3本/記事</span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </>
  );
}
