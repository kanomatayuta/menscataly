/**
 * トレンド分析エンジン
 * Claude Haiku 4.5 を使用してキーワード競合度・検索意図の分析と
 * トレンドスコアリング（話題性 × 収益性 × 競合度）を実行する
 */

import { createAnalysisClient } from "./client";
import type { KeywordAnalysis, ScoredTrend, TrendData } from "./types";

// ============================================================
// システムプロンプト
// ============================================================

const KEYWORD_ANALYSIS_SYSTEM_PROMPT = `あなたはメンズ医療・美容メディア「MENS CATALY」のSEOアナリストです。
以下の専門領域を担当しています:
- AGA（男性型脱毛症）治療
- 医療脱毛・エステ脱毛
- メンズスキンケア
- ED（勃起不全）治療

与えられたキーワードリストを分析し、各キーワードについて以下を評価してください:
1. 検索意図（informational / investigational / transactional）
2. 競合度（0-100、高いほど競合激しい）
3. 推定検索ボリューム（low / medium / high）
4. 収益性スコア（0-100、アフィリエイト収益の期待値）
5. 関連サブキーワード（最大5個）
6. 推奨カテゴリ（aga / hair-removal / skincare / ed）

必ずJSON形式で出力してください。薬機法NG表現（効果断定・完治等）は分析コメントに含めないこと。`;

const TREND_SCORING_SYSTEM_PROMPT = `あなたはメンズ医療・美容メディア「MENS CATALY」のコンテンツ戦略アナリストです。
与えられたトレンドデータリストをスコアリングし、記事化の優先度を判定してください。

評価基準:
1. 話題性スコア（trendScore を基に 0-100 で評価）
2. 収益性スコア（アフィリエイト報酬の高さ、購買意欲の高さを 0-100 で評価）
3. 競合度スコア（0-100、低いほど参入しやすい）
4. 総合優先度（話題性 × 0.3 + 収益性 × 0.4 + (100 - 競合度) × 0.3）

推奨アクション:
- create: 優先度70以上 → 即記事化を推奨
- monitor: 優先度40-69 → 引き続き監視
- skip: 優先度39以下 → 現時点では見送り

必ずJSON形式で出力してください。`;

// ============================================================
// モック生成ヘルパー
// ============================================================

function generateMockKeywordAnalysis(keywords: string[]): KeywordAnalysis[] {
  return keywords.map((keyword) => ({
    keyword,
    searchIntent: "informational" as const,
    competitionScore: 50,
    searchVolume: "medium" as const,
    monetizationScore: 60,
    relatedKeywords: [
      `${keyword} 効果`,
      `${keyword} 費用`,
      `${keyword} 口コミ`,
    ],
    recommendedCategory: "aga",
    notes: "[MOCK] ANTHROPIC_API_KEY が未設定のため、モック分析結果を返しています。",
  }));
}

function generateMockScoredTrends(trends: TrendData[]): ScoredTrend[] {
  return trends.map((trend) => ({
    ...trend,
    topicalityScore: trend.trendScore,
    revenueScore: 60,
    competitionScore: 50,
    priorityScore: trend.trendScore * 0.3 + 60 * 0.4 + (100 - 50) * 0.3,
    recommendation: "monitor" as const,
    rationale:
      "[MOCK] ANTHROPIC_API_KEY が未設定のため、モックスコアリング結果を返しています。",
  }));
}

// ============================================================
// レスポンスパーサー
// ============================================================

/**
 * Claude のJSON出力からキーワード分析結果を抽出する
 */
