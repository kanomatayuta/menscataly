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
// Phase 4 拡張辞書
import agaTermsPhase4 from "../dictionaries/aga-terms-phase4";
import edTermsPhase4 from "../dictionaries/ed-terms-phase4";
import hairRemovalTermsPhase4 from "../dictionaries/hair-removal-terms-phase4";
import skincareTermsPhase4 from "../dictionaries/skincare-terms-phase4";
import commonTermsPhase4 from "../dictionaries/common-terms-phase4";

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

  // =============================================================================
  // Phase 4 拡張辞書テスト
  // =============================================================================

  describe("Phase 4: AGA拡張辞書の検出", () => {
    const AGA_P4_CASES = agaTermsPhase4.entries.map(
      (entry) => [entry.id, entry.ng, entry.ok, entry.severity] as const
    );

    test.each(AGA_P4_CASES)(
      '%s: "%s" を検出すること',
      (id, ngText, _ok, severity) => {
        const checker = new ComplianceChecker();
        const result = checker.check(ngText, { categories: ["aga", "common"] });
        if (severity === "high" || severity === "medium") {
          expect(result.isCompliant).toBe(false);
        }
      }
    );

    test("デュタステリドの効果断定が検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("デュタステリドで確実に改善できるAGA治療", { categories: ["aga", "common"] });
      expect(result.isCompliant).toBe(false);
      expect(result.violations.some((v) => v.ngText.includes("デュタステリド"))).toBe(true);
    });

    test("ミノキシジルタブレットの安全性断定が検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("ミノキシジルタブレットは安全なので安心してください", { categories: ["aga", "common"] });
      expect(result.isCompliant).toBe(false);
    });

    test("発毛保証の表現が検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("当院は発毛保証つきのAGA治療を提供", { categories: ["aga", "common"] });
      expect(result.isCompliant).toBe(false);
    });

    test("ビフォーアフター効果断定が検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("ビフォーアフターで効果が明らかです", { categories: ["aga", "common"] });
      expect(result.isCompliant).toBe(false);
    });
  });

  describe("Phase 4: ED拡張辞書の検出", () => {
    const ED_P4_CASES = edTermsPhase4.entries.map(
      (entry) => [entry.id, entry.ng, entry.ok, entry.severity] as const
    );

    test.each(ED_P4_CASES)(
      '%s: "%s" を検出すること',
      (id, ngText, _ok, severity) => {
        const checker = new ComplianceChecker();
        const result = checker.check(ngText, { categories: ["ed", "common"] });
        if (severity === "high" || severity === "medium") {
          expect(result.isCompliant).toBe(false);
        }
      }
    );

    test("レビトラの効果断定が検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("レビトラで確実に勃起するED治療", { categories: ["ed", "common"] });
      expect(result.isCompliant).toBe(false);
      expect(result.violations.some((v) => v.ngText.includes("レビトラ"))).toBe(true);
    });

    test("心因性EDの簡易治療断定が検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("心因性EDは薬で簡単に治る症状です", { categories: ["ed", "common"] });
      expect(result.isCompliant).toBe(false);
    });

    test("ED治療の性的効果断定が検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("ED治療で夜の生活が確実に改善します", { categories: ["ed", "common"] });
      expect(result.isCompliant).toBe(false);
    });
  });

  describe("Phase 4: 脱毛拡張辞書の検出", () => {
    const HR_P4_CASES = hairRemovalTermsPhase4.entries.map(
      (entry) => [entry.id, entry.ng, entry.ok, entry.severity] as const
    );

    test.each(HR_P4_CASES)(
      '%s: "%s" を検出すること',
      (id, ngText, _ok, severity) => {
        const checker = new ComplianceChecker();
        const result = checker.check(ngText, { categories: ["hair_removal", "common"] });
        if (severity === "high" || severity === "medium") {
          expect(result.isCompliant).toBe(false);
        }
      }
    );

    test("ヒゲ脱毛の永久効果断定が検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("ヒゲ脱毛で永久にヒゲが生えなくなるクリニック", { categories: ["hair_removal", "common"] });
      expect(result.isCompliant).toBe(false);
    });

    test("脱毛完了保証が検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("脱毛完了保証つきのプランです", { categories: ["hair_removal", "common"] });
      expect(result.isCompliant).toBe(false);
    });

    test("最新機器による痛みなし断定が検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("最新機器だから痛みなしで脱毛できます", { categories: ["hair_removal", "common"] });
      expect(result.isCompliant).toBe(false);
    });

    test("脱毛効果No.1が検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("脱毛効果No.1のサロンです", { categories: ["hair_removal", "common"] });
      expect(result.isCompliant).toBe(false);
    });
  });

  describe("Phase 4: スキンケア拡張辞書の検出", () => {
    const SC_P4_CASES = skincareTermsPhase4.entries.map(
      (entry) => [entry.id, entry.ng, entry.ok, entry.severity] as const
    );

    test.each(SC_P4_CASES)(
      '%s: "%s" を検出すること',
      (id, ngText, _ok, severity) => {
        const checker = new ComplianceChecker();
        const result = checker.check(ngText, { categories: ["skincare", "common"] });
        if (severity === "high" || severity === "medium") {
          expect(result.isCompliant).toBe(false);
        }
      }
    );

    test("ニキビ跡完全消失が検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("ニキビ跡が完全に消える施術です", { categories: ["skincare", "common"] });
      expect(result.isCompliant).toBe(false);
    });

    test("ダーマペン効果断定が検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("ダーマペンでニキビ跡が消えるのでおすすめ", { categories: ["skincare", "common"] });
      expect(result.isCompliant).toBe(false);
    });

    test("具体的年齢での若返り断定が検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("この美容液で10歳若く見えるようになります", { categories: ["skincare", "common"] });
      expect(result.isCompliant).toBe(false);
    });

    test("毛穴消滅の断定が検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("この化粧水で毛穴が消滅する効果", { categories: ["skincare", "common"] });
      expect(result.isCompliant).toBe(false);
    });
  });

  describe("Phase 4: 共通拡張辞書の検出", () => {
    const CM_P4_CASES = commonTermsPhase4.entries.map(
      (entry) => [entry.id, entry.ng, entry.ok, entry.severity] as const
    );

    test.each(CM_P4_CASES)(
      '%s: "%s" を検出すること',
      (id, ngText, _ok, severity) => {
        const checker = new ComplianceChecker();
        const result = checker.check(ngText, { categories: ["common"] });
        if (severity === "high" || severity === "medium") {
          expect(result.isCompliant).toBe(false);
        }
      }
    );

    test("効果保証表現が検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("効果を保証する治療プラン", { categories: ["common"] });
      expect(result.isCompliant).toBe(false);
    });

    test("100%の効果が検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("100%の効果が実証されている", { categories: ["common"] });
      expect(result.isCompliant).toBe(false);
    });

    test("体験者全員が効果実感が検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("体験者全員が効果を実感しています", { categories: ["common"] });
      expect(result.isCompliant).toBe(false);
    });

    test("副作用の心配なし表現が検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("副作用の心配はありませんので安心です", { categories: ["common"] });
      expect(result.isCompliant).toBe(false);
    });

    test("顧客満足度の具体的数値が検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("顧客満足度98%の人気クリニック", { categories: ["common"] });
      expect(result.isCompliant).toBe(false);
    });
  });

  describe("Phase 4: 正規表現パターンの拡張テスト", () => {
    test("「薄毛が治る」パターンが検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("この治療で薄毛が治るので安心");
      const pharmViolations = result.violations.filter(
        (v) => v.type === "pharmaceutical_law" && v.id !== "stealth_missing_pr"
      );
      expect(pharmViolations.length).toBeGreaterThan(0);
    });

    test("「ハゲが治る」パターンが検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("ハゲが治る最新の治療法");
      expect(result.isCompliant).toBe(false);
    });

    test("「ニキビ跡が治る」パターンが検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("ニキビ跡が治る美容施術");
      expect(result.isCompliant).toBe(false);
    });

    test("「シミがなくなる」パターンが検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("シミがなくなる化粧品");
      expect(result.isCompliant).toBe(false);
    });

    test("「絶対に効く」パターンが検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("絶対に効くAGA治療");
      expect(result.isCompliant).toBe(false);
    });

    test("「絶対に痛くない」パターンが検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("絶対に痛くない脱毛");
      expect(result.isCompliant).toBe(false);
    });

    test("「AGA完全に治る」パターンが検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("AGAが完全に治る治療法");
      expect(result.isCompliant).toBe(false);
    });

    test("「悩みを解消する」パターンが検出されること", () => {
      const checker = new ComplianceChecker();
      const result = checker.check("薄毛の悩みを完全に解消する治療法");
      expect(result.isCompliant).toBe(false);
    });
  });

  describe("Phase 4: 辞書統計の確認", () => {
    test("Phase 4拡張後の辞書エントリ数が増加していること", () => {
      const checker = new ComplianceChecker();
      const stats = checker.getDictionaryStats();
      // AGA: 15(json) + 28(ext) + 15(p4) = 58
      expect(stats.aga).toBeGreaterThanOrEqual(58);
      // ED: 10(json) + 19(ext) + 12(p4) = 41
      expect(stats.ed).toBeGreaterThanOrEqual(41);
      // Hair removal: 10(json) + 6(ext) + 15(p4) = 31
      expect(stats.hair_removal).toBeGreaterThanOrEqual(31);
      // Skincare: 15(json) + 6(ext) + 15(p4) = 36
      expect(stats.skincare).toBeGreaterThanOrEqual(36);
      // Common: 18(json) + 15(beauty) + 10(price) + 15(comparison) + 15(p4) = 73
      expect(stats.common).toBeGreaterThanOrEqual(73);
    });

    test("全カテゴリの合計辞書エントリ数が270を超えること", () => {
      const checker = new ComplianceChecker();
      const stats = checker.getDictionaryStats();
      const total = Object.values(stats).reduce((sum, count) => sum + count, 0);
      // 202(既存) + 72(Phase 4) = 274以上
      expect(total).toBeGreaterThanOrEqual(270);
    });
  });
});
