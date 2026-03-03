/**
 * 薬機法コンプライアンスチェッカー Unit Tests
 * ComplianceChecker クラス + PR表記テンプレート + アフィリエイトリンク処理
 */

import { describe, test, expect, beforeEach } from "vitest";
import { ComplianceChecker } from "../checker";
import { insertPRDisclosure, hasPRDisclosure } from "../templates/pr-disclosure";
import { processAffiliateLinks } from "../utils/affiliate-links";
import aGA from "../dictionaries/aga.json";
import eD from "../dictionaries/ed.json";
import hairRemoval from "../dictionaries/hair-removal.json";
import skincare from "../dictionaries/skincare.json";

// テスト用ヘルパー: ComplianceChecker を旧インターフェース互換に wrap
const checkCompliance = (text: string) => {
  const checker = new ComplianceChecker({ strictMode: false });
  const result = checker.check(text);
  return {
    isClean: result.isCompliant,
    violations: result.violations.map((v) => ({
      id: v.id,
      ng: v.ngText,
      ok: v.suggestedText,
      severity: v.severity,
    })),
    corrected: result.fixedText,
  };
};

const insertPrDisclosure = (article: { isPR: boolean; content: string }) => {
  if (!article.isPR) return article;
  return { ...article, content: insertPRDisclosure(article.content, "short_pr") };
};

// =============================================================================
// AGA辞書の全NGパターン
// =============================================================================
const AGA_TEST_CASES = aGA.entries.map(
  (entry) => [entry.id, entry.ng, entry.ok, entry.severity] as const
);
const ED_TEST_CASES = eD.entries.map(
  (entry) => [entry.id, entry.ng, entry.ok, entry.severity] as const
);
const HR_TEST_CASES = hairRemoval.entries.map(
  (entry) => [entry.id, entry.ng, entry.ok, entry.severity] as const
);
const SC_TEST_CASES = skincare.entries.map(
  (entry) => [entry.id, entry.ng, entry.ok, entry.severity] as const
);

// =============================================================================
// テスト本体
// =============================================================================

