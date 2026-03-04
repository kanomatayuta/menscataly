"use client";

/**
 * 目次 (Table of Contents) — クライアントコンポーネント
 *
 * ArticleBody がレンダリングした実際の DOM から h2/h3 を読み取り、
 * scrollIntoView() で確実にスクロールさせる。
 *
 * これにより以下の問題を回避:
 * - TOCとArticleBodyでID生成ロジックの不一致
 * - ハイドレーションタイミングの問題
 * - 正規表現のedgeケースマッチ失敗
 */

import { useEffect, useState } from "react";

interface TocHeading {
  level: number;
  text: string;
  id: string;
}

export function TableOfContents() {
  const [headings, setHeadings] = useState<TocHeading[]>([]);

  useEffect(() => {
    // ArticleBody がレンダリングした .article-body 内の h2/h3 を取得
    const articleBody = document.querySelector(".article-body");
    if (!articleBody) return;

    const elements = articleBody.querySelectorAll("h2, h3");
    const items: TocHeading[] = [];

    elements.forEach((el) => {
      const text = el.textContent?.trim() ?? "";
      if (!text) return;

      // ID がなければ生成して付与
      if (!el.id) {
        el.id = text
          .toLowerCase()
          .replace(/[^\w\u3000-\u9fff\uff00-\uffef]+/g, "-")
          .replace(/^-|-$/g, "");
      }

      items.push({
        level: el.tagName === "H2" ? 2 : 3,
        text,
        id: el.id,
      });
    });

    setHeadings(items);
  }, []);

  // h2 が 2 つ未満なら目次不要
  const h2Count = headings.filter((h) => h.level === 2).length;
  if (h2Count < 2) return null;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      // sticky header (h-16 = 64px) + 余白 16px = 80px のオフセット
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementPosition - headerOffset,
        behavior: "smooth",
      });
      // URLハッシュを更新
      window.history.pushState(null, "", `#${id}`);
    }
  };

  return (
    <nav className="article-toc" aria-label="目次">
      <div className="article-toc-title">目次</div>
      <ol>
        {headings.map((heading, i) => {
          if (heading.level === 2) {
            // 次のh2までのh3を集める
            const subHeadings: TocHeading[] = [];
            for (let j = i + 1; j < headings.length; j++) {
              if (headings[j].level === 2) break;
              if (headings[j].level === 3) subHeadings.push(headings[j]);
            }
            return (
              <li key={`toc-${i}`}>
                <a
                  href={`#${heading.id}`}
                  onClick={(e) => handleClick(e, heading.id)}
                >
                  {heading.text}
                </a>
                {subHeadings.length > 0 && (
                  <ol>
                    {subHeadings.map((sub, si) => (
                      <li key={`toc-${i}-${si}`}>
                        <a
                          href={`#${sub.id}`}
                          onClick={(e) => handleClick(e, sub.id)}
                        >
                          {sub.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          }
          return null;
        })}
      </ol>
    </nav>
  );
}
