/**
 * Phase 2 ロングテールキーワードリスト（30件）
 * 6カテゴリ × 5キーワード = 30記事分
 *
 * Categories:
 *   1. AGA治療 (5)
 *   2. ED治療 (5)
 *   3. 医療脱毛 (5)
 *   4. スキンケア (5)
 *   5. サプリメント (5)
 *   6. 総合比較 (5)
 *
 * 各キーワードには検索意図・推定ボリューム・競合難易度・ターゲットASP・
 * 記事タイプ・推奨タイトルを定義。
 */

// ============================================================
// 型定義
// ============================================================

/** 検索意図 */
export type SearchIntent =
  | 'informational'   // 情報収集（〜とは、〜の方法）
  | 'commercial'      // 商業調査（〜おすすめ、〜比較）
  | 'transactional'   // 購入・申込意向（〜購入、〜予約）
  | 'navigational'    // 特定サイト・サービスへの遷移

/** 記事タイプ */
export type ArticleType =
  | 'how-to'          // ハウツー・解説記事
  | 'comparison'      // 比較・ランキング記事
  | 'review'          // レビュー・体験記事
  | 'list'            // まとめ・リスト記事
  | 'guide'           // 総合ガイド記事
  | 'cost-analysis'   // 費用分析記事

/** Phase2 キーワードエントリ */
export interface Phase2Keyword {
  /** キーワードID */
  id: string
  /** メインキーワード */
  keyword: string
  /** カテゴリ */
  category: 'aga' | 'ed' | 'hair-removal' | 'skincare' | 'supplement' | 'comparison'
  /** 検索意図 */
  searchIntent: SearchIntent
  /** 推定月間検索ボリューム */
  estimatedVolume: number
  /** 競合難易度スコア（0-100、高いほど難しい） */
  difficultyScore: number
  /** ターゲットASP */
  targetASP: string[]
  /** 記事タイプ */
  articleType: ArticleType
  /** 推奨タイトル */
  suggestedTitle: string
  /** サブキーワード */
  subKeywords: string[]
  /** ターゲットオーディエンス */
  targetAudience: string
  /** 推奨文字数 */
  targetLength: number
}

// ============================================================
// AGA治療 キーワード × 5
// ============================================================