function parseKeywordAnalysisResponse(
  content: string,
  originalKeywords: string[]
): KeywordAnalysis[] {
  try {
    // JSON コードブロックを抽出
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;

    const parsed = JSON.parse(jsonStr) as unknown;

    // 配列形式かオブジェクト形式かを判定
    const analyses: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as Record<string, unknown>)["analyses"])
        ? ((parsed as Record<string, unknown>)["analyses"] as unknown[])
        : [];

    if (analyses.length === 0) {
      throw new Error("No analyses found in response");
    }

    return analyses.map((item, index) => {
      const a = item as Record<string, unknown>;
      return {
        keyword: typeof a["keyword"] === "string" ? a["keyword"] : originalKeywords[index] ?? "",
        searchIntent: (["informational", "investigational", "transactional"].includes(
          a["searchIntent"] as string
        )
          ? a["searchIntent"]
          : "informational") as KeywordAnalysis["searchIntent"],
        competitionScore:
          typeof a["competitionScore"] === "number" ? Math.min(100, Math.max(0, a["competitionScore"])) : 50,
        searchVolume: (["low", "medium", "high"].includes(a["searchVolume"] as string)
          ? a["searchVolume"]
          : "medium") as KeywordAnalysis["searchVolume"],
        monetizationScore:
          typeof a["monetizationScore"] === "number" ? Math.min(100, Math.max(0, a["monetizationScore"])) : 50,
        relatedKeywords: Array.isArray(a["relatedKeywords"])
          ? (a["relatedKeywords"] as string[]).slice(0, 5)
          : [],
        recommendedCategory:
          typeof a["recommendedCategory"] === "string" ? a["recommendedCategory"] : "aga",
        notes: typeof a["notes"] === "string" ? a["notes"] : undefined,
      };
    });
  } catch (error) {
    console.warn(
      "[TrendAnalyzer] Failed to parse keyword analysis response. Returning fallback.",
      error instanceof Error ? error.message : error
    );
    return generateMockKeywordAnalysis(originalKeywords);
  }
}

/**
 * Claude のJSON出力からスコアリング済みトレンドを抽出する
 */
function parseScoredTrendsResponse(
  content: string,
  originalTrends: TrendData[]
): ScoredTrend[] {
  try {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : content;

    const parsed = JSON.parse(jsonStr) as unknown;
    const scored: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as Record<string, unknown>)["scoredTrends"])
        ? ((parsed as Record<string, unknown>)["scoredTrends"] as unknown[])
        : [];

    if (scored.length === 0) {
      throw new Error("No scored trends found in response");
    }

    return scored.map((item, index) => {
      const s = item as Record<string, unknown>;
      const original = originalTrends[index] ?? { keyword: "", trendScore: 0 };

      const topicalityScore = typeof s["topicalityScore"] === "number"
        ? Math.min(100, Math.max(0, s["topicalityScore"])) : original.trendScore;
      const revenueScore = typeof s["revenueScore"] === "number"
        ? Math.min(100, Math.max(0, s["revenueScore"])) : 50;
      const competitionScore = typeof s["competitionScore"] === "number"
        ? Math.min(100, Math.max(0, s["competitionScore"])) : 50;
      const priorityScore = typeof s["priorityScore"] === "number"
        ? Math.min(100, Math.max(0, s["priorityScore"]))
        : topicalityScore * 0.3 + revenueScore * 0.4 + (100 - competitionScore) * 0.3;

      const recommendation = (["create", "monitor", "skip"].includes(s["recommendation"] as string)
        ? s["recommendation"]
        : priorityScore >= 70 ? "create" : priorityScore >= 40 ? "monitor" : "skip") as ScoredTrend["recommendation"];

      return {
        keyword: typeof s["keyword"] === "string" ? s["keyword"] : original.keyword,
        trendScore: original.trendScore,
        category: original.category,
        metadata: original.metadata,
        topicalityScore,
        revenueScore,
        competitionScore,
        priorityScore,
        recommendation,
        rationale:
          typeof s["rationale"] === "string"
            ? s["rationale"]
            : `優先度スコア: ${priorityScore.toFixed(1)}`,
      };
    });
  } catch (error) {
    console.warn(
      "[TrendAnalyzer] Failed to parse scored trends response. Returning fallback.",
      error instanceof Error ? error.message : error
    );
    return generateMockScoredTrends(originalTrends);
  }
}

// ============================================================
// TrendAnalyzer クラス
// ============================================================

