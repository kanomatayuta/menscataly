/**
 * 目次（ToC）自動生成ユーティリティ
 * マークダウンテキストから H2/H3 見出しを抽出し、階層化した目次を生成する
 */

import type { HeadingLevel, TocItem } from "@/types/content";

/** 目次生成オプション */
export interface TocGeneratorOptions {
  /** 含める見出しレベル（デフォルト: ["h2", "h3"]） */
  includeLevels?: HeadingLevel[];
  /** アンカーIDに使用するスラッグ化関数（カスタム可） */
  slugify?: (text: string) => string;
  /** 最大ネスト深度（デフォルト: 2） */
  maxDepth?: number;
}

/** 内部パース用の見出しアイテム（フラット） */
interface FlatHeading {
  level: HeadingLevel;
  text: string;
  id: string;
}

/**
 * 見出しテキストをアンカーID用スラッグに変換する（デフォルト実装）
 * @param text 見出しテキスト
 */
function defaultSlugify(text: string): string {
  return text
    // マークダウン記法除去（**bold**, *italic*等）
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    // HTMLタグ除去
    .replace(/<[^>]+>/g, "")
    // インラインコード除去
    .replace(/`([^`]*)`/g, "$1")
    // 日本語文字はそのまま残す（URLエンコードは呼び出し元に委ねる）
    // 半角英数は小文字化
    .toLowerCase()
    // スペース・特殊文字をハイフンに変換
    .replace(/[\s　]+/g, "-")
    // 先頭・末尾のハイフン除去
    .replace(/^-+|-+$/g, "")
    // 連続するハイフンを1つに
    .replace(/-{2,}/g, "-");
}

/**
 * マークダウンテキストから見出しをフラットなリストで抽出する
 * @param markdown マークダウンテキスト
 * @param includeLevels 含める見出しレベル
 * @param slugify スラッグ化関数
 */
function extractHeadings(
  markdown: string,
  includeLevels: HeadingLevel[],
  slugify: (text: string) => string
): FlatHeading[] {
  const headings: FlatHeading[] = [];
  const idCount = new Map<string, number>();

  // コードブロックを除外してから処理（コード内の#を誤検知しない）
  const withoutCodeBlocks = markdown.replace(/```[\s\S]*?```/g, "");

  const lines = withoutCodeBlocks.split("\n");

  for (const line of lines) {
    // ATX形式の見出しをマッチ（# H1 / ## H2 / ### H3 / #### H4）
    const match = line.match(/^(#{1,4})\s+(.+?)\s*(?:#*)?\s*$/);
    if (!match) continue;

    const hashes = match[1];
    const rawText = match[2];

    const levelMap: Record<number, HeadingLevel | undefined> = {
      1: undefined, // H1 は通常記事タイトルのため除外
      2: "h2",
      3: "h3",
      4: "h4",
    };

    const level = levelMap[hashes.length];
    if (!level || !includeLevels.includes(level)) continue;

    // スラッグ化してID生成（重複する場合は連番付与）
    const baseId = slugify(rawText);
    const count = idCount.get(baseId) ?? 0;
    const id = count === 0 ? baseId : `${baseId}-${count}`;
    idCount.set(baseId, count + 1);

    headings.push({ level, text: rawText, id });
  }

  return headings;
}

/**
 * フラットな見出しリストをネスト構造に変換する
 * @param flatHeadings フラットな見出しリスト
 * @param maxDepth 最大ネスト深度
 */
function nestHeadings(flatHeadings: FlatHeading[], maxDepth: number): TocItem[] {
  const root: TocItem[] = [];
  const stack: Array<{ item: TocItem; level: number }> = [];

  for (const heading of flatHeadings) {
    const levelNum = parseInt(heading.level.slice(1), 10);
    const depth = levelNum - 2; // H2 = depth 0, H3 = depth 1, H4 = depth 2

    if (depth >= maxDepth) continue;

    const newItem: TocItem = {
      text: heading.text,
      id: heading.id,
      level: heading.level,
      children: [],
    };

    // スタックを巻き戻す（現在の見出しより深いスタックエントリを除去）
    while (stack.length > 0 && stack[stack.length - 1].level >= levelNum) {
      stack.pop();
    }

    if (stack.length === 0) {
      // トップレベル（H2）
      root.push(newItem);
    } else {
      // 親アイテムのchildrenに追加
      const parent = stack[stack.length - 1].item;
      if (!parent.children) parent.children = [];
      parent.children.push(newItem);
    }

    stack.push({ item: newItem, level: levelNum });
  }

  // 空のchildrenを削除
  const cleanChildren = (items: TocItem[]): TocItem[] =>
    items.map((item) => ({
      ...item,
      children:
        item.children && item.children.length > 0
          ? cleanChildren(item.children)
          : undefined,
    }));

  return cleanChildren(root);
}

/**
 * マークダウンテキストから目次を自動生成する
 * @param markdown マークダウンテキスト
 * @param options 生成オプション
 * @returns 目次アイテムの階層リスト
 *
 * @example
 * ```ts
 * const markdown = `
 * ## AGA治療とは
 * ### フィナステリドの効果
 * ### ミノキシジルとの違い
 * ## クリニックの選び方
 * ### 費用の比較
 * `;
 * const toc = generateToc(markdown);
 * // [
 * //   { text: "AGA治療とは", id: "aga治療とは", level: "h2", children: [
 * //     { text: "フィナステリドの効果", id: "フィナステリドの効果", level: "h3" },
 * //     { text: "ミノキシジルとの違い", id: "ミノキシジルとの違い", level: "h3" },
 * //   ]},
 * //   { text: "クリニックの選び方", id: "クリニックの選び方", level: "h2", children: [
 * //     { text: "費用の比較", id: "費用の比較", level: "h3" },
 * //   ]},
 * // ]
 * ```
 */
export function generateToc(
  markdown: string,
  options: TocGeneratorOptions = {}
): TocItem[] {
  const {
    includeLevels = ["h2", "h3"],
    slugify = defaultSlugify,
    maxDepth = 2,
  } = options;

  const flatHeadings = extractHeadings(markdown, includeLevels, slugify);
  return nestHeadings(flatHeadings, maxDepth);
}

/**
 * 目次アイテムのリストをマークダウン形式の文字列に変換する
 * @param tocItems 目次アイテムリスト
 * @param baseIndent ベースインデント（スペース数）
 * @returns マークダウン形式の目次文字列
 *
 * @example
 * ```ts
 * const toc = generateToc(markdown);
 * const tocMarkdown = tocToMarkdown(toc);
 * // - [AGA治療とは](#aga治療とは)
 * //   - [フィナステリドの効果](#フィナステリドの効果)
 * ```
 */
export function tocToMarkdown(tocItems: TocItem[], baseIndent = 0): string {
  return tocItems
    .map((item) => {
      const indent = " ".repeat(baseIndent * 2);
      const line = `${indent}- [${item.text}](#${item.id})`;
      if (item.children && item.children.length > 0) {
        const childrenMarkdown = tocToMarkdown(item.children, baseIndent + 1);
        return `${line}\n${childrenMarkdown}`;
      }
      return line;
    })
    .join("\n");
}

/**
 * 目次アイテムのリストをフラットな配列に変換する（検索・ナビゲーション用）
 * @param tocItems 目次アイテムリスト
 */
export function flattenToc(tocItems: TocItem[]): Omit<TocItem, "children">[] {
  const result: Omit<TocItem, "children">[] = [];

  const traverse = (items: TocItem[]) => {
    for (const item of items) {
      const { children: _children, ...rest } = item;
      result.push(rest);
      if (item.children && item.children.length > 0) {
        traverse(item.children);
      }
    }
  };

  traverse(tocItems);
  return result;
}
