"use client";

import { useState } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import type { AspName, AspProgram } from "@/types/asp-config";
import type { ContentCategory } from "@/types/content";

// ------------------------------------------------------------------
// Mock ASP data
// ------------------------------------------------------------------

const ASP_DISPLAY_NAMES: Record<AspName, string> = {
  afb: "afb",
  a8: "A8.net",
  accesstrade: "アクセストレード",
  valuecommerce: "バリューコマース",
  felmat: "Felmat",
  moshimo: "もしもアフィリエイト",
};

const CATEGORY_LABELS: Record<ContentCategory, string> = {
  aga: "AGA治療",
  "hair-removal": "医療脱毛",
  skincare: "スキンケア",
  ed: "ED治療",
  column: "コラム",
};

const MOCK_PROGRAMS: AspProgram[] = [
  {
    id: "asp-001",
    aspName: "afb",
    programName: "AGAクリニック東京 新規カウンセリング",
    programId: "afb-aga-001",
    category: "aga",
    rewardAmount: 15000,
    rewardType: "fixed",
    conversionCondition: "無料カウンセリング予約完了",
    affiliateUrl: "https://track.afb.jp/click/xxxxx",
    landingPageUrl: "https://aga-clinic-tokyo.example.com",
    itpSupport: true,
    cookieDuration: 30,
    isActive: true,
    priority: 1,
    approvalRate: 85,
    epc: 320,
    recommendedAnchors: ["AGAクリニック東京の詳細を見る"],
  },
  {
    id: "asp-002",
    aspName: "a8",
    programName: "メンズ医療脱毛 リンクス",
    programId: "a8-hair-001",
    category: "hair-removal",
    rewardAmount: 22000,
    rewardType: "fixed",
    conversionCondition: "初回来店+カウンセリング",
    affiliateUrl: "https://px.a8.net/xxxxx",
    landingPageUrl: "https://links-datsumou.example.com",
    itpSupport: true,
    cookieDuration: 60,
    isActive: true,
    priority: 1,
    approvalRate: 72,
    epc: 450,
    recommendedAnchors: ["リンクスの詳細を見る"],
  },
  {
    id: "asp-003",
    aspName: "accesstrade",
    programName: "ED治療オンライン診療 メンズクリ",
    programId: "at-ed-001",
    category: "ed",
    rewardAmount: 8000,
    rewardType: "fixed",
    conversionCondition: "オンライン診療予約完了",
    affiliateUrl: "https://h.accesstrade.net/xxxxx",
    landingPageUrl: "https://ed-online.example.com",
    itpSupport: false,
    cookieDuration: 30,
    isActive: true,
    priority: 2,
    approvalRate: 90,
    epc: 180,
    recommendedAnchors: ["メンズクリの詳細を見る"],
  },
  {
    id: "asp-004",
    aspName: "valuecommerce",
    programName: "メンズスキンケア定期購入 BULK HOMME",
    programId: "vc-skin-001",
    category: "skincare",
    rewardAmount: 3500,
    rewardType: "fixed",
    conversionCondition: "定期コース初回購入",
    affiliateUrl: "https://ck.jp.ap.valuecommerce.com/xxxxx",
    landingPageUrl: "https://bulk-homme.example.com",
    itpSupport: true,
    cookieDuration: 60,
    isActive: true,
    priority: 1,
    approvalRate: 65,
    epc: 95,
    recommendedAnchors: ["BULK HOMMEの詳細を見る"],
  },
  {
    id: "asp-005",
    aspName: "felmat",
    programName: "AGA治療薬 オンライン処方",
    programId: "fm-aga-001",
    category: "aga",
    rewardAmount: 12000,
    rewardType: "fixed",
    conversionCondition: "初回処方完了",
    affiliateUrl: "https://t.felmat.net/xxxxx",
    landingPageUrl: "https://aga-online-rx.example.com",
    itpSupport: true,
    cookieDuration: 30,
    isActive: true,
    priority: 2,
    approvalRate: 78,
    epc: 280,
    recommendedAnchors: ["AGA治療薬の詳細を見る"],
  },
  {
    id: "asp-006",
    aspName: "a8",
    programName: "ゴリラクリニック ヒゲ脱毛",
    programId: "a8-hair-002",
    category: "hair-removal",
    rewardAmount: 18000,
    rewardType: "fixed",
    conversionCondition: "無料カウンセリング予約",
    affiliateUrl: "https://px.a8.net/yyyyy",
    landingPageUrl: "https://gorilla-clinic.example.com",
    itpSupport: true,
    cookieDuration: 60,
    isActive: false,
    priority: 3,
    approvalRate: 68,
    epc: 350,
    recommendedAnchors: ["ゴリラクリニックの詳細を見る"],
  },
  {
    id: "asp-007",
    aspName: "afb",
    programName: "メンズリゼ 全身脱毛",
    programId: "afb-hair-001",
    category: "hair-removal",
    rewardAmount: 25000,
    rewardType: "fixed",
    conversionCondition: "初回来店カウンセリング",
    affiliateUrl: "https://track.afb.jp/click/yyyyy",
    landingPageUrl: "https://mens-rize.example.com",
    itpSupport: true,
    cookieDuration: 30,
    isActive: true,
    priority: 1,
    approvalRate: 80,
    epc: 520,
    recommendedAnchors: ["メンズリゼの詳細を見る"],
  },
  {
    id: "asp-008",
    aspName: "accesstrade",
    programName: "AGAヘアクリニック オンライン診療",
    programId: "at-aga-001",
    category: "aga",
    rewardAmount: 10000,
    rewardType: "fixed",
    conversionCondition: "オンライン診療完了",
    affiliateUrl: "https://h.accesstrade.net/yyyyy",
    landingPageUrl: "https://agahair-clinic.example.com",
    itpSupport: true,
    cookieDuration: 30,
    isActive: true,
    priority: 2,
    approvalRate: 82,
    epc: 220,
    recommendedAnchors: ["AGAヘアクリニックの詳細を見る"],
  },
];

