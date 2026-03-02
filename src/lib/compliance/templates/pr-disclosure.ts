/**
 * PR表記・アフィリエイト開示テンプレート
 * ステマ規制（2023年10月施行）対応
 */

import type { PRDisclosureTemplate } from "../types";

/**
 * カテゴリ別PR表記テンプレート
 */
export const PR_TEMPLATES: Record<string, PRDisclosureTemplate> = {
  /** アフィリエイト標準表記 */
  affiliate_standard: {
    type: "affiliate",
    text: "※本記事はアフィリエイト広告（成果報酬型広告）を含みます。記事内で紹介するサービス・商品へのリンクからご購入・ご契約いただいた場合、当サイトに報酬が発生することがあります。ただし、紹介内容はサービスの品質に基づいた独自の評価であり、広告主からの指示・依頼によるものではありません。",
    position: "top",
  },

  /** 医療系コンテンツ向けPR表記 */
  medical_affiliate: {
    type: "affiliate",
    text: "※本記事はアフィリエイト広告を含む医療情報です。記事内で紹介するクリニック・治療法の選択にあたっては、必ず担当医師にご相談ください。当サイトは医療行為を推奨するものではありません。",
    position: "top",
  },

  /** 簡易PR表記（記事冒頭・目立つ位置用） */
  short_pr: {
    type: "pr",
    text: "【PR】本記事はアフィリエイト広告を含みます",
    position: "top",
  },

  /** スポンサード記事表記 */
  sponsored: {
    type: "sponsored",
    text: "【スポンサード】本記事は〇〇様の提供でお届けします",
    position: "top",
  },

  /** 記事末尾の免責事項テンプレート */
  disclaimer_bottom: {
    type: "advertisement",
    text: [
      "## 免責事項・広告表記",
      "",
      "- 本記事はアフィリエイト広告（成果報酬型広告）を含みます",
      "- 記事内の価格・情報は執筆時点（YYYY年MM月DD日）のものです。最新情報は各公式サイトでご確認ください",
      "- 医療・美容に関する情報は個人差があります。治療・施術の判断は必ず医師にご相談ください",
      "- 効果・効能には個人差があり、必ずしも同様の結果を保証するものではありません",
    ].join("\n"),
    position: "bottom",
  },
};

/**
 * 記事テキストにPR表記を挿入する
 */
export function insertPRDisclosure(
  text: string,
  templateKey: keyof typeof PR_TEMPLATES = "affiliate_standard",
  currentDate?: Date
): string {
  const template = PR_TEMPLATES[templateKey];
  if (!template) {
    throw new Error(`PR template "${templateKey}" not found`);
  }

  const date = currentDate ?? new Date();
  const dateStr = `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, "0")}月${String(date.getDate()).padStart(2, "0")}日`;
  const processedText = template.text.replace(/YYYY年MM月DD日/g, dateStr);

  if (template.position === "top") {
    return `${processedText}\n\n${text}`;
  } else if (template.position === "bottom") {
    return `${text}\n\n${processedText}`;
  } else {
    return `${processedText}\n\n${text}\n\n${PR_TEMPLATES.disclaimer_bottom.text.replace(/YYYY年MM月DD日/g, dateStr)}`;
  }
}

/**
 * 記事がPR表記を含むか検証する
 */
export function hasPRDisclosure(text: string): boolean {
  const prPatterns = [
    /【PR】/,
    /【スポンサード】/,
    /アフィリエイト広告/,
    /成果報酬型広告/,
    /広告を含みます/,
    /PR.*含む/i,
    /\[PR\]/i,
    /\(PR\)/i,
  ];
  return prPatterns.some((p) => p.test(text));
}
