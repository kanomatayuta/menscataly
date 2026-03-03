/**
 * Claude API クライアント
 * Sonnet 4.6 (記事生成) / Haiku 4.5 (分析) の共通クライアント実装
 * レート制限対応: exponential backoff リトライ
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  AIRequest,
  AIResponse,
  ModelConfig,
  TokenUsage,
} from "./types";
import {
  DEFAULT_ARTICLE_MODEL_CONFIG,
  DEFAULT_ANALYSIS_MODEL_CONFIG,
} from "./types";

// ============================================================
// 定数
// ============================================================

/** レート制限エラー時の初期待機時間（ms） */
const INITIAL_RETRY_DELAY_MS = 1000;

/** リトライ時の最大待機時間（ms） */
const MAX_RETRY_DELAY_MS = 32000;

/** デフォルトのリトライ回数 */
const DEFAULT_MAX_RETRIES = 3;

/** Sonnet 4.6 の推定コスト (USD/1Mトークン) */
const SONNET_COST_PER_1M_INPUT = 3.0;
const SONNET_COST_PER_1M_OUTPUT = 15.0;

/** Haiku 4.5 の推定コスト (USD/1Mトークン) */
const HAIKU_COST_PER_1M_INPUT = 0.8;
const HAIKU_COST_PER_1M_OUTPUT = 4.0;

// ============================================================
// ユーティリティ
// ============================================================

/**
 * 指定ミリ秒スリープする
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exponential backoff の待機時間を計算する
 */
function calcBackoffDelay(attempt: number): number {
  const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
  return Math.min(delay, MAX_RETRY_DELAY_MS);
}

/**
 * モデルIDからコストを推定する
 */
function estimateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const isHaiku = modelId.includes("haiku");
  const inputCostPer1M = isHaiku ? HAIKU_COST_PER_1M_INPUT : SONNET_COST_PER_1M_INPUT;
  const outputCostPer1M = isHaiku ? HAIKU_COST_PER_1M_OUTPUT : SONNET_COST_PER_1M_OUTPUT;

  return (
    (inputTokens / 1_000_000) * inputCostPer1M +
    (outputTokens / 1_000_000) * outputCostPer1M
  );
}

/**
 * APIエラーがリトライ対象かどうか判定する
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Anthropic.RateLimitError) return true;
  if (error instanceof Anthropic.InternalServerError) return true;
  if (error instanceof Anthropic.APIConnectionError) return true;
  if (error instanceof Anthropic.APIConnectionTimeoutError) return true;
  return false;
}

// ============================================================
// クライアントファクトリ
// ============================================================

/**
 * 記事生成用 Claude Sonnet 4.6 クライアントを生成する
 *
 * @example
 * ```ts
 * const client = createArticleGenerationClient();
 * const response = await client.generate({
 *   systemPrompt: "あなたはライターです...",
 *   userMessage: "AGAについての記事を書いてください",
 * });
 * console.log(response.content);
 * ```
 */
export function createArticleGenerationClient(): ClaudeClient {
  return new ClaudeClient(DEFAULT_ARTICLE_MODEL_CONFIG);
}

/**
 * 分析用 Claude Haiku 4.5 クライアントを生成する
 *
 * @example
 * ```ts
 * const client = createAnalysisClient();
 * const response = await client.generate({
 *   systemPrompt: "あなたはSEOアナリストです...",
 *   userMessage: "以下のキーワードを分析してください: ...",
 * });
 * ```
 */
export function createAnalysisClient(): ClaudeClient {
  return new ClaudeClient(DEFAULT_ANALYSIS_MODEL_CONFIG);
}

// ============================================================
// ClaudeClient クラス
// ============================================================

/**
 * Claude API クライアント（低レベル）
 * レート制限対応のリトライ / exponential backoff を実装
 */
export class ClaudeClient {
  private readonly anthropic: Anthropic;
  private readonly modelConfig: ModelConfig;

  /** ANTHROPIC_API_KEY が未設定かどうか */
  readonly isDryRun: boolean;

  constructor(modelConfig: ModelConfig) {
    this.modelConfig = modelConfig;
    this.isDryRun = !process.env.ANTHROPIC_API_KEY;

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY ?? "dummy-key-for-dry-run",
    });
  }

  /**
   * Claude API にリクエストを送信する（リトライ付き）
   * ANTHROPIC_API_KEY が未設定の場合はモックレスポンスを返す
   */
  async generate(request: AIRequest): Promise<AIResponse> {
    if (this.isDryRun) {
      return this.generateMockResponse(request);
    }

    const effectiveConfig: ModelConfig = {
      ...this.modelConfig,
      ...request.modelConfig,
    };

    const maxRetries = request.maxRetries ?? DEFAULT_MAX_RETRIES;
    const startTime = Date.now();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const message = await this.anthropic.messages.create({
          model: effectiveConfig.modelId,
          max_tokens: effectiveConfig.maxTokens,
          temperature: effectiveConfig.temperature,
          ...(effectiveConfig.topP !== undefined && { top_p: effectiveConfig.topP }),
          system: request.systemPrompt,
          messages: [
            {
              role: "user",
              content: request.userMessage,
            },
          ],
        });

        const content = message.content
          .filter((block) => block.type === "text")
          .map((block) => (block as { type: "text"; text: string }).text)
          .join("");

        const inputTokens = message.usage.input_tokens;
        const outputTokens = message.usage.output_tokens;

        const tokenUsage: TokenUsage = {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          estimatedCostUsd: estimateCost(
            effectiveConfig.modelId,
            inputTokens,
            outputTokens
          ),
        };

        return {
          content,
          model: message.model,
          tokenUsage,
          durationMs: Date.now() - startTime,
          stopReason: message.stop_reason ?? undefined,
        };
      } catch (error) {
        if (attempt < maxRetries && isRetryableError(error)) {
          const delay = calcBackoffDelay(attempt);
          console.warn(
            `[ClaudeClient] Retryable error on attempt ${attempt + 1}/${maxRetries + 1}. Retrying in ${delay}ms...`,
            error instanceof Error ? error.message : error
          );
          await sleep(delay);
          continue;
        }
        throw error;
      }
    }

    // ここには到達しないが TypeScript の型制約のため
    throw new Error("[ClaudeClient] Max retries exceeded");
  }

  /**
   * ANTHROPIC_API_KEY 未設定時のモックレスポンスを返す
   */
  private generateMockResponse(request: AIRequest): AIResponse {
    console.info(
      "[ClaudeClient] ANTHROPIC_API_KEY is not set. Returning mock response."
    );

    const mockContent = `[MOCK RESPONSE - API Key not configured]

System: ${request.systemPrompt.slice(0, 100)}...
User: ${request.userMessage.slice(0, 100)}...

This is a mock response generated because ANTHROPIC_API_KEY is not set.
In production, this would be replaced with actual Claude API output.`;

    return {
      content: mockContent,
      model: this.modelConfig.modelId,
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
      },
      durationMs: 0,
      stopReason: "mock",
    };
  }
}