const AGA_PHASE2_KEYWORDS: Phase2Keyword[] = [
  {
    id: 'p2-aga-001',
    keyword: 'AGA治療 やめたらどうなる',
    category: 'aga',
    searchIntent: 'informational',
    estimatedVolume: 3600,
    difficultyScore: 28,
    targetASP: ['DMMオンラインクリニック', 'クリニックフォア', 'AGAスキンクリニック'],
    articleType: 'how-to',
    suggestedTitle: 'AGA治療をやめたらどうなる？中断リスクと正しい判断基準を医師監修で解説',
    subKeywords: ['AGA 治療 中断', 'フィナステリド やめたら', 'AGA 治療 一生', 'ミノキシジル 中止 影響'],
    targetAudience: 'AGA治療中で継続に迷っている30〜40代男性',
    targetLength: 4000,
  },
  {
    id: 'p2-aga-002',
    keyword: 'AGA治療 効果 いつから',
    category: 'aga',
    searchIntent: 'informational',
    estimatedVolume: 4400,
    difficultyScore: 32,
    targetASP: ['クリニックフォア', 'AGAヘアクリニック', 'DMMオンラインクリニック'],
    articleType: 'how-to',
    suggestedTitle: 'AGA治療の効果はいつから？3ヶ月・6ヶ月・1年の経過と実感時期を解説',
    subKeywords: ['AGA 効果 期間', 'フィナステリド 効果 いつ', 'ミノキシジル 効果 実感', 'AGA 経過 写真'],
    targetAudience: 'AGA治療を始めたばかり、または検討中の20〜40代男性',
    targetLength: 4500,
  },
  {
    id: 'p2-aga-003',
    keyword: 'AGA治療 女性化 リスク',
    category: 'aga',
    searchIntent: 'informational',
    estimatedVolume: 2400,
    difficultyScore: 25,
    targetASP: ['AGAスキンクリニック', 'クリニックフォア', 'DMMオンラインクリニック'],
    articleType: 'how-to',
    suggestedTitle: 'AGA治療で女性化する？フィナステリド・デュタステリドの副作用リスクと対策',
    subKeywords: ['フィナステリド 女性化', 'デュタステリド 乳房', 'AGA 副作用 ホルモン', 'AGA治療 安全性'],
    targetAudience: 'AGA治療薬の副作用が不安な20〜40代男性',
    targetLength: 3500,
  },
  {
    id: 'p2-aga-004',
    keyword: 'AGA治療 デュタステリド フィナステリド 違い',
    category: 'aga',
    searchIntent: 'commercial',
    estimatedVolume: 3200,
    difficultyScore: 35,
    targetASP: ['クリニックフォア', 'AGAヘアクリニック', 'DMMオンラインクリニック'],
    articleType: 'comparison',
    suggestedTitle: 'デュタステリドとフィナステリドの違いは？効果・副作用・費用を徹底比較',
    subKeywords: ['ザガーロ プロペシア 違い', 'デュタステリド 効果', 'フィナステリド デュタステリド 切り替え', 'AGA 内服薬 選び方'],
    targetAudience: 'AGA治療薬の選択で迷っている30〜50代男性',
    targetLength: 4500,
  },
  {
    id: 'p2-aga-005',
    keyword: 'AGA治療 安い オンライン',
    category: 'aga',
    searchIntent: 'transactional',
    estimatedVolume: 5400,
    difficultyScore: 45,
    targetASP: ['DMMオンラインクリニック', 'クリニックフォア', 'AGAヘアクリニック'],
    articleType: 'comparison',
    suggestedTitle: 'AGA治療が安いオンラインクリニック7選｜月額費用と処方薬を徹底比較',
    subKeywords: ['AGA オンライン 安い', 'AGA 月額 最安', 'オンラインAGA コスパ', 'AGA フィナステリド 安い'],
    targetAudience: 'コスパ重視でAGAオンライン診療を探している20〜40代男性',
    targetLength: 5000,
  },
]

// ============================================================
// ED治療 キーワード × 5
// ============================================================

