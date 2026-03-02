/**
 * 読了時間計算ユーティリティ
 * 日本語: 500文字/分、英語: 200単語/分として計算
 */

/** 読了時間計算設定 */
export interface ReadingTimeOptions {
  /** 日本語の読速（文字/分）デフォルト: 500 */
  japaneseCharsPerMinute?: number;
  /** 英語の読速（単語/分）デフォルト: 200 */
  englishWordsPerMinute?: number;
  /** 最低表示時間（分）デフォルト: 1 */
  minMinutes?: number;
}

/** 読了時間結果 */
export interface ReadingTimeResult {
  /** 読了時間（分、切り上げ） */
  minutes: number;
  /** 読了時間（秒） */
  seconds: number;
  /** 日本語文字数（半角スペース・改行を除く） */
  japaneseCharCount: number;
  /** 英単語数 */
  englishWordCount: number;
  /** 総文字数（スペース・改行を含む） */
  totalCharCount: number;
  /** 表示用テキスト（例: 「約3分で読めます」） */
  displayText: string;
}

/**
 * 日本語文字数をカウントする（英単語・記号を除く）
 * @param text 対象テキスト
 */
function countJapaneseChars(text: string): number {
  // ASCII文字（英数字・記号・スペース）と制御文字を除去し、日本語文字数を返す
  const withoutAscii = text.replace(/[\x00-\x7F]/g, "");
  return withoutAscii.length;
}

/**
 * 英単語数をカウントする
 * @param text 対象テキスト
 */
function countEnglishWords(text: string): number {
  // 英語の単語（連続するアルファベット）を抽出してカウント
  const words = text.match(/[a-zA-Z]+/g);
  return words ? words.length : 0;
}

/**
 * マークダウンの記法文字を除去してプレーンテキストを取得する
 * @param markdown マークダウンテキスト
 */
function stripMarkdown(markdown: string): string {
  return markdown
    // コードブロック除去
    .replace(/```[\s\S]*?```/g, "")
    // インラインコード除去
    .replace(/`[^`]*`/g, "")
    // 見出し記号除去（#, ##, etc.）
    .replace(/^#{1,6}\s+/gm, "")
    // リンク記法 → テキストのみ
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // 画像記法除去
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    // 強調記法除去（**bold**, *italic*, ~~strike~~）
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    // HTMLタグ除去
    .replace(/<[^>]+>/g, "")
    // 水平線除去
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // リスト記号除去
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // 引用記号除去
    .replace(/^>\s+/gm, "")
    // テーブル区切り除去
    .replace(/^\|?[-: |]+\|?\s*$/gm, "")
    // 余分な改行・スペース除去
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * テキストの読了時間を計算する
 * @param text 対象テキスト（マークダウン可）
 * @param options 計算オプション
 * @returns 読了時間結果
 *
 * @example
 * ```ts
 * const result = calculateReadingTime("これは日本語のサンプルテキストです。約3分で読めます。");
 * console.log(result.displayText); // "約1分で読めます"
 * console.log(result.minutes);     // 1
 * ```
 */
export function calculateReadingTime(
  text: string,
  options: ReadingTimeOptions = {}
): ReadingTimeResult {
  const {
    japaneseCharsPerMinute = 500,
    englishWordsPerMinute = 200,
    minMinutes = 1,
  } = options;

  // マークダウン記法を除去
  const plainText = stripMarkdown(text);

  const japaneseCharCount = countJapaneseChars(plainText);
  const englishWordCount = countEnglishWords(plainText);
  const totalCharCount = plainText.length;

  // 読了時間を秒単位で計算（日本語 + 英語）
  const japaneseSeconds = (japaneseCharCount / japaneseCharsPerMinute) * 60;
  const englishSeconds = (englishWordCount / englishWordsPerMinute) * 60;
  const totalSeconds = Math.round(japaneseSeconds + englishSeconds);

  // 分に変換（切り上げ、最低1分）
  const rawMinutes = Math.ceil(totalSeconds / 60);
  const minutes = Math.max(rawMinutes, minMinutes);

  const displayText = `約${minutes}分で読めます`;

  return {
    minutes,
    seconds: totalSeconds,
    japaneseCharCount,
    englishWordCount,
    totalCharCount,
    displayText,
  };
}

/**
 * 文字数から読了時間（分）を計算するシンプル版
 * @param charCount 文字数（日本語換算）
 * @param charsPerMinute 読速（文字/分）デフォルト: 500
 * @returns 読了時間（分、切り上げ）
 */
export function charCountToMinutes(charCount: number, charsPerMinute = 500): number {
  return Math.max(1, Math.ceil(charCount / charsPerMinute));
}