// ------------------------------------------------------------------
// Page component
// ------------------------------------------------------------------

export default function AdminAspPage() {
  const [filterAsp, setFilterAsp] = useState<AspName | "all">("all");
  const [filterCategory, setFilterCategory] = useState<ContentCategory | "all">("all");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [programs, setPrograms] = useState<AspProgram[]>(MOCK_PROGRAMS);

  const filteredPrograms = programs.filter((p) => {
    if (filterAsp !== "all" && p.aspName !== filterAsp) return false;
    if (filterCategory !== "all" && p.category !== filterCategory) return false;
    if (filterActive === "active" && !p.isActive) return false;
    if (filterActive === "inactive" && p.isActive) return false;
    return true;
  });

  const handleToggleItp = (id: string) => {
    setPrograms((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, itpSupport: !p.itpSupport } : p
      )
    );
  };

  const handleToggleActive = (id: string) => {
    setPrograms((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, isActive: !p.isActive } : p
      )
    );
  };

  // Summary stats
  const totalPrograms = programs.length;
  const activePrograms = programs.filter((p) => p.isActive).length;
  const itpSupportCount = programs.filter((p) => p.itpSupport).length;
  const avgEpc = programs.reduce((sum, p) => sum + (p.epc ?? 0), 0) / programs.length;

  return (
    <>
      <AdminHeader
        title="ASPリンク管理"
        breadcrumbs={[{ label: "ASP管理" }]}
      />

      {/* PR表記 notice */}
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-800">
              広告表示・PR表記について
            </p>
            <p className="mt-1 text-xs text-blue-700">
              ステマ規制に基づき、アフィリエイトリンクを含む全記事に「【PR】本記事には広告・アフィリエイトリンクが含まれています」のPR表記が自動挿入されます。
              ITP対応タグが有効なプログラムには各ASPの計測用スクリプトが自動で埋め込まれます。
            </p>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
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

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
        <div>
          <label htmlFor="filter-asp" className="mr-2 text-xs font-medium text-neutral-600">
            ASP:
          </label>
          <select
            id="filter-asp"
            value={filterAsp}
            onChange={(e) => setFilterAsp(e.target.value as AspName | "all")}
            className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          >
            <option value="all">すべて</option>
            {(Object.keys(ASP_DISPLAY_NAMES) as AspName[]).map((asp) => (
              <option key={asp} value={asp}>
                {ASP_DISPLAY_NAMES[asp]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-category" className="mr-2 text-xs font-medium text-neutral-600">
            カテゴリ:
          </label>
          <select
            id="filter-category"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as ContentCategory | "all")}
            className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          >
            <option value="all">すべて</option>
            {(Object.keys(CATEGORY_LABELS) as ContentCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-active" className="mr-2 text-xs font-medium text-neutral-600">
            ステータス:
          </label>
          <select
            id="filter-active"
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as "all" | "active" | "inactive")}
            className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
          >
            <option value="all">すべて</option>
            <option value="active">有効のみ</option>
            <option value="inactive">無効のみ</option>
          </select>
        </div>

        <div className="ml-auto text-sm text-neutral-500">
          {filteredPrograms.length} 件表示
        </div>
      </div>

      {/* Programs table */}
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="px-4 py-3 font-medium text-neutral-600">プログラム名</th>
              <th className="px-4 py-3 font-medium text-neutral-600">ASP</th>
              <th className="px-4 py-3 font-medium text-neutral-600">カテゴリ</th>
              <th className="px-4 py-3 font-medium text-neutral-600">報酬</th>
              <th className="px-4 py-3 font-medium text-neutral-600">成果条件</th>
              <th className="px-4 py-3 font-medium text-neutral-600">承認率</th>
              <th className="px-4 py-3 font-medium text-neutral-600">EPC</th>
              <th className="px-4 py-3 font-medium text-neutral-600">ITP</th>
              <th className="px-4 py-3 font-medium text-neutral-600">有効</th>
              <th className="px-4 py-3 font-medium text-neutral-600">優先度</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filteredPrograms.map((program) => {
              const aspColor = ({
                afb: "bg-purple-100 text-purple-700",
                a8: "bg-orange-100 text-orange-700",
                accesstrade: "bg-cyan-100 text-cyan-700",
                valuecommerce: "bg-emerald-100 text-emerald-700",
                felmat: "bg-pink-100 text-pink-700",
                moshimo: "bg-teal-100 text-teal-700",
              } as Record<AspName, string>)[program.aspName];

              return (
                <tr
                  key={program.id}
                  className={`hover:bg-neutral-50 ${!program.isActive ? "opacity-60" : ""}`}
                >
                  <td className="max-w-[200px] truncate px-4 py-3 font-medium text-neutral-900">
                    <div>
                      <p className="truncate">{program.programName}</p>
                      <p className="mt-0.5 truncate font-mono text-xs text-neutral-400">
                        {program.affiliateUrl.slice(0, 40)}...
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${aspColor}`}>
                      {ASP_DISPLAY_NAMES[program.aspName]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {CATEGORY_LABELS[program.category]}
                  </td>
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    {program.rewardAmount.toLocaleString()}円
                  </td>
                  <td className="max-w-[150px] truncate px-4 py-3 text-neutral-600">
                    {program.conversionCondition}
                  </td>
                  <td className="px-4 py-3">
                    {program.approvalRate != null ? (
                      <span
                        className={`text-sm font-medium ${
                          program.approvalRate >= 80
                            ? "text-green-700"
                            : program.approvalRate >= 60
                              ? "text-yellow-700"
                              : "text-red-700"
                        }`}
                      >
                        {program.approvalRate}%
                      </span>
                    ) : (
                      <span className="text-neutral-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {program.epc != null ? `${program.epc}円` : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleItp(program.id)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        program.itpSupport ? "bg-blue-500" : "bg-neutral-300"
                      }`}
                      aria-label={`ITP対応を${program.itpSupport ? "無効" : "有効"}にする`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                          program.itpSupport ? "translate-x-4.5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(program.id)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        program.isActive ? "bg-green-500" : "bg-neutral-300"
                      }`}
                      aria-label={`プログラムを${program.isActive ? "無効" : "有効"}にする`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                          program.isActive ? "translate-x-4.5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        program.priority === 1
                          ? "bg-yellow-100 text-yellow-800"
                          : program.priority === 2
                            ? "bg-neutral-100 text-neutral-600"
                            : "bg-neutral-50 text-neutral-400"
                      }`}
                    >
                      {program.priority}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredPrograms.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-sm text-neutral-500">
              条件に一致するプログラムがありません
            </p>
          </div>
        )}
      </div>

      {/* Category mapping section */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-neutral-800">
          カテゴリ別マッピング設定
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(CATEGORY_LABELS) as ContentCategory[])
            .filter((cat) => cat !== "column")
            .map((category) => {
              const categoryPrograms = programs.filter(
                (p) => p.category === category && p.isActive
              );
              const avgApproval =
                categoryPrograms.length > 0
                  ? Math.round(
                      categoryPrograms.reduce(
                        (sum, p) => sum + (p.approvalRate ?? 0),
                        0
                      ) / categoryPrograms.length
                    )
                  : 0;
              const totalReward = categoryPrograms.reduce(
                (sum, p) => sum + p.rewardAmount,
                0
              );

              return (
                <div
                  key={category}
                  className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-neutral-800">
                      {CATEGORY_LABELS[category]}
                    </h3>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                      {categoryPrograms.length}件
                    </span>
                  </div>

                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-neutral-500">有効プログラム</dt>
                      <dd className="font-medium text-neutral-900">
                        {categoryPrograms.length}件
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-neutral-500">平均承認率</dt>
                      <dd
                        className={`font-medium ${
                          avgApproval >= 80
                            ? "text-green-700"
                            : avgApproval >= 60
                              ? "text-yellow-700"
                              : "text-red-700"
                        }`}
                      >
                        {avgApproval}%
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-neutral-500">合計報酬</dt>
                      <dd className="font-medium text-neutral-900">
                        {totalReward.toLocaleString()}円
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-neutral-500">ITP対応率</dt>
                      <dd className="font-medium text-blue-700">
                        {categoryPrograms.length > 0
                          ? Math.round(
                              (categoryPrograms.filter((p) => p.itpSupport)
                                .length /
                                categoryPrograms.length) *
                                100
                            )
                          : 0}
                        %
                      </dd>
                    </div>
                  </dl>

                  {/* Programs list */}
                  <div className="mt-3 border-t border-neutral-100 pt-3">
                    <ul className="space-y-1">
                      {categoryPrograms
                        .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
                        .map((p) => (
                          <li
                            key={p.id}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="truncate text-neutral-600">
                              {p.programName}
                            </span>
                            <span className="ml-2 shrink-0 font-medium text-neutral-800">
                              {p.rewardAmount.toLocaleString()}円
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </>
  );
}