const ED_PHASE2_KEYWORDS: Phase2Keyword[] = [
  {
    id: 'p2-ed-001',
    keyword: 'ED治療薬 オンライン処方 安い',
    category: 'ed',
    searchIntent: 'transactional',
    estimatedVolume: 3200,
    difficultyScore: 38,
    targetASP: ['DMMオンラインクリニック', 'クリニックフォア', 'eLife'],
    articleType: 'comparison',
    suggestedTitle: 'ED治療薬のオンライン処方が安いクリニック6選｜費用・薬の種類を比較',
    subKeywords: ['ED薬 オンライン 安い', 'バイアグラ オンライン処方', 'ED オンライン 即日', 'シルデナフィル 通販'],
    targetAudience: 'ED治療薬をオンラインで安く入手したい30〜50代男性',
    targetLength: 4500,
  },
  {
    id: 'p2-ed-002',
    keyword: 'シアリス ジェネリック 通販',
    category: 'ed',
    searchIntent: 'transactional',
    estimatedVolume: 2900,
    difficultyScore: 30,
    targetASP: ['DMMオンラインクリニック', 'クリニックフォア'],
    articleType: 'how-to',
    suggestedTitle: 'シアリスジェネリック（タダラフィル）の正規処方ルートと費用｜個人輸入のリスクも解説',
    subKeywords: ['タダラフィル ジェネリック', 'シアリス 安く買う', 'タダラフィル オンライン', 'ED薬 ジェネリック 比較'],
    targetAudience: 'シアリスをコスパよく入手したい30〜60代男性',
    targetLength: 4000,
  },
  {
    id: 'p2-ed-003',
    keyword: 'ED 心因性 改善方法',
    category: 'ed',
    searchIntent: 'informational',
    estimatedVolume: 2400,
    difficultyScore: 22,
    targetASP: ['eLife', 'DMMオンラインクリニック'],
    articleType: 'how-to',
    suggestedTitle: '心因性EDの原因と改善方法｜ストレス・不安からの回復を専門医が解説',
    subKeywords: ['心因性ED 治し方', 'ED ストレス 改善', 'ED 不安 克服', '機能性ED 原因'],
    targetAudience: 'ストレスや不安からEDを発症した20〜40代男性',
    targetLength: 3500,
  },
  {
    id: 'p2-ed-004',
    keyword: 'ED治療 バイアグラ シアリス 違い',
    category: 'ed',
    searchIntent: 'commercial',
    estimatedVolume: 3600,
    difficultyScore: 33,
    targetASP: ['DMMオンラインクリニック', 'クリニックフォア', 'eLife'],
    articleType: 'comparison',
    suggestedTitle: 'バイアグラとシアリスの違いを比較｜効果時間・副作用・価格で選ぶED治療薬',
    subKeywords: ['バイアグラ シアリス どっち', 'ED薬 選び方', 'シルデナフィル タダラフィル 比較', 'ED薬 効果時間'],
    targetAudience: 'ED治療薬の選び方で迷っている30〜60代男性',
    targetLength: 4000,
  },
  {
    id: 'p2-ed-005',
    keyword: 'ED治療 恥ずかしい 対処法',
    category: 'ed',
    searchIntent: 'informational',
    estimatedVolume: 1900,
    difficultyScore: 18,
    targetASP: ['DMMオンラインクリニック', 'eLife'],
    articleType: 'guide',
    suggestedTitle: 'ED治療が恥ずかしい方へ｜人に知られず受診する5つの方法とオンライン診療の活用術',
    subKeywords: ['ED 受診 恥ずかしい', 'ED オンライン 誰にもバレない', 'ED 相談 プライバシー', 'ED 初めて 病院'],
    targetAudience: 'ED治療に心理的ハードルを感じている20〜40代男性',
    targetLength: 3500,
  },
]

// ============================================================
// 医療脱毛 キーワード × 5
// ============================================================

