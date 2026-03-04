/**
 * パイロット記事生成スクリプト
 *
 * 5カテゴリから各1記事を ArticleGenerator で生成し、
 * 薬機法チェック結果とともに scripts/pilot-results/ に保存する。
 *
 * Usage:
 *   npx tsx scripts/pilot-generate.ts
 *
 * 環境変数:
 *   ANTHROPIC_API_KEY — Claude API キー（未設定時はドライランモード）
 *   DRY_RUN=true      — 強制的にモックレスポンスで実行
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, mkdirSync, existsSync } from "fs";

// ============================================================
// パス解決（tsx + ESM 環境対応）
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");
const RESULTS_DIR = resolve(__dirname, "pilot-results");

// .env.local を手動で読み込む（dotenv不要）
function loadEnvLocal() {
  const envPath = resolve(PROJECT_ROOT, ".env.local");
  if (!existsSync(envPath)) {
    console.warn("[pilot-generate] .env.local not found. Using environment variables as-is.");
    return;
  }
  const { readFileSync } = require("fs");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

// ============================================================
// 型定義
// ============================================================

/** パイロット生成対象キーワード */
interface PilotTarget {
  id: string;
  category: "aga" | "ed" | "hair-removal" | "skincare" | "supplement";
  keyword: string;
  subKeywords: string[];
  targetAudience: string;
  targetLength: number;
  tone: "informative" | "comparison";
}

/** 個別記事の生成結果 */
interface PilotResult {
  target: PilotTarget;
  success: boolean;
  isDryRun: boolean;
  article?: {
    title: string;
    slug: string;
    lead: string;
    contentLength: number;
    sectionCount: number;
    subsectionCount: number;
    readingTime: number;
    tags: string[];
    hasSupervisor: boolean;
    referenceCount: number;
  };
  compliance?: {
    isCompliant: boolean;
    score: number;
    violationCount: number;
    hasPRDisclosure: boolean;
    missingItems: string[];
    violationsByType: Record<string, number>;
    violationsBySeverity: Record<string, number>;
    topViolations: Array<{
      ngText: string;
      suggestedText: string;
      severity: string;
      reason: string;
    }>;
  };
  eeat?: {
    total: number;
    experience: number;
    expertise: number;
    authoritativeness: number;
    trustworthiness: number;
    details: string[];
  };
  model: string;
  generatedAt: string;
  processingTimeMs: number;
  error?: string;
  fullArticle?: unknown;
  fullCompliance?: unknown;
}

/** 全体の生成結果サマリー */
interface PilotSummary {
  executedAt: string;
  isDryRun: boolean;
  totalArticles: number;
  successCount: number;
  failedCount: number;
  totalProcessingTimeMs: number;
  results: PilotResult[];
}

// ============================================================
// パイロット対象キーワード（5カテゴリ x 1記事）
// ============================================================

const PILOT_TARGETS: PilotTarget[] = [
  {
    id: "pilot-aga-001",
    category: "aga",
    keyword: "AGA治療 オンラインクリニック 比較",
    subKeywords: ["AGA オンライン 安い", "AGA クリニック おすすめ", "フィナステリド オンライン"],
    targetAudience: "AGA治療を検討中の20〜40代男性",
    targetLength: 4000,
    tone: "comparison",
  },
  {
    id: "pilot-ed-001",
    category: "ed",
    keyword: "ED治療 オンライン診療 おすすめ",
    subKeywords: ["ED薬 オンライン処方", "バイアグラ オンライン", "ED治療 安い"],
    targetAudience: "ED治療をオンラインで受けたい30〜50代男性",
    targetLength: 4000,
    tone: "comparison",
  },
  {
    id: "pilot-hr-001",
    category: "hair-removal",
    keyword: "メンズ脱毛 医療脱毛 比較",
    subKeywords: ["メンズ脱毛 おすすめ", "医療脱毛 メンズ 料金", "ヒゲ脱毛 比較"],
    targetAudience: "医療脱毛を検討中の20〜30代男性",
    targetLength: 4500,
    tone: "comparison",
  },
  {
    id: "pilot-sc-001",
    category: "skincare",
    keyword: "メンズ スキンケア 30代 おすすめ",
    subKeywords: ["30代 メンズ 化粧水", "男性 スキンケア 始め方", "メンズ 保湿 おすすめ"],
    targetAudience: "スキンケアを始めたい30代男性",
    targetLength: 3500,
    tone: "informative",
  },
  {
    id: "pilot-sp-001",
    category: "supplement" as PilotTarget["category"],
    keyword: "男性 サプリメント 疲労回復 おすすめ",
    subKeywords: ["疲労回復 サプリ メンズ", "男性 活力 サプリ", "ビタミンB サプリ おすすめ"],
    targetAudience: "疲労を感じやすい30〜50代の働く男性",
    targetLength: 3500,
    tone: "informative",
  },
];