/**
 * トレンド分析エンジン
 * Claude Haiku 4.5 を使ってキーワード分析・トレンドスコアリングを実行する
 *
 * @example
 * ```ts
 * const analyzer = new TrendAnalyzer();
 *
 * // キーワード分析
 * const analyses = await analyzer.analyzeKeywords(["AGA 治療", "ミノキシジル 効果"]);
 * console.log(analyses[0].searchIntent); // "informational"
 *
 * // トレンドスコアリング
 * const scored = await analyzer.scoreTrends([
 *   { keyword: "AGA 治療", trendScore: 80 },
 *   { keyword: "育毛剤", trendScore: 60 },
 * ]);
 * console.log(scored[0].recommendation); // "create" | "monitor" | "skip"
 * ```
 */
export class TrendAnalyzer {
  private readonly client = createAnalysisClient();

  /**
   * キーワードリストの競合度・検索意図を Claude Haiku 4.5 で分析する
   * ANTHROPIC_API_KEY が未設定の場合はモック結果を返す
   *
   * @param keywords 分析するキーワードリスト
   * @returns キーワード分析結果リスト
   */
  async analyzeKeywords(keywords: string[]): Promise<KeywordAnalysis[]> {
    if (keywords.length === 0) {
      return [];
    }

    if (this.client.isDryRun) {
      console.info(
        "[TrendAnalyzer] Dry-run mode: returning mock keyword analyses."
      );
      return generateMockKeywordAnalysis(keywords);
    }

    const userMessage = `以下のキーワードリストを分析してください。
各キーワードについて、JSON配列形式で分析結果を出力してください。

キーワードリスト:
${keywords.map((k, i) => `${i + 1}. ${k}`).join("\n")}

出力形式（JSONコードブロック内に配列で記述）:
\`\`\`json
[
  {
    "keyword": "キーワード",
    "searchIntent": "informational | investigational | transactional",
    "competitionScore": 0-100,
    "searchVolume": "low | medium | high",
    "monetizationScore": 0-100,
    "relatedKeywords": ["関連キーワード1", "関連キーワード2"],
    "recommendedCategory": "aga | hair-removal | skincare | ed",
    "notes": "分析メモ（任意）"
  }
]
\`\`\``;

    const response = await this.client.generate({
      systemPrompt: KEYWORD_ANALYSIS_SYSTEM_PROMPT,
      userMessage,
    });

    return parseKeywordAnalysisResponse(response.content, keywords);
  }

  /**
   * トレンドデータリストをスコアリングする（話題性 × 収益性 × 競合度）
   * ANTHROPIC_API_KEY が未設定の場合はモック結果を返す
   *
   * @param trends スコアリングするトレンドデータリスト
   * @returns スコアリング済みトレンドリスト（優先度降順）
   */
  async scoreTrends(trends: TrendData[]): Promise<ScoredTrend[]> {
    if (trends.length === 0) {
      return [];
    }

    if (this.client.isDryRun) {
      console.info(
        "[TrendAnalyzer] Dry-run mode: returning mock scored trends."
      );
      return generateMockScoredTrends(trends);
    }

    const userMessage = `以下のトレンドデータをスコアリングしてください。
各トレンドについて、話題性・収益性・競合度を評価し、記事化の優先度を判定してください。

トレンドデータ:
${JSON.stringify(trends, null, 2)}

出力形式（JSONコードブロック内に配列で記述）:
\`\`\`json
[
  {
    "keyword": "キーワード",
    "topicalityScore": 0-100,
    "revenueScore": 0-100,
    "competitionScore": 0-100,
    "priorityScore": 0-100,
    "recommendation": "create | monitor | skip",
    "rationale": "スコアリング根拠（100文字以内）"
  }
]
\`\`\``;

    const response = await this.client.generate({
      systemPrompt: TREND_SCORING_SYSTEM_PROMPT,
      userMessage,
    });

    const scored = parseScoredTrendsResponse(response.content, trends);

    // 優先度スコア降順でソート
    return scored.sort((a, b) => b.priorityScore - a.priorityScore);
  }
}
