/**
 * E-E-A-T プロンプト
 * Experience（経験）, Expertise（専門性）, Authoritativeness（権威性）,
 * Trustworthiness（信頼性）対応の指示
 * YMYL（Your Money or Your Life）コンテンツとしての品質基準
 */

import type { AuthorInfo, Reference } from "@/types/content";

/** E-E-A-T 指示プロンプト定数 */
const EEAT_INSTRUCTIONS = `
## E-E-A-T・YMYL品質基準（必須）

本メディアのコンテンツは医療・美容・健康に関するYMYL（Your Money or Your Life）コンテンツです。
Googleの品質評価基準「E-E-A-T」を満たすため、以下を必ず実施してください。

### Experience（経験）
- 実際の体験談・ユーザーレビューを参照する場合は出典を明示
- 「〇〇を実際に試した」等の一人称表現を使う場合は根拠を示す
- 臨床データや治療実績がある場合は具体的な数値を引用（出典付き）

### Expertise（専門性）
- 医学用語は正確に使用し、初出時に一般向けの説明を付記
- 治療薬の記述には薬剤師・医師監修の専門知識を反映
- カテゴリ専門のガイドライン・学会情報を参照・引用する

### Authoritativeness（権威性）
- 厚生労働省、日本皮膚科学会、日本泌尿器科学会等の公的機関・学会の情報を引用
- PubMedに収録された臨床試験（RCT）の結果を引用
- 監修者プロフィールには資格・専門領域を明記

### Trustworthiness（信頼性）
- 記事には必ず「公開日」「最終更新日」を記載
- 価格・サービス情報には「※情報は〇〇年〇〇月時点のものです」と付記
- コンプライアンス表記（薬機法・景表法・ステマ規制）を厳守
- 参考文献は信頼性の高いものを優先（学術論文 > 公的機関 > 業界団体 > 一般メディア）
`.trim();

/** 監修者プロフィールテンプレート */
const SUPERVISOR_PROFILE_TEMPLATES: Record<string, AuthorInfo> = {
  dermatologist: {
    name: "監修医師（皮膚科専門医）",
    credentials: "日本皮膚科学会認定 皮膚科専門医",
    bio: "皮膚科専門医として〇〇年以上の診療経験を持ち、AGA・スキンケア領域を専門とする。〇〇大学医学部卒業。",
    imageUrl: undefined,
  },
  urologist: {
    name: "監修医師（泌尿器科専門医）",
    credentials: "日本泌尿器科学会認定 泌尿器科専門医",
    bio: "泌尿器科専門医として〇〇年以上の診療経験を持ち、ED・メンズヘルス領域を専門とする。〇〇大学医学部卒業。",
    imageUrl: undefined,
  },
  pharmacist: {
    name: "監修薬剤師",
    credentials: "薬剤師（薬局勤務）",
    bio: "薬剤師として〇〇年以上の調剤・服薬指導経験を持ち、AGA治療薬・ED治療薬の専門知識を有する。〇〇薬科大学卒業。",
    imageUrl: undefined,
  },
};

