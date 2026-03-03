/**
 * AI クライアント 型定義
 * Claude Sonnet 4.6 (記事生成) / Claude Haiku 4.5 (分析) 用
 */

// ============================================================
// モデル設定
// ============================================================

/** Claude モデル設定 */
export interface ModelConfig {
  /** モデルID */
  modelId: string;
  /** 最大トークン数 */
  maxTokens: number;
  /** Temperature (0.0 - 1.0) */
  temperature: number;
  /** トップP */
  topP?: number;
}

/** デフォルトモデル設定: Sonnet 4.6 (記事生成) */
export const DEFAULT_ARTICLE_MODEL_CONFIG: ModelConfig = {
  modelId: process.env.ANTHROPIC_MODEL_ARTICLE ?? "claude-sonnet-4-6",
  maxTokens: 8192,
  temperature: 0.7,
  topP: 0.9,
};

/** デフォルトモデル設定: Haiku 4.5 (分析) */
export const DEFAULT_ANALYSIS_MODEL_CONFIG: ModelConfig = {
  modelId: process.env.ANTHROPIC_MODEL_ANALYSIS ?? "claude-haiku-4-5-20251001",
  maxTokens: 4096,
  temperature: 0.3,
};

// ============================================================
// トークン使用量
// ============================================================

/** トークン使用量 */
export interface TokenUsage {
  /** 入力トークン数 */
  inputTokens: number;
  /** 出力トークン数 */
  outputTokens: number;
  /** 合計トークン数 */
  totalTokens: number;
  /** 推定コスト（USD） */
  estimatedCostUsd?: number;
}

// ============================================================
// AI リクエスト / レスポンス
// ============================================================

/** AI リクエスト */
export interface AIRequest {
  /** システムプロンプト */
  systemPrompt: string;
  /** ユーザーメッセージ */
  userMessage: string;
  /** モデル設定（省略時はデフォルト使用） */
  modelConfig?: Partial<ModelConfig>;
  /** リトライ回数（デフォルト: 3） */
  maxRetries?: number;
}

/** AI レスポンス */
export interface AIResponse {
  /** 生成テキスト */
  content: string;
  /** 使用したモデルID */
  model: string;
  /** トークン使用量 */
  tokenUsage: TokenUsage;
  /** 応答時間（ms） */
  durationMs: number;
  /** 停止理由 */
  stopReason?: string;
}

// ============================================================
// トレンド分析
// ============================================================

/** キーワード分析結果 */
export interface KeywordAnalysis {
  /** キーワード */
  keyword: string;
  /** 検索意図（informational / investigational / transactional） */
  searchIntent: "informational" | "investigational" | "transactional";
  /** 競合度（0-100、100が最も競合が激しい） */
  competitionScore: number;
  /** 推定月間検索ボリューム（相対スコア: low / medium / high） */
  searchVolume: "low" | "medium" | "high";
  /** 収益性スコア（0-100） */
  monetizationScore: number;
  /** 関連サブキーワード */
  relatedKeywords: string[];
  /** 推奨カテゴリ */
  recommendedCategory: string;
  /** 分析メモ */
  notes?: string;
}

/** トレンドデータ入力 */
export interface TrendData {
  /** キーワード */
  keyword: string;
  /** トレンドスコア（例: Google Trendsの0-100） */
  trendScore: number;
  /** カテゴリ */
  category?: string;
  /** 追加メタデータ */
  metadata?: Record<string, unknown>;
}

/** スコアリング済みトレンド */
export interface ScoredTrend extends TrendData {
  /** 話題性スコア（0-100） */
  topicalityScore: number;
  /** 収益性スコア（0-100） */
  revenueScore: number;
  /** 競合度スコア（0-100、低いほど優位） */
  competitionScore: number;
  /** 総合優先度スコア（0-100） */
  priorityScore: number;
  /** 推奨アクション */
  recommendation: "create" | "monitor" | "skip";
  /** スコアリング根拠 */
  rationale: string;
}
