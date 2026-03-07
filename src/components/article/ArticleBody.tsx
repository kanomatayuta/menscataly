"use client";

/**
 * ArticleBody — 記事本文レンダラー
 *
 * microCMS から受け取った content フィールドをインテリジェントに判定して表示する。
 *
 * 対応フォーマット:
 *  1. HTML (microCMS リッチテキスト / ArticlePublisher 出力)
 *  2. Markdown (ArticleGenerator の content フィールド)
 *  3. 生 JSON (パースに失敗したClaudeレスポンスがそのまま保存されたケース)
 *
 * 判定ロジック:
 *  - `{` で始まる / `[` で始まる → JSON として再パース
 *  - `<h2>` / `<p>` 等のHTMLタグを含む → HTML としてそのまま表示
 *  - `## ` / `### ` を含む → Markdown → HTML 変換
 */

import { useMemo } from "react";

// ============================================================
// 軽量 Markdown → HTML 変換
// ============================================================

/**
 * ArticleGenerator が出力する Markdown パターンを HTML に変換する。
 * 対応: h2, h3, h4, p, ul/ol, blockquote, bold, italic, links, hr
 */
function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const htmlLines: string[] = [];
  let inList: "ul" | "ol" | null = null;
  let inBlockquote = false;

  function closeList() {
    if (inList) {
      htmlLines.push(inList === "ul" ? "</ul>" : "</ol>");
      inList = null;
    }
  }

  function closeBlockquote() {
    if (inBlockquote) {
      htmlLines.push("</blockquote>");
      inBlockquote = false;
    }
  }

  function inlineFormat(text: string): string {
    // Links: [text](url)
    text = text.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    // Bold: **text**
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    // Italic: *text* (single asterisk, not inside **)
    text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
    // Inline code: `code`
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
    return text;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === "") {
      closeList();
      closeBlockquote();
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeList();
      closeBlockquote();
      htmlLines.push("<hr />");
      continue;
    }

    // Headings
    const headingMatch = trimmed.match(/^(#{2,4})\s+(.+)$/);
    if (headingMatch) {
      closeList();
      closeBlockquote();
      const level = headingMatch[1].length; // 2, 3, or 4
      const text = inlineFormat(headingMatch[2]);
      const id = headingTextToId(headingMatch[2]);
      htmlLines.push(`<h${level} id="${id}">${text}</h${level}>`);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      closeList();
      if (!inBlockquote) {
        htmlLines.push("<blockquote>");
        inBlockquote = true;
      }
      htmlLines.push(`<p>${inlineFormat(trimmed.slice(2))}</p>`);
      continue;
    } else if (inBlockquote) {
      closeBlockquote();
    }

    // Unordered list
    if (/^[-*]\s+/.test(trimmed)) {
      closeBlockquote();
      if (inList !== "ul") {
        closeList();
        htmlLines.push("<ul>");
        inList = "ul";
      }
      htmlLines.push(`<li>${inlineFormat(trimmed.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      closeBlockquote();
      if (inList !== "ol") {
        closeList();
        htmlLines.push("<ol>");
        inList = "ol";
      }
      htmlLines.push(`<li>${inlineFormat(olMatch[1])}</li>`);
      continue;
    }

    // Regular paragraph
    closeList();
    closeBlockquote();
    htmlLines.push(`<p>${inlineFormat(trimmed)}</p>`);
  }

  closeList();
  closeBlockquote();

  return htmlLines.join("\n");
}

// ============================================================
// JSON パーサー (記事JSONフォーマット)
// ============================================================

interface RawSection {
  heading?: string;
  level?: string;
  content?: string;
  subsections?: RawSection[];
}

interface RawArticleJson {
  title?: string;
  lead?: string;
  sections?: RawSection[];
  conclusion?: string;
  cta?: string;
}

/**
 * 生JSON (ArticleGenerator のレスポンスフォーマット) を HTML に変換する
 */
function jsonToHtml(jsonStr: string): string | null {
  try {
    // ```json ... ``` ラップを除去
    const cleaned = jsonStr.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    const data: RawArticleJson = JSON.parse(cleaned);

    if (!data.sections && !data.lead && !data.title) {
      return null; // 記事JSONではないオブジェクト
    }

    const parts: string[] = [];

    if (data.lead) {
      parts.push(`<p class="article-lead">${data.lead}</p>`);
    }

    if (data.sections) {
      for (const section of data.sections) {
        const tag = section.level || "h2";
        parts.push(`<${tag}>${section.heading || ""}</${tag}>`);
        if (section.content) {
          // content might itself contain markdown
          if (section.content.includes("\n")) {
            parts.push(markdownToHtml(section.content));
          } else {
            parts.push(`<p>${section.content}</p>`);
          }
        }
        if (section.subsections) {
          for (const sub of section.subsections) {
            const subTag = sub.level || "h3";
            parts.push(`<${subTag}>${sub.heading || ""}</${subTag}>`);
            if (sub.content) {
              if (sub.content.includes("\n")) {
                parts.push(markdownToHtml(sub.content));
              } else {
                parts.push(`<p>${sub.content}</p>`);
              }
            }
          }
        }
      }
    }

    if (data.conclusion) {
      parts.push("<h2>まとめ</h2>");
      parts.push(markdownToHtml(data.conclusion));
    }

    if (data.cta) {
      parts.push(markdownToHtml(data.cta));
    }

    return parts.join("\n");
  } catch {
    return null;
  }
}

// ============================================================
// コンテンツフォーマット判定
// ============================================================

type ContentFormat = "html" | "markdown" | "json" | "json-codeblock";

function detectFormat(content: string): ContentFormat {
  const trimmed = content.trim();

  // JSON codeblock: ```json ... ```
  if (trimmed.startsWith("```json") || trimmed.startsWith("```JSON")) {
    return "json-codeblock";
  }

  // Raw JSON object or array
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    // Verify it actually parses as JSON
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // Not valid JSON, fall through
    }
  }

  // HTML detection: contains typical HTML tags
  if (/<(?:h[1-6]|p|div|ul|ol|li|table|blockquote|a|img|strong|em)[>\s/]/.test(trimmed)) {
    return "html";
  }

  // Markdown detection: contains markdown headings
  if (/^#{2,4}\s+/m.test(trimmed)) {
    return "markdown";
  }

  // Default: if content has paragraphs separated by double newlines, treat as markdown
  if (trimmed.includes("\n\n")) {
    return "markdown";
  }

  // Fallback: treat as HTML (could be plain text that should be wrapped in <p>)
  return "html";
}

// ============================================================
// HTML内Markdownハイブリッド変換
// ============================================================

/**
 * HTML内に残ったMarkdown構文を変換する（ハイブリッドモード）
 *
 * Claude APIが生成した記事は <p>, <h2> 等のHTMLタグを持つが、
 * タグの中身に **bold**, `| table |`, `- list` 等のMarkdown構文が
 * そのまま残っているケースが多い。
 */
function processHybridContent(html: string): string {
  // 1. インライン Markdown を HTML タグ内で変換
  //    **text** → <strong>text</strong>
  //    *text*   → <em>text</em>
  //    `code`   → <code>code</code>
  //    [text](url) → <a>
  html = html.replace(
    /(<p[^>]*>)([\s\S]*?)(<\/p>)/g,
    (_match, open: string, inner: string, close: string) => {
      let processed = inner;

      // Markdownテーブル行の検出: | col1 | col2 | col3 |
      if (/^\s*\|.*\|.*\|\s*$/.test(processed.trim())) {
        // テーブル行はそのまま返す（後でテーブル変換で処理）
        return open + processed + close;
      }

      // Markdown リスト検出: - item または * item
      if (/^\s*[-*]\s+\*?\*?/.test(processed.trim())) {
        // リストアイテムはそのまま返す（後でリスト変換で処理）
        return open + processed + close;
      }

      // Bold: **text**
      processed = processed.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      // Italic: *text* (not inside **)
      processed = processed.replace(
        /(?<!\*)\*([^*]+)\*(?!\*)/g,
        "<em>$1</em>"
      );
      // Inline code: `code`
      processed = processed.replace(/`([^`]+)`/g, "<code>$1</code>");
      // Links: [text](url)
      processed = processed.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      );

      return open + processed + close;
    }
  );

  // 2. Markdownテーブルを <table> に変換
  //    <p>| col1 | col2 |</p><p>|---|---|</p><p>| val1 | val2 |</p>
  html = convertMarkdownTables(html);

  // 3. Markdownリスト (<p>- item</p> パターン) を <ul>/<ol> に変換
  html = convertMarkdownLists(html);

  return html;
}

/**
 * <p>タグに包まれたMarkdownテーブルを <table> に変換
 */
function convertMarkdownTables(html: string): string {
  // <p>| ... |</p> の連続パターンを検出
  const tablePattern =
    /(?:<p[^>]*>\s*\|[^<]+\|\s*<\/p>\s*)+/g;

  return html.replace(tablePattern, (match) => {
    // 各行を抽出
    const rowMatches = match.match(/<p[^>]*>\s*(\|[^<]+\|)\s*<\/p>/g);
    if (!rowMatches || rowMatches.length < 2) return match;

    const rows: string[][] = [];
    let separatorIdx = -1;

    for (let i = 0; i < rowMatches.length; i++) {
      const inner = rowMatches[i]
        .replace(/<p[^>]*>\s*/, "")
        .replace(/\s*<\/p>/, "")
        .trim();

      // セパレータ行の検出: |---|---|
      if (/^\|[\s:]*-{2,}[\s:]*(\|[\s:]*-{2,}[\s:]*)*\|$/.test(inner)) {
        separatorIdx = i;
        continue;
      }

      const cells = inner
        .split("|")
        .filter((cell) => cell.trim() !== "")
        .map((cell) => cell.trim());

      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    if (rows.length === 0) return match;

    // テーブルHTML構築
    let tableHtml = '<table>';
    const hasHeader = separatorIdx === 1 || (separatorIdx === -1 && rows.length >= 2);

    if (hasHeader && rows.length > 0) {
      const headerRow = rows.shift()!;
      tableHtml += "<thead><tr>";
      for (const cell of headerRow) {
        // Bold変換
        const cellHtml = cell.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        tableHtml += `<th>${cellHtml}</th>`;
      }
      tableHtml += "</tr></thead>";
    }

    if (rows.length > 0) {
      tableHtml += "<tbody>";
      for (const row of rows) {
        tableHtml += "<tr>";
        for (const cell of row) {
          const cellHtml = cell.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
          tableHtml += `<td>${cellHtml}</td>`;
        }
        tableHtml += "</tr>";
      }
      tableHtml += "</tbody>";
    }

    tableHtml += "</table>";
    return tableHtml;
  });
}

/**
 * <p>タグに包まれたMarkdownリストを <ul>/<ol> に変換
 */
function convertMarkdownLists(html: string): string {
  // 連続する <p>- item</p> パターンを <ul> に変換
  html = html.replace(
    /(?:<p[^>]*>\s*[-*]\s+[\s\S]*?<\/p>\s*){2,}/g,
    (match) => {
      const items = match.match(/<p[^>]*>\s*[-*]\s+([\s\S]*?)<\/p>/g);
      if (!items) return match;

      let listHtml = "<ul>";
      for (const item of items) {
        let content = item
          .replace(/<p[^>]*>\s*[-*]\s+/, "")
          .replace(/<\/p>/, "")
          .trim();
        // Bold変換
        content = content.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        // Italic変換
        content = content.replace(
          /(?<!\*)\*([^*]+)\*(?!\*)/g,
          "<em>$1</em>"
        );
        listHtml += `<li>${content}</li>`;
      }
      listHtml += "</ul>";
      return listHtml;
    }
  );

  return html;
}

/**
 * HTML内に埋め込まれたJSON/Markdownを検出し抽出する前処理
 *
 * publisher.ts が JSON parse 失敗時に生のClaude応答を <p> でラップして
 * microCMS に保存するケースで、content が以下のような形になる:
 *   <p>```json { "title": "...", ... } ```</p>
 *   <p>{ "title": "...", "lead": "..." }</p>
 *
 * これを検出して内部フォーマットに戻す。
 */
function unwrapEmbeddedContent(content: string): string {
  const trimmed = content.trim();

  // Case 1: <p> タグ内に ```json コードブロックがある
  const jsonCodeblockInHtml = trimmed.match(
    /<p[^>]*>\s*(```json[\s\S]*?```)\s*<\/p>/i
  );
  if (jsonCodeblockInHtml) {
    return jsonCodeblockInHtml[1];
  }

  // Case 2: コンテンツ全体が少数の <p> タグで、中身がJSON
  // <p>PR表記</p><p>{ "title": ... }</p> のようなパターン
  const paragraphs = trimmed.match(/<p[^>]*>([\s\S]*?)<\/p>/g);
  if (paragraphs) {
    for (const p of paragraphs) {
      const inner = p.replace(/<p[^>]*>\s*/, "").replace(/\s*<\/p>/, "").trim();
      // JSON オブジェクト検出
      if (inner.startsWith("{") && inner.includes('"title"') && inner.includes('"lead"')) {
        try {
          JSON.parse(inner);
          return inner;
        } catch {
          // 不完全なJSON — ```json ラッパーなしの生JSONかもしれない
          // 閉じ括弧を探す
          const fullContent = trimmed.replace(/<\/?p[^>]*>/g, "\n").trim();
          const jsonStart = fullContent.indexOf("{");
          if (jsonStart >= 0) {
            const candidate = fullContent.slice(jsonStart);
            try {
              JSON.parse(candidate);
              return candidate;
            } catch {
              // fall through
            }
          }
        }
      }
      // ```json コードブロック検出
      if (inner.startsWith("```json") || inner.startsWith("```JSON")) {
        return inner;
      }
    }
  }

  return content;
}

/**
 * 見出しテキストからアンカー用 ID を生成する
 * 日本語文字を保持し、英数字・日本語以外をハイフンに変換する。
 * TOC (page.tsx) と ArticleBody で同一のIDを生成するための共通ロジック。
 */
function headingTextToId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u3000-\u9fff\uff00-\uffef]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * 見出しタグ (h2/h3/h4) に id 属性を自動付与する
 * 目次 (TOC) のアンカーリンクが正しく機能するために必要
 */
function ensureHeadingIds(html: string): string {
  return html.replace(
    /<(h[2-4])(\s[^>]*)?>([^<]*(?:<[^/][^>]*>[^<]*<\/[^>]+>[^<]*)*)<\/\1>/gi,
    (match, tag: string, attrs: string | undefined, inner: string) => {
      // 既に id がある場合はそのまま
      if (attrs && /\sid="/.test(attrs)) return match;

      // テキストを抽出 (HTMLタグを除去)
      const text = inner.replace(/<[^>]*>/g, "").trim();
      if (!text) return match;

      const id = headingTextToId(text);
      if (!id) return match;

      return `<${tag}${attrs ?? ""} id="${id}">${inner}</${tag}>`;
    }
  );
}

/**
 * コンテンツを適切な HTML に変換する
 */
function normalizeContent(content: string): string {
  // 前処理: HTML内に埋め込まれたJSON/Markdownを抽出
  const unwrapped = unwrapEmbeddedContent(content);
  const format = detectFormat(unwrapped);

  let result: string;
  switch (format) {
    case "json":
    case "json-codeblock": {
      const html = jsonToHtml(unwrapped);
      result = html ?? markdownToHtml(unwrapped);
      break;
    }
    case "markdown":
      result = markdownToHtml(unwrapped);
      break;
    case "html":
    default:
      // HTML内にMarkdown構文が残っている場合のハイブリッド変換
      result = processHybridContent(content);
      break;
  }

  // 後処理: 見出しタグに id 属性を自動付与（TOCアンカーリンク対応）
  return ensureHeadingIds(result);
}

// ============================================================
// HTMLサニタイズ (XSS対策)
// ============================================================

/**
 * HTMLからXSSリスクのある要素を除去する
 * dangerouslySetInnerHTML に渡す前に必ず適用する
 */
function sanitizeHtml(html: string): string {
  let s = html;
  // script tags
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<script\b[^>]*\/>/gi, '');
  // event handlers (on*)
  s = s.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // javascript: URLs
  s = s.replace(/href\s*=\s*["']?\s*javascript:/gi, 'href="');
  s = s.replace(/src\s*=\s*["']?\s*javascript:/gi, 'src="');
  // data: URLs in src (potential XSS via SVG) — allow safe image types
  s = s.replace(/src\s*=\s*["']?\s*data:(?!image\/(?:png|jpeg|gif|webp|svg\+xml))/gi, 'src="');
  return s;
}

// ============================================================
// コンポーネント
// ============================================================

interface ArticleBodyProps {
  /** 記事コンテンツ (HTML, Markdown, or JSON) */
  content: string;
  /** 追加の CSS クラス */
  className?: string;
}

/**
 * 記事本文レンダラー
 *
 * microCMS/generator の出力フォーマットに応じてコンテンツをインテリジェントにレンダリングする。
 * `article-body` CSS クラスでタイポグラフィをスタイリング (globals.css で定義)。
 */
export function ArticleBody({ content, className = "" }: ArticleBodyProps) {
  const html = useMemo(() => sanitizeHtml(normalizeContent(content)), [content]);

  return (
    <div
      className={`article-body ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