describe("薬機法コンプライアンスチェッカー", () => {
  describe("AGA関連NG表現の検出", () => {
    test.each(AGA_TEST_CASES)(
      '%s: "%s" を検出すること',
      (id, ngText, _ok, severity) => {
        const checker = new ComplianceChecker();
        const result = checker.check(ngText, { categories: ["aga", "common"] });
        // high/mediumのNG表現は検出されること
        if (severity === "high" || severity === "medium") {
          expect(result.isCompliant).toBe(false);
        }
      }
    );
  });

  describe("ED関連NG表現の検出", () => {
    test.each(ED_TEST_CASES)(
      '%s: "%s" を検出すること',
      (id, ngText, _ok, severity) => {
        const checker = new ComplianceChecker();
        const result = checker.check(ngText, { categories: ["ed", "common"] });
        if (severity === "high" || severity === "medium") {
          expect(result.isCompliant).toBe(false);
        }
      }
    );
  });

  describe("脱毛関連NG表現の検出", () => {
    test.each(HR_TEST_CASES)(
      '%s: "%s" を検出すること',
      (id, ngText, _ok, severity) => {
        const checker = new ComplianceChecker();
        const result = checker.check(ngText, { categories: ["hair_removal", "common"] });
        if (severity === "high" || severity === "medium") {
          expect(result.isCompliant).toBe(false);
        }
      }
    );
  });

  describe("スキンケア関連NG表現の検出", () => {
    test.each(SC_TEST_CASES)(
      '%s: "%s" を検出すること',
      (id, ngText, _ok, severity) => {
        const checker = new ComplianceChecker();
        const result = checker.check(ngText, { categories: ["skincare", "common"] });
        if (severity === "high" || severity === "medium") {
          expect(result.isCompliant).toBe(false);
        }
      }
    );
  });

  describe("クリーンテキストの検出なし", () => {
    test.each([
      ["発毛を促進する効果が期待できる (aga_001のOK表現)"],
      ["副作用のリスクが低いとされている※個人差があります (aga_005のOK表現)"],
      ["メラニンの生成を抑制する効果がある (sc_001のOK表現)"],
      ["永久的な減毛効果が期待できる (hr_001のOK表現)"],
    ])('"%s" は高リスク違反なしと判定されること', (okText) => {
      const checker = new ComplianceChecker();
      const result = checker.check(okText);
      // ステマ規制のPR表記欠如はここでは対象外（薬機法・景表法の違反のみ確認）
      // checkCompliance ヘルパーは violations を { id, ng, ok, severity } にリマップするため
      // id でフィルタリングする
      const highViolations = result.violations.filter(
        (v) => v.severity === "high" && v.id !== "stealth_missing_pr"
      );
      expect(highViolations).toHaveLength(0);
    });
  });

  describe("OK変換の正確性", () => {
    test("aga_001: NG→OK変換が正しいこと", () => {
      const result = checkCompliance("確実に髪が生えるAGA治療をご紹介します");
      expect(result.corrected).toContain("発毛を促進する効果が期待できる");
      expect(result.corrected).not.toContain("確実に髪が生える");
    });

    test("変換後のテキストを再チェックするとhigh violationsが0になること", () => {
      const original = "確実に髪が生えます。副作用なしで安全です。業界最安値のAGA治療。";
      const { corrected } = checkCompliance(original);
      if (!corrected) throw new Error("correctedが返されませんでした");
      const recheck = checkCompliance(corrected);
      // ステマ規制のPR表記欠如はここでは対象外（薬機法・景表法の違反のみ確認）
      // checkCompliance ヘルパーは violations を { id, ng, ok, severity } にリマップするため
      // id でフィルタリングする
      const highViolations = recheck.violations.filter(
        (v) => v.severity === "high" && v.id !== "stealth_missing_pr"
      );
      expect(highViolations).toHaveLength(0);
    });

    test("複数のNG表現が含まれる場合、全て検出されること", () => {
      const text = "確実に髪が生えて、副作用なし、業界最安値のAGA治療、AGAが治る";
      const result = checkCompliance(text);
      expect(result.violations.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("文脈分析: 否定文・引用文の取り扱い", () => {
    test('「〜とは言えません」という否定文中のNG表現はhigh違反にならないこと', () => {
      const result = checkCompliance("確実に髪が生えるとは言えません");
      const highViolations = result.violations.filter((v) => v.severity === "high");
      expect(highViolations).toHaveLength(0);
    });

    test('「〜という主張は誤り」という批判文脈はhigh違反にならないこと', () => {
      const result = checkCompliance("「AGAが治る」という主張は科学的根拠がありません");
      const highViolations = result.violations.filter((v) => v.severity === "high");
      expect(highViolations).toHaveLength(0);
    });
  });

  describe("ステマ規制: PR表記の自動挿入", () => {
    test("isPR: true の記事にPR表記が挿入されること", () => {
      const article = { isPR: true, content: "<p>AGA治療のご紹介</p>" };
      const processed = insertPrDisclosure(article);
      expect(processed.content).toMatch(/本記事はPR|広告を含む|アフィリエイト広告/);
    });

    test("PR表記が記事本文の先頭付近に挿入されること", () => {
      const article = {
        isPR: true,
        content: "<h1>AGAクリニック比較</h1><p>記事本文</p>",
      };
      const processed = insertPrDisclosure(article);
      const prIndex = processed.content.search(/PR|広告/);
      const bodyIndex = processed.content.indexOf("<p>記事本文</p>");
      expect(prIndex).toBeLessThan(bodyIndex);
    });

    test("isPR: false の記事にはPR表記が挿入されないこと", () => {
      const article = { isPR: false, content: "<p>AGAの基礎知識</p>" };
      const processed = insertPrDisclosure(article);
      expect(processed.content).not.toMatch(/本記事はPRを含みます/);
    });
  });

  describe("ComplianceResult の eeatScore 統合", () => {
    test("ComplianceResultにscoreフィールドが含まれること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("発毛を促進する効果が期待できるAGA治療");
      expect(typeof result.score).toBe("number");
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    test("クリーンなテキストはスコアが返されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("発毛を促進する効果が期待できるAGA治療をご紹介します。※個人差があります。");
      // スコアはPR表記欠如などで減点される場合があるが、値自体は返される
      expect(typeof result.score).toBe("number");
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    test("違反のあるテキストはスコアが下がること", () => {
      const checker = new ComplianceChecker();
      const cleanResult = checker.check("発毛を促進する効果が期待できる");
      const violatingResult = checker.check("確実に髪が生えるAGA治療。副作用なし。業界最安値。");
      expect(violatingResult.score).toBeLessThan(cleanResult.score);
    });
  });

  describe("ステマ規制: アフィリリンクのrel属性", () => {
    test('アフィリリンクに rel="sponsored" が付与されること', () => {
      const html =
        '<a href="https://px.a8.net/click?aid=123">クリニックへ</a>';
      const processed = processAffiliateLinks(html);
      expect(processed).toContain('rel="sponsored"');
    });

    test('target="_blank"のリンクにrel="noopener"が追加されること', () => {
      const html =
        '<a href="https://px.a8.net/click?aid=456" target="_blank">クリニックへ</a>';
      const processed = processAffiliateLinks(html);
      expect(processed).toContain("noopener");
      expect(processed).toContain("sponsored");
    });

    test('通常リンクに rel="sponsored" が付与されないこと', () => {
      const html = '<a href="/about">運営者情報</a>';
      const processed = processAffiliateLinks(html);
      expect(processed).not.toContain('rel="sponsored"');
    });
  });
});