const HAIR_REMOVAL_PHASE2_KEYWORDS: Phase2Keyword[] = [
  {
    id: 'p2-hr-001',
    keyword: 'メンズ医療脱毛 何回で終わる',
    category: 'hair-removal',
    searchIntent: 'informational',
    estimatedVolume: 3600,
    difficultyScore: 30,
    targetASP: ['メンズリゼ', 'ゴリラクリニック', 'レジーナクリニックオム'],
    articleType: 'how-to',
    suggestedTitle: 'メンズ医療脱毛は何回で終わる？部位別の回数目安と効率的な通い方',
    subKeywords: ['医療脱毛 回数 男', 'ヒゲ脱毛 何回', '全身脱毛 回数 メンズ', '脱毛 終わるまで 期間'],
    targetAudience: '脱毛の回数・期間の見通しを知りたい20〜30代男性',
    targetLength: 4000,
  },
  {
    id: 'p2-hr-002',
    keyword: 'ヒゲ脱毛 後悔 理由',
    category: 'hair-removal',
    searchIntent: 'informational',
    estimatedVolume: 4400,
    difficultyScore: 28,
    targetASP: ['ゴリラクリニック', 'メンズリゼ', 'メンズエミナル'],
    articleType: 'how-to',
    suggestedTitle: 'ヒゲ脱毛で後悔する5つの理由と回避策｜始める前に知っておきたいポイント',
    subKeywords: ['ヒゲ脱毛 デメリット', 'ヒゲ脱毛 やめた方がいい', 'ヒゲ脱毛 失敗', 'ヒゲ脱毛 注意点'],
    targetAudience: 'ヒゲ脱毛を検討中で不安のある20〜30代男性',
    targetLength: 4000,
  },
  {
    id: 'p2-hr-003',
    keyword: 'メンズ脱毛 家庭用 おすすめ',
    category: 'hair-removal',
    searchIntent: 'commercial',
    estimatedVolume: 3200,
    difficultyScore: 35,
    targetASP: ['もしもアフィリエイト（Amazon）', 'A8.net', 'バリューコマース'],
    articleType: 'comparison',
    suggestedTitle: 'メンズ向け家庭用脱毛器おすすめ8選｜医療脱毛との違い・効果・コスパを比較',
    subKeywords: ['家庭用脱毛器 メンズ', '脱毛器 男性 ヒゲ', '家庭用脱毛器 効果 男', 'ケノン メンズ'],
    targetAudience: '自宅で脱毛したい20〜40代男性',
    targetLength: 5000,
  },
  {
    id: 'p2-hr-004',
    keyword: 'メンズ脱毛 学割 安い',
    category: 'hair-removal',
    searchIntent: 'transactional',
    estimatedVolume: 2400,
    difficultyScore: 25,
    targetASP: ['メンズリゼ', 'メンズエミナル', 'ゴリラクリニック'],
    articleType: 'list',
    suggestedTitle: '学割ありのメンズ脱毛クリニック5選｜学生でも始めやすい料金プランを紹介',
    subKeywords: ['学生 脱毛 安い', 'メンズ脱毛 学生割引', 'ヒゲ脱毛 学割', '脱毛 大学生 おすすめ'],
    targetAudience: '脱毛に興味がある10代後半〜20代前半の男子学生',
    targetLength: 3500,
  },
  {
    id: 'p2-hr-005',
    keyword: '医療脱毛 エステ脱毛 メンズ どっち',
    category: 'hair-removal',
    searchIntent: 'commercial',
    estimatedVolume: 2900,
    difficultyScore: 32,
    targetASP: ['メンズリゼ', 'ゴリラクリニック', 'リンクス'],
    articleType: 'comparison',
    suggestedTitle: '医療脱毛とエステ脱毛どっちが正解？メンズ脱毛の違いを費用・効果・痛みで比較',
    subKeywords: ['医療脱毛 光脱毛 違い 男', '脱毛サロン クリニック 違い', 'メンズ脱毛 どこがいい', '脱毛 医療 美容 比較'],
    targetAudience: '医療脱毛とエステ脱毛で迷っている20〜30代男性',
    targetLength: 4500,
  },
]

// ============================================================
// スキンケア キーワード × 5
// ============================================================