/** 推奨参考文献リスト（カテゴリ別） */
const RECOMMENDED_REFERENCES: Record<string, Reference[]> = {
  aga: [
    {
      title: "男性型および女性型脱毛症診療ガイドライン 2017年版",
      url: "https://www.dermatol.or.jp/uploads/uploads/files/guideline/AGA_GL2017.pdf",
      source: "日本皮膚科学会",
      year: 2017,
    },
    {
      title: "Finasteride in the treatment of men with androgenetic alopecia",
      url: "https://pubmed.ncbi.nlm.nih.gov/9777765/",
      author: "Kaufman KD, et al.",
      source: "Journal of the American Academy of Dermatology",
      year: 1998,
    },
    {
      title: "プロペシア錠1mg 添付文書",
      url: "https://www.pmda.go.jp/PmdaSearch/iyakuDetail/ResultDataSetPDF/780046_4240006F1022_1_11",
      source: "独立行政法人 医薬品医療機器総合機構（PMDA）",
    },
  ],
  "hair-removal": [
    {
      title: "レーザー脱毛に関するガイドライン",
      url: "https://www.jslsm.gr.jp/",
      source: "日本レーザー医学会",
    },
    {
      title: "脱毛サービスに関する消費者庁の注意喚起",
      url: "https://www.caa.go.jp/policies/policy/consumer_safety/release/2016/pdf/consumer_safety_cms204_160330_01.pdf",
      source: "消費者庁",
      year: 2016,
    },
  ],
  skincare: [
    {
      title: "ニキビ（尋常性痤瘡）治療ガイドライン",
      url: "https://www.dermatol.or.jp/uploads/uploads/files/guideline/1533175225_1.pdf",
      source: "日本皮膚科学会",
      year: 2017,
    },
    {
      title: "化粧品の効能の範囲について",
      url: "https://www.mhlw.go.jp/file/06-Seisakujouhou-11120000-Iyakushokuhinkyoku/0000196937.pdf",
      source: "厚生労働省",
    },
  ],
  ed: [
    {
      title: "勃起障害診療ガイドライン",
      url: "https://www.urol.or.jp/lib/files/other/guideline/36_ed.pdf",
      source: "日本泌尿器科学会",
      year: 2018,
    },
    {
      title: "バイアグラ錠25mg・50mg 添付文書",
      url: "https://www.pmda.go.jp/",
      source: "独立行政法人 医薬品医療機器総合機構（PMDA）",
    },
  ],
};

/**
 * E-E-A-T プロンプト全体を取得する
 */
export function getEEATPrompt(): string {
  return EEAT_INSTRUCTIONS;
}

/**
 * 監修者プロフィールテンプレートを取得する
 * @param type 監修者タイプ
 */
export function getSupervisorTemplate(
  type: keyof typeof SUPERVISOR_PROFILE_TEMPLATES
): AuthorInfo {
  return { ...SUPERVISOR_PROFILE_TEMPLATES[type] };
}

/**
 * カテゴリ別推奨参考文献を取得する
 * @param category カテゴリ
 */
export function getRecommendedReferences(category: string): Reference[] {
  return [...(RECOMMENDED_REFERENCES[category] ?? [])];
}

/**
 * E-E-A-T 必須要素の挿入指示プロンプトを構築する
 * @param category コンテンツカテゴリ
 * @param publishedAt 公開日
 * @param updatedAt 更新日
 */
export function buildEEATPrompt(
  category: string,
  publishedAt: string,
  updatedAt: string
): string {
  const refs = getRecommendedReferences(category);
  const refList = refs.map((r, i) => `${i + 1}. ${r.title} — ${r.source ?? ""} ${r.url}`).join("\n");

  return `${EEAT_INSTRUCTIONS}

## 記事固有のE-E-A-T情報

### 日付情報（必須記載）
- 公開日: ${publishedAt}
- 最終更新日: ${updatedAt}
- 情報の鮮度に関する注記: 「※本記事の情報は${updatedAt.slice(0, 7)}時点のものです。最新情報は公式サイト・医療機関でご確認ください。」

### 監修者プロフィール（{{SUPERVISOR_INFO}} プレースホルダーを以下で置換）
- カテゴリ「${category}」の監修は皮膚科専門医または泌尿器科専門医が適切です
- プロフィールには氏名・資格・診療経験年数・専門領域を明記してください

### 参考文献（推奨）
以下の参考文献を記事に含めることを推奨します:
${refList}

### 必須チェックリスト
- [ ] 記事冒頭にPR表記が含まれているか
- [ ] 監修者情報（氏名・資格）が明記されているか
- [ ] 参考文献（最低3件以上）が記載されているか
- [ ] 公開日・最終更新日が明記されているか
- [ ] 薬機法NG表現が含まれていないか
- [ ] 最大級表現に根拠（調査日時・条件）が付いているか`;
}
