/**
 * テキスト処理ユーティリティ
 * 文字数カウント、要約（先頭N文字抽出）、テキスト正規化など
 */

// ============================================================
// 文字数カウント
// ============================================================

/** 文字数カウントオプション */
export interface CharCountOptions {
  /** スペース・改行を文字数に含めるか（デフォルト: false） */
  includeWhitespace?: boolean;
  /** マークダウン記法の記号を文字数に含めるか（デフォルト: false） */
  includeMarkdownSyntax?: boolean;
}

/**
 * マークダウン記法（記号）を除去してプレーンテキストを返す
 * @param markdown マークダウンテキスト
 */
export function stripMarkdownSyntax(markdown: string): string {
  return markdown
    // コードブロック除去
    .replace(/```[\s\S]*?```/g, "")
    // インラインコード除去
    .replace(/`[^`]*`/g, "")
    // 見出し記号
    .replace(/^#{1,6}\s+/gm, "")
    // リンク記法 → テキストのみ
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // 画像記法除去
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    // 強調（**bold**, *italic*）
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    // 打ち消し（~~text~~）
    .replace(/~~(.*?)~~/g, "$1")
    // HTMLタグ除去
    .replace(/<[^>]+>/g, "")
    // 水平線除去
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // リスト記号除去
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // 引用記号除去
    .replace(/^>\s*/gm, "")
    // テーブル区切り行除去
    .replace(/^\|?[-: |]+\|?\s*$/gm, "")
    // テーブルのパイプを空白に
    .replace(/\|/g, " ");
}

/**
 * テキストの文字数をカウントする
 * @param text 対象テキスト（マークダウン可）
 * @param options カウントオプション
 * @returns 文字数
 *
 * @example
 * ```ts
 * countChars("こんにちは、世界！"); // 9
 * countChars("  hello  ", { includeWhitespace: false }); // 5
 * ```
 */
export function countChars(text: string, options: CharCountOptions = {}): number {
  const { includeWhitespace = false, includeMarkdownSyntax = false } = options;

  let processed = includeMarkdownSyntax ? text : stripMarkdownSyntax(text);

  if (!includeWhitespace) {
    // スペース（半角・全角）・タブ・改行を除去
    processed = processed.replace(/[\s　]/g, "");
  }

  return processed.length;
}

/**
 * テキストの行数をカウントする
 * @param text 対象テキスト
 * @param excludeEmpty 空行を除外するか（デフォルト: false）
 */
export function countLines(text: string, excludeEmpty = false): number {
  const lines = text.split("\n");
  if (excludeEmpty) {
    return lines.filter((line) => line.trim().length > 0).length;
  }
  return lines.length;
}

// ============================================================
// テキスト抽出・要約
// ============================================================

/** 抽出オプション */
export interface ExcerptOptions {
  /** 抽出する最大文字数（デフォルト: 120） */
  maxLength?: number;
  /** 末尾に付ける省略記号（デフォルト: "…"） */
  suffix?: string;
  /** 単語の途中で切らないよう句読点・文末で区切るか（デフォルト: true） */
  breakOnSentence?: boolean;
  /** マークダウン記法を除去するか（デフォルト: true） */
  stripMarkdown?: boolean;
}

/**
 * テキストの先頭N文字を抽出して要約を生成する
 * メタディスクリプションや一覧ページの抜粋に使用する
 * @param text 対象テキスト
 * @param options 抽出オプション
 * @returns 要約テキスト
 *
 * @example
 * ```ts
 * const excerpt = extractExcerpt(
 *   "AGAとは男性型脱毛症のことです。フィナステリドやミノキシジルによる治療が一般的です。",
 *   { maxLength: 30 }
 * );
 * // "AGAとは男性型脱毛症のことです。"
 * ```
 */
export function extractExcerpt(text: string, options: ExcerptOptions = {}): string {
  const {
    maxLength = 120,
    suffix = "…",
    breakOnSentence = true,
    stripMarkdown: shouldStrip = true,
  } = options;

  let processed = shouldStrip ? stripMarkdownSyntax(text) : text;
  // 余分な空白・改行を正規化
  processed = processed.replace(/\s+/g, " ").trim();

  if (processed.length <= maxLength) {
    return processed;
  }

  if (!breakOnSentence) {
    return processed.slice(0, maxLength) + suffix;
  }

  // 句読点・文末記号（。！？.!?）でできるだけ自然に区切る
  const truncated = processed.slice(0, maxLength);
  const sentenceEndRegex = /[。！？.!?]/g;
  let lastSentenceEnd = -1;
  let match: RegExpExecArray | null;

  while ((match = sentenceEndRegex.exec(truncated)) !== null) {
    lastSentenceEnd = match.index + 1;
  }

  if (lastSentenceEnd > 0) {
    return truncated.slice(0, lastSentenceEnd);
  }

  // 句読点がない場合は単純切り取り
  return truncated + suffix;
}

// ============================================================
// テキスト正規化
// ============================================================

/**
 * 全角英数字を半角に変換する
 * @param text 対象テキスト
 */
export function normalizeFullWidth(text: string): string {
  return text.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );
}

/**
 * 連続するスペース・改行を正規化する
 * @param text 対象テキスト
 * @param maxNewlines 許容する最大連続改行数（デフォルト: 2）
 */
export function normalizeWhitespace(text: string, maxNewlines = 2): string {
  // 行末の余分なスペースを除去
  let result = text.replace(/[ \t]+$/gm, "");
  // 連続する改行を制限
  const newlinePattern = new RegExp(`\n{${maxNewlines + 1},}`, "g");
  result = result.replace(newlinePattern, "\n".repeat(maxNewlines));
  // 先頭・末尾の空白を除去
  return result.trim();
}

/** 日本語→英語のスラッグ変換用辞書 */
const SLUG_DICT: Record<string, string> = {
  治療: "treatment", クリニック: "clinic", 比較: "comparison",
  費用: "cost", 相場: "price", 効果: "effect", 副作用: "side-effects",
  おすすめ: "recommended", ランキング: "ranking", 口コミ: "reviews",
  選び方: "guide", 原因: "causes", 対策: "solutions", 予防: "prevention",
  オンライン: "online", 診療: "medical", 処方: "prescription",
  薄毛: "hair-loss", 脱毛: "hair-removal", 発毛: "hair-growth",
  育毛: "hair-care", スキンケア: "skincare", 美容: "beauty",
  メンズ: "mens", 男性: "mens", 医療: "medical", 保険: "insurance",
  価格: "price", 安い: "affordable", 最新: "latest", 徹底: "thorough",
  解説: "explained", 完全: "complete", ガイド: "guide", まとめ: "summary",
  体験: "experience", レビュー: "review", 初心者: "beginner",
};

/**
 * スラッグ生成（URLセーフな英語文字列に変換）
 * 日本語テキストは辞書ベースで英語に変換し、変換不能な文字は除去する
 * @param text 変換対象テキスト
 */
export function slugify(text: string): string {
  let result = text.toLowerCase();

  // 全角英数を半角に変換
  result = result.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  // 日本語キーワードを英語に変換
  for (const [ja, en] of Object.entries(SLUG_DICT)) {
    result = result.replace(new RegExp(ja, "g"), ` ${en} `);
  }

  return result
    // スペース・アンダースコアをハイフンに変換
    .replace(/[\s_　]+/g, "-")
    // ASCII英数字とハイフン以外を除去
    .replace(/[^a-z0-9-]/g, "")
    // 連続するハイフンを1つに
    .replace(/-{2,}/g, "-")
    // 先頭・末尾のハイフンを除去
    .replace(/^-+|-+$/g, "")
    // 128文字に制限
    .slice(0, 128);
}

// ============================================================
// テキスト検証
// ============================================================

/**
 * テキストが指定文字数範囲内かチェックする
 * @param text 対象テキスト
 * @param min 最小文字数
 * @param max 最大文字数
 * @param options カウントオプション
 */
export function isWithinLength(
  text: string,
  min: number,
  max: number,
  options: CharCountOptions = {}
): boolean {
  const count = countChars(text, options);
  return count >= min && count <= max;
}

/**
 * SEOメタディスクリプションの文字数が適切かチェックする（120文字以内）
 * @param description メタディスクリプション
 */
export function isValidMetaDescription(description: string): {
  isValid: boolean;
  charCount: number;
  message: string;
} {
  const charCount = countChars(description);
  const isValid = charCount > 0 && charCount <= 120;
  const message = isValid
    ? `文字数OK（${charCount}文字）`
    : charCount === 0
    ? "メタディスクリプションが空です"
    : `文字数超過（${charCount}文字 / 最大120文字）`;

  return { isValid, charCount, message };
}

/**
 * SEOタイトルの文字数が適切かチェックする（30〜35文字推奨）
 * @param title タイトル
 */
export function isValidSEOTitle(title: string): {
  isValid: boolean;
  charCount: number;
  message: string;
} {
  const charCount = countChars(title);
  const isValid = charCount >= 30 && charCount <= 35;
  const message = isValid
    ? `文字数OK（${charCount}文字）`
    : charCount < 30
    ? `文字数不足（${charCount}文字 / 推奨30〜35文字）`
    : `文字数超過（${charCount}文字 / 推奨30〜35文字）`;

  return { isValid, charCount, message };
}