// ============================================================
// メイン処理
// ============================================================

async function main() {
  console.log("=".repeat(60));
  console.log("MENS CATALY - Pilot Article Generation");
  console.log("=".repeat(60));

  const forceDryRun = process.env.DRY_RUN === "true";
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  const isDryRun = forceDryRun || !hasApiKey;

  if (isDryRun) {
    console.log("\n[MODE] DRY RUN - Using mock responses");
    if (!hasApiKey) {
      console.log("[REASON] ANTHROPIC_API_KEY is not set");
    }
    if (forceDryRun) {
      console.log("[REASON] DRY_RUN=true is set");
    }
  } else {
    console.log("\n[MODE] LIVE - Using Claude API");
    console.log("[WARNING] This will incur API costs for 5 articles");
  }

  // 強制ドライランの場合は環境変数を削除
  if (forceDryRun && hasApiKey) {
    delete process.env.ANTHROPIC_API_KEY;
  }

  console.log(`\n[TARGETS] ${PILOT_TARGETS.length} articles to generate\n`);

  // ArticleGenerator と ComplianceChecker の動的インポート
  // tsx が @/ パスエイリアスを解決できるように tsconfig.json の paths を利用
  const { ArticleGenerator } = await import("../src/lib/content/generator");
  const { ComplianceChecker } = await import("../src/lib/compliance/checker");
  const { EEATValidator } = await import("../src/lib/compliance/rules/eeat-validation");

  const generator = new ArticleGenerator();
  const checker = new ComplianceChecker({ autoFix: false, strictMode: true });
  const eeatValidator = new EEATValidator();

  // 結果ディレクトリを確保
  if (!existsSync(RESULTS_DIR)) {
    mkdirSync(RESULTS_DIR, { recursive: true });
  }

  const results: PilotResult[] = [];
  const overallStart = Date.now();

  for (let i = 0; i < PILOT_TARGETS.length; i++) {
    const target = PILOT_TARGETS[i];
    const num = i + 1;

    console.log(`\n${"─".repeat(50)}`);
    console.log(`[${num}/${PILOT_TARGETS.length}] ${target.category.toUpperCase()}: "${target.keyword}"`);
    console.log(`${"─".repeat(50)}`);

    try {
      // supplement は ContentCategory に存在しないため column を使用
      const generatorCategory =
        target.category === ("supplement" as string)
          ? ("column" as const)
          : target.category;

      const response = await generator.generate({
        category: generatorCategory,
        keyword: target.keyword,
        subKeywords: target.subKeywords,
        targetAudience: target.targetAudience,
        tone: target.tone,
        targetLength: target.targetLength,
      });

      const article = response.article;

      // 独自のコンプライアンスチェック（strictMode付き）
      const complianceCategory =
        target.category === "hair-removal"
          ? "hair_removal"
          : target.category === ("supplement" as string)
            ? "common"
            : target.category;

      const complianceResult = checker.check(article.content, {
        categories: [complianceCategory as "aga" | "hair_removal" | "skincare" | "ed" | "common", "common"],
      });

      // E-E-A-T スコア
      const eeatScore = eeatValidator.validate(article);

      // サブセクション数を集計
      const subsectionCount = article.sections.reduce(
        (acc, s) => acc + (s.subsections?.length ?? 0),
        0
      );

      // 違反をタイプ別に集計
      const violationsByType: Record<string, number> = {};
      const violationsBySeverity: Record<string, number> = { high: 0, medium: 0, low: 0 };
      for (const v of complianceResult.violations) {
        violationsByType[v.type] = (violationsByType[v.type] ?? 0) + 1;
        violationsBySeverity[v.severity] = (violationsBySeverity[v.severity] ?? 0) + 1;
      }

      const result: PilotResult = {
        target,
        success: true,
        isDryRun,
        article: {
          title: article.title,
          slug: article.slug,
          lead: article.lead,
          contentLength: article.content.length,
          sectionCount: article.sections.length,
          subsectionCount,
          readingTime: article.readingTime ?? 0,
          tags: article.tags ?? [],
          hasSupervisor: !!article.supervisor,
          referenceCount: article.references.length,
        },
        compliance: {
          isCompliant: complianceResult.isCompliant,
          score: complianceResult.score,
          violationCount: complianceResult.violations.length,
          hasPRDisclosure: complianceResult.hasPRDisclosure,
          missingItems: complianceResult.missingItems,
          violationsByType,
          violationsBySeverity,
          topViolations: complianceResult.violations.slice(0, 10).map((v) => ({
            ngText: v.ngText,
            suggestedText: v.suggestedText,
            severity: v.severity,
            reason: v.reason,
          })),
        },
        eeat: eeatScore,
        model: response.model,
        generatedAt: response.generatedAt,
        processingTimeMs: response.processingTimeMs ?? 0,
        fullArticle: article,
        fullCompliance: complianceResult,
      };

      results.push(result);

      // 個別結果をJSONファイルに保存
      const filename = `${target.id}.json`;
      writeFileSync(
        resolve(RESULTS_DIR, filename),
        JSON.stringify(result, null, 2),
        "utf-8"
      );

      console.log(`  Title: ${article.title}`);
      console.log(`  Content Length: ${article.content.length} chars`);
      console.log(`  Sections: ${article.sections.length} (+ ${subsectionCount} subsections)`);
      console.log(`  Compliance Score: ${complianceResult.score}/100`);
      console.log(`  Violations: ${complianceResult.violations.length}`);
      console.log(`  E-E-A-T Score: ${eeatScore.total}/100`);
      console.log(`  PR Disclosure: ${complianceResult.hasPRDisclosure ? "YES" : "NO"}`);
      console.log(`  Model: ${response.model}`);
      console.log(`  Processing Time: ${response.processingTimeMs ?? 0}ms`);
      console.log(`  Saved: ${filename}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  ERROR: ${errorMessage}`);

      results.push({
        target,
        success: false,
        isDryRun,
        model: "error",
        generatedAt: new Date().toISOString(),
        processingTimeMs: 0,
        error: errorMessage,
      });
    }
  }

  // サマリーを保存
  const summary: PilotSummary = {
    executedAt: new Date().toISOString(),
    isDryRun,
    totalArticles: PILOT_TARGETS.length,
    successCount: results.filter((r) => r.success).length,
    failedCount: results.filter((r) => !r.success).length,
    totalProcessingTimeMs: Date.now() - overallStart,
    results,
  };

  writeFileSync(
    resolve(RESULTS_DIR, "summary.json"),
    JSON.stringify(summary, null, 2),
    "utf-8"
  );

  // 最終レポート
  console.log("\n" + "=".repeat(60));
  console.log("GENERATION COMPLETE");
  console.log("=".repeat(60));
  console.log(`  Mode: ${isDryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`  Total Articles: ${summary.totalArticles}`);
  console.log(`  Successes: ${summary.successCount}`);
  console.log(`  Failures: ${summary.failedCount}`);
  console.log(`  Total Time: ${summary.totalProcessingTimeMs}ms`);
  console.log(`  Results saved to: scripts/pilot-results/`);
  console.log("=".repeat(60));

  // レポート生成スクリプトの案内
  console.log("\nNext step: Run the report generator:");
  console.log("  npx tsx scripts/pilot-report.ts");

  // 失敗があった場合は exit code 1
  if (summary.failedCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n[FATAL ERROR]", err);
  process.exit(1);
});