const SKINCARE_PHASE2_KEYWORDS: Phase2Keyword[] = [
  {
    id: 'p2-sc-001',
    keyword: 'メンズ 日焼け止め おすすめ',
    category: 'skincare',
    searchIntent: 'commercial',
    estimatedVolume: 6600,
    difficultyScore: 40,
    targetASP: ['もしもアフィリエイト（Amazon）', 'A8.net', 'バリューコマース'],
    articleType: 'comparison',
    suggestedTitle: 'メンズ日焼け止めおすすめ10選｜白浮きしない・ベタつかない男性用UVケアを厳選',
    subKeywords: ['日焼け止め メンズ ランキング', '男性 日焼け止め', 'メンズ UV ケア', '日焼け止め 白浮きしない メンズ'],
    targetAudience: '日焼け止め選びに迷っている20〜40代男性',
    targetLength: 4500,
  },
  {
    id: 'p2-sc-002',
    keyword: 'メンズ オールインワン 化粧水',
    category: 'skincare',
    searchIntent: 'commercial',
    estimatedVolume: 4400,
    difficultyScore: 38,
    targetASP: ['もしもアフィリエイト（Amazon）', 'A8.net', 'afb'],
    articleType: 'comparison',
    suggestedTitle: 'メンズオールインワンジェルおすすめ8選｜忙しい男性向け時短スキンケアを比較',
    subKeywords: ['オールインワン メンズ', 'メンズスキンケア 時短', 'オールインワンジェル 男性', 'メンズ 保湿 簡単'],
    targetAudience: 'スキンケアを簡単に済ませたい20〜40代男性',
    targetLength: 4000,
  },
  {
    id: 'p2-sc-003',
    keyword: 'メンズ 毛穴 黒ずみ 洗顔',
    category: 'skincare',
    searchIntent: 'informational',
    estimatedVolume: 3200,
    difficultyScore: 30,
    targetASP: ['もしもアフィリエイト（Amazon）', 'A8.net'],
    articleType: 'how-to',
    suggestedTitle: 'メンズの毛穴の黒ずみを改善する洗顔方法｜原因と正しいケア手順を解説',
    subKeywords: ['毛穴 黒ずみ 男 洗顔', 'いちご鼻 メンズ', '鼻 黒ずみ 取り方 男', '毛穴ケア 男性 おすすめ'],
    targetAudience: '毛穴の黒ずみに悩む20〜30代男性',
    targetLength: 3500,
  },
  {
    id: 'p2-sc-004',
    keyword: 'メンズ 美容液 エイジングケア',
    category: 'skincare',
    searchIntent: 'commercial',
    estimatedVolume: 2400,
    difficultyScore: 28,
    targetASP: ['もしもアフィリエイト（Amazon）', 'A8.net', 'afb'],
    articleType: 'comparison',
    suggestedTitle: 'メンズ美容液おすすめ7選｜30代からのエイジングケアに効果的な成分と選び方',
    subKeywords: ['美容液 メンズ おすすめ', 'エイジングケア 男性', 'メンズ 美容液 レチノール', '男性 美容液 30代'],
    targetAudience: 'エイジングケアを意識し始めた30〜40代男性',
    targetLength: 4000,
  },
  {
    id: 'p2-sc-005',
    keyword: 'メンズ ニキビ 治し方 市販薬',
    category: 'skincare',
    searchIntent: 'informational',
    estimatedVolume: 3600,
    difficultyScore: 32,
    targetASP: ['もしもアフィリエイト（Amazon）', 'アクセストレード'],
    articleType: 'how-to',
    suggestedTitle: 'メンズのニキビの治し方｜市販薬・洗顔・生活改善で効果的に対策する方法',
    subKeywords: ['ニキビ 治し方 男', '大人ニキビ メンズ', 'ニキビ 市販薬 おすすめ 男', 'ニキビ スキンケア 男性'],
    targetAudience: 'ニキビに悩む20代男性',
    targetLength: 4000,
  },
]

// ============================================================
// サプリメント キーワード × 5
// ============================================================

