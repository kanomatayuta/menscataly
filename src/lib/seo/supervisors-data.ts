/**
 * 監修者マスターデータ
 *
 * 監修者ページおよび構造化データ (Person) で使用する。
 * カテゴリ別に管理し、E-E-A-T の信頼性シグナルとして表示。
 *
 * ※ 実際の監修者名は契約後に差し替え。テンプレート値を使用。
 */

// ============================================================
// 型定義
// ============================================================

export interface Supervisor {
  /** 一意 ID (URL パス用) */
  id: string;
  /** 監修者名 */
  name: string;
  /** 資格・役職 */
  credentials: string;
  /** 専門分野 */
  specialty: string;
  /** カテゴリスラッグ */
  category: string;
  /** カテゴリ表示名 */
  categoryLabel: string;
  /** プロフィール概要 */
  bio: string;
  /** 所属組織 */
  affiliations: string[];
  /** プロフィール画像 URL (プレースホルダー) */
  imageUrl?: string;
  /** 経験年数 */
  yearsOfExperience: number;
  /** 監修対象記事テーマ */
  topics: string[];
}

// ============================================================
// 監修者データ
// ============================================================

export const SUPERVISORS: Supervisor[] = [
  // --- AGA ---
  {
    id: "aga-dr-tanaka",
    name: "田中 健太郎",
    credentials: "日本皮膚科学会認定 皮膚科専門医",
    specialty: "AGA治療・男性型脱毛症",
    category: "aga",
    categoryLabel: "AGA・薄毛",
    bio: "皮膚科専門医として15年以上の診療経験を持ち、AGA（男性型脱毛症）・薄毛治療を専門とする。東京大学医学部卒業。日本皮膚科学会、日本毛髪科学協会所属。AGAガイドラインに基づく最新のエビデンスを重視した治療を実践。",
    affiliations: ["日本皮膚科学会", "日本毛髪科学協会"],
    yearsOfExperience: 15,
    topics: [
      "AGA治療薬（フィナステリド・デュタステリド）",
      "ミノキシジル外用・内服",
      "HARG療法",
      "植毛",
      "薄毛の原因と対策",
    ],
  },
  // --- ED ---
  {
    id: "ed-dr-suzuki",
    name: "鈴木 雅之",
    credentials: "日本泌尿器科学会認定 泌尿器科専門医",
    specialty: "ED治療・メンズヘルス",
    category: "ed",
    categoryLabel: "ED治療",
    bio: "泌尿器科専門医として18年以上の診療経験を持ち、ED（勃起不全）・メンズヘルス領域を専門とする。慶應義塾大学医学部卒業。日本泌尿器科学会、日本性機能学会所属。患者の生活の質を重視した包括的なED治療を行う。",
    affiliations: ["日本泌尿器科学会", "日本性機能学会"],
    yearsOfExperience: 18,
    topics: [
      "PDE5阻害薬（シルデナフィル・タダラフィル・バルデナフィル）",
      "ED治療オンライン診療",
      "男性更年期障害",
      "テストステロン補充療法",
    ],
  },
  // --- 医療脱毛 ---
  {
    id: "hair-removal-dr-yamamoto",
    name: "山本 美咲",
    credentials: "日本皮膚科学会認定 皮膚科専門医 / 日本レーザー医学会認定レーザー専門医",
    specialty: "医療レーザー脱毛",
    category: "hair-removal",
    categoryLabel: "医療脱毛",
    bio: "皮膚科専門医・レーザー専門医として12年以上の診療経験を持ち、医療レーザー脱毛を専門とする。大阪大学医学部卒業。日本皮膚科学会、日本レーザー医学会、日本美容皮膚科学会所属。メンズ脱毛の安全性と効果に精通。",
    affiliations: ["日本皮膚科学会", "日本レーザー医学会", "日本美容皮膚科学会"],
    yearsOfExperience: 12,
    topics: [
      "医療レーザー脱毛（アレキサンドライト・ダイオード・YAG）",
      "メンズ脱毛（ヒゲ・VIO・全身）",
      "脱毛機器の比較",
      "脱毛後のスキンケア",
    ],
  },
  // --- スキンケア ---
  {
    id: "skincare-dr-sato",
    name: "佐藤 裕美",
    credentials: "日本皮膚科学会認定 皮膚科専門医",
    specialty: "スキンケア・美容皮膚科",
    category: "skincare",
    categoryLabel: "スキンケア",
    bio: "皮膚科専門医として10年以上の診療経験を持ち、ニキビ治療・シミ治療・エイジングケアを専門とする。京都大学医学部卒業。日本皮膚科学会、日本美容皮膚科学会所属。化粧品の成分・安全性にも精通し、科学的根拠に基づくスキンケア指導を行う。",
    affiliations: ["日本皮膚科学会", "日本美容皮膚科学会"],
    yearsOfExperience: 10,
    topics: [
      "メンズスキンケア基礎",
      "ニキビ治療",
      "シミ・くすみ対策",
      "エイジングケア",
      "日焼け止め・紫外線対策",
    ],
  },
  // --- コラム / サプリメント ---
  {
    id: "column-writer-kobayashi",
    name: "小林 誠",
    credentials: "管理栄養士 / 薬剤師",
    specialty: "栄養指導・サプリメント",
    category: "column",
    categoryLabel: "コラム・サプリメント",
    bio: "管理栄養士・薬剤師として13年以上の栄養指導・服薬指導経験を持つ。北海道大学薬学部卒業。日本栄養士会、日本薬剤師会所属。サプリメントの成分・安全性・相互作用に精通し、科学的根拠に基づく情報発信を行う。",
    affiliations: ["日本栄養士会", "日本薬剤師会"],
    yearsOfExperience: 13,
    topics: [
      "サプリメントの選び方",
      "育毛サプリメント",
      "メンズ健康全般",
      "機能性表示食品",
      "医薬品との相互作用",
    ],
  },
];

// ============================================================
// ヘルパー関数
// ============================================================

/** ID から監修者を取得 */
export function getSupervisorById(id: string): Supervisor | undefined {
  return SUPERVISORS.find((s) => s.id === id);
}

/** カテゴリスラッグから監修者を取得 */
export function getSupervisorsByCategory(category: string): Supervisor[] {
  return SUPERVISORS.filter((s) => s.category === category);
}

/** 全監修者IDを取得 (generateStaticParams 用) */
export function getAllSupervisorIds(): string[] {
  return SUPERVISORS.map((s) => s.id);
}

/** カテゴリ別にグループ化 */
export function getSupervisorsGroupedByCategory(): Record<string, Supervisor[]> {
  const grouped: Record<string, Supervisor[]> = {};
  for (const supervisor of SUPERVISORS) {
    if (!grouped[supervisor.category]) {
      grouped[supervisor.category] = [];
    }
    grouped[supervisor.category].push(supervisor);
  }
  return grouped;
}
