/**
 * SEO指示プロンプト
 * タイトル・メタディスクリプション・見出し構造・キーワード最適化の指示
 */

/** SEOプロンプト定数 */
const SEO_INSTRUCTIONS = `
## SEO最適化指示

### タイトル（title タグ）
- 文字数: 30〜35文字（Googleの表示上限を考慮）
- メインキーワードを必ず冒頭に配置
- 数字・年を含めると CTR 向上に有効（例: 「2024年最新版」「5つの選び方」）
- 記事タイプを明示（「比較」「ランキング」「解説」等）
- NG: 「確実に」「必ず」「最強」等の誇大表現
- 例: 「AGA治療クリニック比較【2024年】おすすめ5選と選び方」

### メタディスクリプション
- 文字数: 120文字以内（モバイルでの表示を考慮）
- メインキーワードとサブキーワードを自然に含める
- 記事の価値提案を明確に（「この記事でわかること」を端的に）
- CTA要素を含める（「詳しく解説」「徹底比較」等）
- NG: キーワードの羅列（スパムと認識されるリスク）

### 見出し構造（H2/H3/H4）
- H1: 記事タイトル（1つのみ、自動生成）
- H2: 大項目（3〜5個）— メインキーワードの関連語を含める
- H3: 中項目（各H2に2〜4個）— ロングテールキーワードを含める
- H4: 小項目（必要な場合のみ）
- 見出しは検索ユーザーの疑問を答える形式にする（「〜とは？」「〜の選び方」等）

### キーワード最適化
- メインキーワードの密度: 1〜2%（詰め込みすぎない）
- LSIキーワード（関連語・同義語）を自然に分散配置
- 冒頭100文字以内にメインキーワードを含める
- Alt属性の指示: 画像には「{{keyword}}の説明画像」等を設定すること

### 内部リンク・外部リンク
- 内部リンク: 関連記事への誘導（「詳しくはこちら」ではなく具体的なアンカーテキスト）
- 外部リンク: 信頼性の高いサイトのみ（厚労省、学会、PubMed等）
  - rel="noopener noreferrer" を付与
  - アフィリエイトリンクは rel="sponsored noopener" を付与

### 構造化データのヒント
- 記事スキーマ（Article）: datePublished, dateModified, author, publisher を含める
- FAQページスキーマ: まとめセクションに質問形式のQ&Aを追加することを推奨
- 医療コンテンツのため MedicalWebPage スキーマも検討
`.trim();

/** 検索意図別の構成パターン */
const SEARCH_INTENT_PATTERNS = {
  /** 情報収集型（Informational）*/
  informational: `
- 「〜とは？」「〜の仕組み」を冒頭で説明
- 専門用語は初出時に括弧内で説明
- 図解・表を積極的に活用（マークダウンの表形式で記述）
- まとめに要点の箇条書きを必ず含める
`.trim(),

  /** 比較・検討型（Investigational）*/
  investigational: `
- 比較表を記事前半に配置（読者がスキャンしやすいよう）
- 評価軸を明確に定義（価格・品質・利便性等）
- 各商品・サービスの「こんな人におすすめ」を明記
- 総合評価の根拠を必ず示す
`.trim(),

  /** 取引・購買型（Transactional）*/
  transactional: `
- 「今すぐ申し込む方法」等、行動に移しやすい手順を記載
- 申込フロー（ステップ）を番号付きで説明
- よくある疑問（FAQ）を先回りして解消
- CTAは記事末尾だけでなく、中盤にも1回程度挿入
`.trim(),
} as const;

export type SearchIntent = keyof typeof SEARCH_INTENT_PATTERNS;

/**
 * SEOプロンプト全体を取得する
 */
export function getSEOPrompt(): string {
  return SEO_INSTRUCTIONS;
}

/**
 * 検索意図別の構成パターン指示を取得する
 * @param intent 検索意図
 */
export function getSearchIntentPattern(intent: SearchIntent): string {
  return SEARCH_INTENT_PATTERNS[intent];
}

/**
 * キーワードとターゲット文字数を含むSEOプロンプトを構築する
 * @param keyword メインキーワード
 * @param subKeywords サブキーワードリスト
 * @param intent 検索意図
 */
export function buildSEOPrompt(
  keyword: string,
  subKeywords: string[] = [],
  intent: SearchIntent = "informational"
): string {
  const subKeywordSection = subKeywords.length > 0
    ? `\n### サブキーワード（自然に分散配置）\n${subKeywords.map((k) => `- ${k}`).join("\n")}`
    : "";

  return `${SEO_INSTRUCTIONS}

### 対象キーワード情報
- メインキーワード: **${keyword}**${subKeywordSection}
- 検索意図: ${intent === "informational" ? "情報収集型" : intent === "investigational" ? "比較・検討型" : "取引・購買型"}

### 検索意図に合わせた構成指示
${SEARCH_INTENT_PATTERNS[intent]}`;
}