const SUPPLEMENT_PHASE2_KEYWORDS: Phase2Keyword[] = [
  {
    id: 'p2-sp-001',
    keyword: '亜鉛 サプリ 男性 おすすめ',
    category: 'supplement',
    searchIntent: 'commercial',
    estimatedVolume: 4400,
    difficultyScore: 35,
    targetASP: ['もしもアフィリエイト（Amazon）', 'A8.net', 'バリューコマース'],
    articleType: 'comparison',
    suggestedTitle: '亜鉛サプリおすすめ8選｜男性の活力・髪・肌をサポートする正しい選び方',
    subKeywords: ['亜鉛 サプリ メンズ', '亜鉛 効果 男性', '亜鉛 サプリ 選び方', '亜鉛 薄毛 効果'],
    targetAudience: '活力低下や薄毛が気になる30〜50代男性',
    targetLength: 4000,
  },
  {
    id: 'p2-sp-002',
    keyword: 'マルチビタミン メンズ 効果',
    category: 'supplement',
    searchIntent: 'informational',
    estimatedVolume: 3200,
    difficultyScore: 28,
    targetASP: ['もしもアフィリエイト（Amazon）', 'A8.net'],
    articleType: 'how-to',
    suggestedTitle: 'メンズ向けマルチビタミンの効果と選び方｜忙しい男性に必要な栄養素を解説',
    subKeywords: ['マルチビタミン おすすめ 男性', 'ビタミン サプリ メンズ', 'マルチビタミン 効果 実感', '男性 サプリ 基本'],
    targetAudience: '栄養バランスが偏りがちな20〜40代の忙しい男性',
    targetLength: 3500,
  },
  {
    id: 'p2-sp-003',
    keyword: 'ノコギリヤシ 効果 薄毛',
    category: 'supplement',
    searchIntent: 'informational',
    estimatedVolume: 2900,
    difficultyScore: 25,
    targetASP: ['もしもアフィリエイト（Amazon）', 'A8.net', 'afb'],
    articleType: 'how-to',
    suggestedTitle: 'ノコギリヤシは薄毛に効果ある？科学的根拠とAGA治療との違いを解説',
    subKeywords: ['ノコギリヤシ AGA', 'ノコギリヤシ サプリ 効果', 'ノコギリヤシ 副作用', 'ノコギリヤシ フィナステリド 違い'],
    targetAudience: 'サプリメントで薄毛対策をしたい30〜50代男性',
    targetLength: 4000,
  },
  {
    id: 'p2-sp-004',
    keyword: 'プロテイン 肌 美容 男性',
    category: 'supplement',
    searchIntent: 'informational',
    estimatedVolume: 2400,
    difficultyScore: 22,
    targetASP: ['もしもアフィリエイト（Amazon）', 'バリューコマース'],
    articleType: 'how-to',
    suggestedTitle: 'プロテインは肌にもいい？男性の美容効果とおすすめの飲み方を解説',
    subKeywords: ['プロテイン 美肌 効果', 'プロテイン 肌荒れ 改善', 'コラーゲン プロテイン 男', 'プロテイン 髪 効果'],
    targetAudience: 'トレーニング兼美容目的のプロテイン活用に興味がある20〜30代男性',
    targetLength: 3500,
  },
  {
    id: 'p2-sp-005',
    keyword: 'テストステロン サプリ 効果',
    category: 'supplement',
    searchIntent: 'informational',
    estimatedVolume: 3600,
    difficultyScore: 30,
    targetASP: ['もしもアフィリエイト（Amazon）', 'A8.net'],
    articleType: 'how-to',
    suggestedTitle: 'テストステロンサプリの効果は本物？科学的根拠と安全な選び方を専門家が解説',
    subKeywords: ['テストステロン サプリ おすすめ', 'テストステロン 増やす サプリ', 'テストステロン ブースター 効果', '男性ホルモン サプリ'],
    targetAudience: '活力低下が気になる30〜50代男性',
    targetLength: 4000,
  },
]

// ============================================================
// 総合比較 キーワード × 5
// ============================================================

