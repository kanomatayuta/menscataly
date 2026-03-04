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
      const id = headingMatch[2]
        .toLowerCase()
        .replace(/[^\w\u3000-\u9fff\uff00-\uffef]+/g, "-")
        .replace(/^-|-$/g, "");
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

/**
 * コンテンツを適切な HTML に変換する
 */
function normalizeContent(content: string): string {
  const format = detectFormat(content);

  switch (format) {
    case "json":
    case "json-codeblock": {
      const html = jsonToHtml(content);
      if (html) return html;
      // JSON parse succeeded but wasn't article format — show as markdown
      return markdownToHtml(content);
    }
    case "markdown":
      return markdownToHtml(content);
    case "html":
    default:
      return content;
  }
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
  const html = useMemo(() => normalizeContent(content), [content]);

  return (
    <div
      className={`article-body ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
