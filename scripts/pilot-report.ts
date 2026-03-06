/**
 * パイロット生成結果レポートスクリプト
 *
 * scripts/pilot-results/ に保存された生成結果を読み込み、
 * 品質レポートを生成して REPORT.md に出力する。
 *
 * Usage:
 *   npx tsx scripts/pilot-report.ts
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync, existsSync } from "fs";

// ============================================================
// パス解決
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RESULTS_DIR = resolve(__dirname, "pilot-results");
const REPORT_PATH = resolve(RESULTS_DIR, "REPORT.md");

// ============================================================
// 型（pilot-generate.ts の型を再定義 — スクリプト独立性確保）
// ============================================================

interface PilotTarget {
  id: string;
  category: string;
  keyword: string;
  subKeywords: string[];
  targetAudience: string;
  targetLength: number;
  tone: string;
}

interface ArticleSummary {
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
}

interface ComplianceSummary {
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
}

interface EEATSummary {
  total: number;
  experience: number;
  expertise: number;
  authoritativeness: number;
  trustworthiness: number;
  details: string[];
}

interface PilotResult {
  target: PilotTarget;
  success: boolean;
  isDryRun: boolean;
  article?: ArticleSummary;
  compliance?: ComplianceSummary;
  eeat?: EEATSummary;
  model: string;
  generatedAt: string;
  processingTimeMs: number;
  error?: string;
}

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
// カテゴリラベル
// ============================================================

const CATEGORY_LABELS: Record<string, string> = {
  aga: "AGA治療",
  ed: "ED治療",
  "hair-removal": "医療脱毛",
  skincare: "スキンケア",
  supplement: "サプリメント",
};

// ============================================================
// レポート生成
// ============================================================

function generateReport(summary: PilotSummary): string {
  const lines: string[] = [];
  const now = new Date().toISOString().split("T")[0];

  lines.push("# MENS CATALY - Pilot Article Generation Report");
  lines.push("");
  lines.push(`**Generated**: ${now}`);
  lines.push(`**Execution Date**: ${summary.executedAt}`);
  lines.push(`**Mode**: ${summary.isDryRun ? "DRY RUN (Mock Responses)" : "LIVE (Claude API)"}`);
  lines.push(`**Total Articles**: ${summary.totalArticles}`);
  lines.push(`**Success / Failed**: ${summary.successCount} / ${summary.failedCount}`);
  lines.push(`**Total Processing Time**: ${(summary.totalProcessingTimeMs / 1000).toFixed(1)}s`);
  lines.push("");

  // ============================================================
  // 全体サマリーテーブル
  // ============================================================

  lines.push("## 1. Overall Summary");
  lines.push("");
  lines.push("| Category | Keyword | Content Length | Sections | Compliance Score | E-E-A-T Score | PR Disclosure | Status |");
  lines.push("|----------|---------|---------------|----------|-----------------|---------------|---------------|--------|");

  const successResults = summary.results.filter((r) => r.success && r.article && r.compliance);

  for (const r of summary.results) {
    if (r.success && r.article && r.compliance) {
      const cat = CATEGORY_LABELS[r.target.category] ?? r.target.category;
      const compStatus = r.compliance.isCompliant ? "PASS" : "FAIL";
      lines.push(
        `| ${cat} | ${r.target.keyword} | ${r.article.contentLength.toLocaleString()} chars | ${r.article.sectionCount} + ${r.article.subsectionCount} sub | ${r.compliance.score}/100 | ${r.eeat?.total ?? "N/A"}/100 | ${r.compliance.hasPRDisclosure ? "Yes" : "No"} | ${compStatus} |`
      );
    } else {
      const cat = CATEGORY_LABELS[r.target.category] ?? r.target.category;
      lines.push(
        `| ${cat} | ${r.target.keyword} | - | - | - | - | - | ERROR: ${r.error?.slice(0, 50) ?? "Unknown"} |`
      );
    }
  }

  lines.push("");

  // ============================================================
  // 2. コンプライアンス分析
  // ============================================================

  lines.push("## 2. Compliance Analysis");
  lines.push("");

  if (successResults.length > 0) {
    const avgComplianceScore =
      successResults.reduce((sum, r) => sum + (r.compliance?.score ?? 0), 0) /
      successResults.length;
    const totalViolations = successResults.reduce(
      (sum, r) => sum + (r.compliance?.violationCount ?? 0),
      0
    );
    const compliantCount = successResults.filter(
      (r) => r.compliance?.isCompliant
    ).length;
    const prDisclosureCount = successResults.filter(
      (r) => r.compliance?.hasPRDisclosure
    ).length;

    lines.push(`- **Average Compliance Score**: ${avgComplianceScore.toFixed(1)}/100`);
    lines.push(`- **Compliant Articles**: ${compliantCount}/${successResults.length}`);
    lines.push(`- **Total Violations**: ${totalViolations}`);
    lines.push(`- **PR Disclosure Present**: ${prDisclosureCount}/${successResults.length}`);
    lines.push("");

    // 違反タイプ別集計
    const allViolationsByType: Record<string, number> = {};
    const allViolationsBySeverity: Record<string, number> = { high: 0, medium: 0, low: 0 };

    for (const r of successResults) {
      if (r.compliance) {
        for (const [type, count] of Object.entries(r.compliance.violationsByType)) {
          allViolationsByType[type] = (allViolationsByType[type] ?? 0) + count;
        }
        for (const [severity, count] of Object.entries(r.compliance.violationsBySeverity)) {
          allViolationsBySeverity[severity] = (allViolationsBySeverity[severity] ?? 0) + count;
        }
      }
    }

    lines.push("### 2.1 Violations by Type");
    lines.push("");
    lines.push("| Violation Type | Count |");
    lines.push("|---------------|-------|");
    for (const [type, count] of Object.entries(allViolationsByType).sort(
      (a, b) => b[1] - a[1]
    )) {
      lines.push(`| ${type} | ${count} |`);
    }
    if (Object.keys(allViolationsByType).length === 0) {
      lines.push("| (none) | 0 |");
    }
    lines.push("");

    lines.push("### 2.2 Violations by Severity");
    lines.push("");
    lines.push("| Severity | Count |");
    lines.push("|----------|-------|");
    lines.push(`| High | ${allViolationsBySeverity.high ?? 0} |`);
    lines.push(`| Medium | ${allViolationsBySeverity.medium ?? 0} |`);
    lines.push(`| Low | ${allViolationsBySeverity.low ?? 0} |`);
    lines.push("");

    // Missing Items 集計
    const allMissingItems: Record<string, number> = {};
    for (const r of successResults) {
      if (r.compliance) {
        for (const item of r.compliance.missingItems) {
          allMissingItems[item] = (allMissingItems[item] ?? 0) + 1;
        }
      }
    }
    if (Object.keys(allMissingItems).length > 0) {
      lines.push("### 2.3 Missing Required Elements");
      lines.push("");
      lines.push("| Missing Element | Articles Affected |");
      lines.push("|----------------|-------------------|");
      for (const [item, count] of Object.entries(allMissingItems).sort(
        (a, b) => b[1] - a[1]
      )) {
        lines.push(`| ${item} | ${count}/${successResults.length} |`);
      }
      lines.push("");
    }

    // Top NG Expressions
    const allTopViolations: Array<{ ngText: string; suggestedText: string; severity: string; reason: string; category: string }> = [];
    for (const r of successResults) {
      if (r.compliance) {
        for (const v of r.compliance.topViolations) {
          allTopViolations.push({ ...v, category: r.target.category });
        }
      }
    }

    if (allTopViolations.length > 0) {
      lines.push("### 2.4 Top NG Expressions Found");
      lines.push("");
      lines.push("| Category | NG Expression | Suggested Fix | Severity | Reason |");
      lines.push("|----------|--------------|---------------|----------|--------|");
      for (const v of allTopViolations.slice(0, 15)) {
        const cat = CATEGORY_LABELS[v.category] ?? v.category;
        const ng = v.ngText.length > 30 ? v.ngText.slice(0, 30) + "..." : v.ngText;
        const ok = v.suggestedText.length > 40 ? v.suggestedText.slice(0, 40) + "..." : v.suggestedText;
        lines.push(`| ${cat} | ${ng} | ${ok} | ${v.severity} | ${v.reason.slice(0, 50)} |`);
      }
      lines.push("");
    }
  }

  // ============================================================
  // 3. E-E-A-T 分析
  // ============================================================

  lines.push("## 3. E-E-A-T Analysis");
  lines.push("");

  if (successResults.length > 0) {
    const eeatResults = successResults.filter((r) => r.eeat);

    if (eeatResults.length > 0) {
      const avgTotal = eeatResults.reduce((s, r) => s + (r.eeat?.total ?? 0), 0) / eeatResults.length;
      const avgExp = eeatResults.reduce((s, r) => s + (r.eeat?.experience ?? 0), 0) / eeatResults.length;
      const avgExpert = eeatResults.reduce((s, r) => s + (r.eeat?.expertise ?? 0), 0) / eeatResults.length;
      const avgAuth = eeatResults.reduce((s, r) => s + (r.eeat?.authoritativeness ?? 0), 0) / eeatResults.length;
      const avgTrust = eeatResults.reduce((s, r) => s + (r.eeat?.trustworthiness ?? 0), 0) / eeatResults.length;

      lines.push("### 3.1 Average E-E-A-T Scores");
      lines.push("");
      lines.push("| Dimension | Average Score | Max Possible |");
      lines.push("|-----------|--------------|--------------|");
      lines.push(`| **Total** | **${avgTotal.toFixed(1)}** | **100** |`);
      lines.push(`| Experience | ${avgExp.toFixed(1)} | 25 |`);
      lines.push(`| Expertise | ${avgExpert.toFixed(1)} | 25 |`);
      lines.push(`| Authoritativeness | ${avgAuth.toFixed(1)} | 25 |`);
      lines.push(`| Trustworthiness | ${avgTrust.toFixed(1)} | 25 |`);
      lines.push("");

      lines.push("### 3.2 E-E-A-T by Category");
      lines.push("");
      lines.push("| Category | Total | Experience | Expertise | Authority | Trust |");
      lines.push("|----------|-------|------------|-----------|-----------|-------|");
      for (const r of eeatResults) {
        const cat = CATEGORY_LABELS[r.target.category] ?? r.target.category;
        const e = r.eeat!;
        lines.push(
          `| ${cat} | ${e.total} | ${e.experience} | ${e.expertise} | ${e.authoritativeness} | ${e.trustworthiness} |`
        );
      }
      lines.push("");

      // E-E-A-T 改善ポイント
      lines.push("### 3.3 E-E-A-T Improvement Details");
      lines.push("");
      for (const r of eeatResults) {
        const cat = CATEGORY_LABELS[r.target.category] ?? r.target.category;
        lines.push(`#### ${cat}`);
        lines.push("");
        for (const detail of r.eeat!.details) {
          lines.push(`- ${detail}`);
        }
        lines.push("");
      }
    }
  }

  // ============================================================
  // 4. カテゴリ別詳細
  // ============================================================

  lines.push("## 4. Category Details");
  lines.push("");

  for (const r of summary.results) {
    const cat = CATEGORY_LABELS[r.target.category] ?? r.target.category;
    lines.push(`### ${cat}`);
    lines.push("");

    if (!r.success) {
      lines.push(`**Status**: ERROR`);
      lines.push(`**Error**: ${r.error}`);
      lines.push("");
      continue;
    }

    if (r.article) {
      lines.push(`- **Title**: ${r.article.title}`);
      lines.push(`- **Slug**: ${r.article.slug}`);
      lines.push(`- **Content Length**: ${r.article.contentLength.toLocaleString()} characters`);
      lines.push(`- **Sections**: ${r.article.sectionCount} main + ${r.article.subsectionCount} sub`);
      lines.push(`- **Reading Time**: ${r.article.readingTime} min`);
      lines.push(`- **Has Supervisor**: ${r.article.hasSupervisor ? "Yes" : "No"}`);
      lines.push(`- **References**: ${r.article.referenceCount}`);
      lines.push(`- **Tags**: ${r.article.tags.join(", ")}`);
    }

    if (r.compliance) {
      lines.push(`- **Compliance Score**: ${r.compliance.score}/100`);
      lines.push(`- **Is Compliant**: ${r.compliance.isCompliant ? "Yes" : "No"}`);
      lines.push(`- **Violations**: ${r.compliance.violationCount}`);
      lines.push(`- **PR Disclosure**: ${r.compliance.hasPRDisclosure ? "Yes" : "No"}`);
      if (r.compliance.missingItems.length > 0) {
        lines.push(`- **Missing Items**: ${r.compliance.missingItems.join(", ")}`);
      }
    }

    if (r.eeat) {
      lines.push(`- **E-E-A-T Total**: ${r.eeat.total}/100`);
    }

    lines.push(`- **Model**: ${r.model}`);
    lines.push(`- **Processing Time**: ${r.processingTimeMs}ms`);
    lines.push("");
  }

  // ============================================================
  // 5. 改善提案
  // ============================================================

  lines.push("## 5. Improvement Recommendations");
  lines.push("");

  const improvements: string[] = [];

  // コンプライアンス改善
  const avgScore = successResults.length > 0
    ? successResults.reduce((s, r) => s + (r.compliance?.score ?? 0), 0) / successResults.length
    : 0;

  if (avgScore < 95) {
    improvements.push(
      "**Compliance Score Improvement**: Average compliance score is below 95. Review and strengthen NG expression dictionaries, especially for the categories with lowest scores."
    );
  }

  const noPRResults = successResults.filter((r) => !r.compliance?.hasPRDisclosure);
  if (noPRResults.length > 0) {
    improvements.push(
      `**PR Disclosure**: ${noPRResults.length} article(s) lack PR disclosure. Ensure insertPRDisclosure() is called in the generation pipeline for all articles.`
    );
  }

  const noSupervisor = successResults.filter((r) => !r.article?.hasSupervisor);
  if (noSupervisor.length > 0) {
    improvements.push(
      `**Supervisor Information**: ${noSupervisor.length} article(s) lack supervisor information. YMYL content requires medical professional supervision.`
    );
  }

  const lowEEAT = successResults.filter((r) => (r.eeat?.total ?? 0) < 60);
  if (lowEEAT.length > 0) {
    improvements.push(
      `**E-E-A-T Scores**: ${lowEEAT.length} article(s) have E-E-A-T scores below 60. Focus on adding authoritative references, experience-based content, and disclaimer notes.`
    );
  }

  const shortArticles = successResults.filter(
    (r) => (r.article?.contentLength ?? 0) < 2000
  );
  if (shortArticles.length > 0) {
    improvements.push(
      `**Content Length**: ${shortArticles.length} article(s) have content shorter than 2,000 characters. Consider increasing targetLength or providing more detailed outlineHints.`
    );
  }

  // ドライラン時の注記
  if (summary.isDryRun) {
    improvements.push(
      "**Dry Run Note**: This report is based on mock/dummy articles. Results will differ significantly with actual Claude API responses. Re-run with ANTHROPIC_API_KEY set for production-quality results."
    );
  }

  if (improvements.length === 0) {
    lines.push("No critical improvements needed. All articles meet quality thresholds.");
  } else {
    for (let i = 0; i < improvements.length; i++) {
      lines.push(`${i + 1}. ${improvements[i]}`);
    }
  }

  lines.push("");

  // ============================================================
  // 6. Next Steps
  // ============================================================

  lines.push("## 6. Next Steps");
  lines.push("");
  lines.push("1. **Review generated articles** in `scripts/pilot-results/pilot-*.json`");
  lines.push("2. **Address compliance violations** by updating NG expression dictionaries");
  lines.push("3. **Improve E-E-A-T scores** by enhancing reference quality and supervisor info");
  lines.push("4. **Run with live API** if this was a dry run: `ANTHROPIC_API_KEY=<key> npx tsx scripts/pilot-generate.ts`");
  lines.push("5. **Proceed to production** once all articles pass compliance checks (score >= 95)");
  lines.push("");

  lines.push("---");
  lines.push("*Generated by MENS CATALY Pilot Article Generation Pipeline*");

  return lines.join("\n");
}

// ============================================================
// メイン処理
// ============================================================

function main() {
  console.log("=".repeat(60));
  console.log("MENS CATALY - Pilot Results Report Generator");
  console.log("=".repeat(60));

  // summary.json を読み込み
  const summaryPath = resolve(RESULTS_DIR, "summary.json");
  if (!existsSync(summaryPath)) {
    console.error(`\nERROR: ${summaryPath} not found.`);
    console.error("Run 'npx tsx scripts/pilot-generate.ts' first.");
    process.exit(1);
  }

  const summary: PilotSummary = JSON.parse(readFileSync(summaryPath, "utf-8"));

  console.log(`\nLoaded summary: ${summary.totalArticles} articles`);
  console.log(`  Mode: ${summary.isDryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`  Successes: ${summary.successCount}`);
  console.log(`  Failures: ${summary.failedCount}`);

  // レポート生成
  const report = generateReport(summary);

  // ファイルに書き出し
  writeFileSync(REPORT_PATH, report, "utf-8");

  console.log(`\nReport generated: ${REPORT_PATH}`);
  console.log(`Report length: ${report.length} characters`);

  // コンソールにも出力
  console.log("\n" + "=".repeat(60));
  console.log(report);
  console.log("=".repeat(60));
}

main();