const COMPARISON_PHASE2_KEYWORDS: Phase2Keyword[] = [
  {
    id: 'p2-cp-001',
    keyword: 'メンズ美容クリニック おすすめ 東京',
    category: 'comparison',
    searchIntent: 'commercial',
    estimatedVolume: 5400,
    difficultyScore: 52,
    targetASP: ['A8.net', 'afb', 'アクセストレード'],
    articleType: 'comparison',
    suggestedTitle: '東京のメンズ美容クリニックおすすめ10選｜AGA・脱毛・スキンケアの目的別ガイド',
    subKeywords: ['メンズ美容 クリニック 東京', '男性 美容クリニック 人気', 'メンズ美容 東京 安い', 'メンズ美容医療 おすすめ'],
    targetAudience: '東京都内でメンズ美容クリニックを探している20〜40代男性',
    targetLength: 5500,
  },
  {
    id: 'p2-cp-002',
    keyword: 'メンズ美容 何から始める',
    category: 'comparison',
    searchIntent: 'informational',
    estimatedVolume: 3600,
    difficultyScore: 25,
    targetASP: ['もしもアフィリエイト（Amazon）', 'A8.net', 'afb'],
    articleType: 'guide',
    suggestedTitle: 'メンズ美容は何から始める？初心者ロードマップ｜スキンケアから医療美容まで',
    subKeywords: ['メンズ美容 初心者', '男性 美容 始め方', 'メンズ美容 入門', '男性 見た目 改善'],
    targetAudience: '美容に興味を持ち始めた20代男性',
    targetLength: 4500,
  },
  {
    id: 'p2-cp-003',
    keyword: 'オンライン診療 メンズ おすすめ',
    category: 'comparison',
    searchIntent: 'commercial',
    estimatedVolume: 3200,
    difficultyScore: 40,
    targetASP: ['DMMオンラインクリニック', 'クリニックフォア', 'eLife'],
    articleType: 'comparison',
    suggestedTitle: 'メンズ向けオンライン診療おすすめ6選｜AGA・ED・スキンケアの目的別に比較',
    subKeywords: ['オンライン診療 男性', 'メンズ オンラインクリニック 比較', 'AGA ED オンライン', 'オンライン診療 安い'],
    targetAudience: 'オンライン診療で医療サービスを受けたい20〜50代男性',
    targetLength: 5000,
  },
  {
    id: 'p2-cp-004',
    keyword: 'メンズ美容 費用 月額 どのくらい',
    category: 'comparison',
    searchIntent: 'informational',
    estimatedVolume: 2400,
    difficultyScore: 20,
    targetASP: ['A8.net', 'afb', 'もしもアフィリエイト（Amazon）'],
    articleType: 'cost-analysis',
    suggestedTitle: 'メンズ美容にかかる月額費用はどのくらい？AGA・脱毛・スキンケア別の相場まとめ',
    subKeywords: ['メンズ美容 費用', '男性 美容 コスト', 'AGA 脱毛 スキンケア 費用', 'メンズ美容 月額 目安'],
    targetAudience: 'メンズ美容の費用感を知りたい20〜40代男性',
    targetLength: 4000,
  },
  {
    id: 'p2-cp-005',
    keyword: 'メンズ美容 30代 やるべきこと',
    category: 'comparison',
    searchIntent: 'informational',
    estimatedVolume: 2900,
    difficultyScore: 22,
    targetASP: ['もしもアフィリエイト（Amazon）', 'A8.net', 'DMMオンラインクリニック'],
    articleType: 'guide',
    suggestedTitle: '30代男性がやるべき美容ケア完全ガイド｜スキンケア・AGA・脱毛の優先順位',
    subKeywords: ['30代 メンズ美容', '30代 男性 見た目', '30代 エイジングケア 男', '30代 美容 始める'],
    targetAudience: '30代に入り見た目のケアを意識し始めた男性',
    targetLength: 4500,
  },
]

// ============================================================
// エクスポート
// ============================================================

/** Phase 2 全30キーワード */
export const PHASE2_KEYWORDS: Phase2Keyword[] = [
  ...AGA_PHASE2_KEYWORDS,
  ...ED_PHASE2_KEYWORDS,
  ...HAIR_REMOVAL_PHASE2_KEYWORDS,
  ...SKINCARE_PHASE2_KEYWORDS,
  ...SUPPLEMENT_PHASE2_KEYWORDS,
  ...COMPARISON_PHASE2_KEYWORDS,
]

/** カテゴリ別キーワードを取得 */
export function getPhase2KeywordsByCategory(
  category: Phase2Keyword['category']
): Phase2Keyword[] {
  return PHASE2_KEYWORDS.filter((kw) => kw.category === category)
}

/** 検索意図別キーワードを取得 */
export function getPhase2KeywordsByIntent(intent: SearchIntent): Phase2Keyword[] {
  return PHASE2_KEYWORDS.filter((kw) => kw.searchIntent === intent)
}

/** 難易度スコアの低い順（攻略しやすい順）でソート */
export function getPhase2KeywordsByDifficulty(): Phase2Keyword[] {
  return [...PHASE2_KEYWORDS].sort((a, b) => a.difficultyScore - b.difficultyScore)
}

/** 推定ボリュームの高い順でソート */
export function getPhase2KeywordsByVolume(): Phase2Keyword[] {
  return [...PHASE2_KEYWORDS].sort((a, b) => b.estimatedVolume - a.estimatedVolume)
}

/** IDでキーワードを取得 */
export function getPhase2KeywordById(id: string): Phase2Keyword | undefined {
  return PHASE2_KEYWORDS.find((kw) => kw.id === id)
}
