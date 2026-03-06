"use client";

/**
 * サイドバー目次 (Sidebar Table of Contents) — デスクトップ専用
 *
 * - h2: 番号付きで常時表示、子がある場合はクリックで展開
 * - h3/h4/h5: アコーディオン（デフォルト閉じ、スクロールスパイで自動展開）
 */

import { useEffect, useState, useCallback } from "react";

interface TocHeading {
  level: number;
  text: string;
  id: string;
}

function readHeadingsFromDOM(): TocHeading[] {
  const articleBody = document.querySelector(".article-body");
  if (!articleBody) return [];

  const elements = articleBody.querySelectorAll("h2, h3, h4, h5");
  const items: TocHeading[] = [];

  elements.forEach((el) => {
    const text = el.textContent?.trim() ?? "";
    if (!text) return;

    if (!el.id) {
      el.id = text
        .toLowerCase()
        .replace(/[^\w\u3000-\u9fff\uff00-\uffef]+/g, "-")
        .replace(/^-|-$/g, "");
    }

    const level = parseInt(el.tagName[1], 10);
    items.push({ level, text, id: el.id });
  });

  return items;
}

export function SidebarTableOfContents() {
  const [headings, setHeadings] = useState<TocHeading[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );

  // .article-body の出現を待って見出しを読み取る
  useEffect(() => {
    function tryRead() {
      const items = readHeadingsFromDOM();
      if (items.length > 0) {
        setHeadings(items);
        return true;
      }
      return false;
    }

    if (tryRead()) return;

    const observer = new MutationObserver(() => {
      if (tryRead()) {
        observer.disconnect();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // スクロールスパイ
  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  // activeId変更時に親h2を自動展開
  useEffect(() => {
    if (!activeId) return;
    const activeHeading = headings.find((h) => h.id === activeId);
    if (!activeHeading || activeHeading.level === 2) return;

    const idx = headings.indexOf(activeHeading);
    for (let i = idx - 1; i >= 0; i--) {
      if (headings[i].level === 2) {
        setExpandedSections((prev) => {
          if (prev.has(headings[i].id)) return prev;
          const next = new Set(prev);
          next.add(headings[i].id);
          return next;
        });
        break;
      }
    }
  }, [activeId, headings]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      e.preventDefault();
      const element = document.getElementById(id);
      if (element) {
        const headerOffset = 80;
        const elementPosition =
          element.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({
          top: elementPosition - headerOffset,
          behavior: "smooth",
        });
        window.history.pushState(null, "", `#${id}`);
        setActiveId(id);
      }
    },
    []
  );

  const toggleSection = useCallback((h2Id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(h2Id)) {
        next.delete(h2Id);
      } else {
        next.add(h2Id);
      }
      return next;
    });
  }, []);

  const h2Count = headings.filter((h) => h.level === 2).length;
  if (h2Count < 2) return null;

  // h2ごとにグループ化
  const h2Groups: { h2: TocHeading; children: TocHeading[]; index: number }[] =
    [];
  let h2Index = 0;
  for (let i = 0; i < headings.length; i++) {
    if (headings[i].level === 2) {
      h2Index++;
      const children: TocHeading[] = [];
      for (let j = i + 1; j < headings.length; j++) {
        if (headings[j].level === 2) break;
        children.push(headings[j]);
      }
      h2Groups.push({ h2: headings[i], children, index: h2Index });
    }
  }

  return (
    <nav className="stoc" aria-label="目次">
      <div className="stoc-header">
        <span className="stoc-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M2.5 3h11M2.5 6.5h8M2.5 10h11M2.5 13.5h6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="stoc-title">目次</span>
      </div>
      <ol className="stoc-list">
        {h2Groups.map(({ h2, children, index }) => {
          const isExpanded = expandedSections.has(h2.id);
          const hasChildren = children.length > 0;
          const isActive = activeId === h2.id;

          return (
            <li key={h2.id} className={isActive ? "stoc-item active" : "stoc-item"}>
              <div className="stoc-h2">
                <span className="stoc-num">{index}</span>
                <a
                  href={`#${h2.id}`}
                  onClick={(e) => handleClick(e, h2.id)}
                  className={`stoc-link ${isActive ? "active" : ""}`}
                  title={h2.text}
                >
                  {h2.text}
                </a>
                {hasChildren && (
                  <button
                    type="button"
                    className={`stoc-chevron ${isExpanded ? "open" : ""}`}
                    onClick={() => toggleSection(h2.id)}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? "閉じる" : "開く"}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
              {hasChildren && (
                <ol className={`stoc-sub ${isExpanded ? "open" : ""}`}>
                  {children.map((child) => {
                    const isChildActive = activeId === child.id;
                    return (
                      <li
                        key={child.id}
                        className={`stoc-sub-item lv${child.level}${isChildActive ? " active" : ""}`}
                      >
                        <a
                          href={`#${child.id}`}
                          onClick={(e) => handleClick(e, child.id)}
                          title={child.text}
                        >
                          {child.text}
                        </a>
                      </li>
                    );
                  })}
                </ol>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
