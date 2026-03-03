/**
 * カテゴリ別記事テンプレート
 * 記事構成・CTA配置・アフィリエイト挿入ポイント・目標文字数を定義
 */

import type { ContentCategory } from '@/types/content'

// ============================================================
// 型定義
// ============================================================

/** テンプレートセクション定義 */
export interface TemplateSectionDef {
  /** セクション見出し */
  heading: string
  /** 見出しレベル */
  level: 'h2' | 'h3'
  /** セクション概要（プロンプトへの指示） */
  description: string
  /** サブセクション */
  subsections?: TemplateSectionDef[]
}

/** CTA配置位置 */
export interface CtaPosition {
  /** 配置するセクションインデックス（0始まり） */
  afterSectionIndex: number
  /** CTA種別 */
  variant: 'primary' | 'secondary'
}

/** アフィリエイト挿入ポイント */
export interface AffiliateInsertionPoint {
  /** 挿入するセクションインデックス */
  sectionIndex: number
  /** 挿入タイプ */
  type: 'inline-link' | 'comparison-table' | 'recommendation-box'
  /** 説明 */
  description: string
}

/** 記事テンプレート */
export interface ArticleTemplate {
  /** セクション定義 */
  sections: TemplateSectionDef[]
  /** CTA配置位置 */
  ctaPositions: CtaPosition[]
  /** アフィリエイト挿入ポイント */
  affiliateInsertionPoints: AffiliateInsertionPoint[]
  /** 目標文字数 */
  wordCountTarget: number
}

// ============================================================
// カテゴリ別テンプレート定義
// ============================================================

export const ARTICLE_TEMPLATES: Record<ContentCategory, ArticleTemplate> = {
  // =========================================================
  // AGA（男性型脱毛症）
  // 導入→AGAとは→原因→治療法比較→クリニック選び→費用相場→まとめ
  // =========================================================
  aga: {
    sections: [
      {
        heading: '導入',
        level: 'h2',
        description: '読者の悩みに共感し、記事で得られる情報を明示。PR表記を含める。',
      },
      {
        heading: 'AGAとは？基本的なメカニズム',
        level: 'h2',
        description: 'AGAの定義、発症率、進行パターンを解説。',
        subsections: [
          { heading: 'AGAの定義と特徴', level: 'h3', description: 'AGAの医学的定義を説明' },
          { heading: 'AGAの進行パターン', level: 'h3', description: 'ハミルトン・ノーウッド分類を紹介' },
        ],
      },
      {
        heading: 'AGAの原因',
        level: 'h2',
        description: 'DHT、遺伝、生活習慣の関与を解説。',
        subsections: [
          { heading: '男性ホルモン（DHT）の影響', level: 'h3', description: '5αリダクターゼとDHTの関係' },
          { heading: '遺伝的要因', level: 'h3', description: '家族歴とリスクの関係' },
          { heading: '生活習慣の影響', level: 'h3', description: 'ストレス・食事・睡眠の影響' },
        ],
      },
      {
        heading: '治療法比較',
        level: 'h2',
        description: '主要な治療法（フィナステリド、デュタステリド、ミノキシジル等）を比較。',
        subsections: [
          { heading: 'フィナステリド（プロペシア）', level: 'h3', description: '効果・副作用・費用' },
          { heading: 'デュタステリド（ザガーロ）', level: 'h3', description: '効果・副作用・費用' },
          { heading: 'ミノキシジル（外用・内服）', level: 'h3', description: '効果・副作用・使い方' },
        ],
      },
      {
        heading: 'クリニックの選び方',
        level: 'h2',
        description: '信頼できるAGAクリニックを選ぶ基準を解説。',
        subsections: [
          { heading: '選び方の5つのポイント', level: 'h3', description: '評価基準を提示' },
          { heading: 'オンライン診療と対面診療の違い', level: 'h3', description: 'メリット・デメリット比較' },
        ],
      },
      {
        heading: '費用相場',
        level: 'h2',
        description: '治療法別・クリニック別の費用を表形式で比較。',
        subsections: [
          { heading: '治療法別の月額費用', level: 'h3', description: '費用の目安を提示' },
          { heading: '保険適用の可否', level: 'h3', description: '自費診療の理由を説明' },
        ],
      },
      {
        heading: 'まとめ',
        level: 'h2',
        description: '要点を3〜5個の箇条書きでまとめ、CTAを含める。',
      },
    ],
    ctaPositions: [
      { afterSectionIndex: 3, variant: 'secondary' },
      { afterSectionIndex: 6, variant: 'primary' },
    ],
    affiliateInsertionPoints: [
      { sectionIndex: 3, type: 'comparison-table', description: '治療法比較セクション内にクリニック比較表を挿入' },
      { sectionIndex: 4, type: 'recommendation-box', description: 'クリニック選びセクションにおすすめボックスを挿入' },
      { sectionIndex: 6, type: 'inline-link', description: 'まとめセクションのCTA内にリンクを挿入' },
    ],
    wordCountTarget: 4000,
  },

  // =========================================================
  // ED（勃起不全）
  // 導入→EDとは→原因→治療薬比較→クリニック選び→オンライン診療→まとめ
  // =========================================================
  ed: {
    sections: [
      {
        heading: '導入',
        level: 'h2',
        description: 'EDの悩みに寄り添い、プライバシーに配慮した導入。PR表記を含める。',
      },
      {
        heading: 'EDとは？正しい理解のために',
        level: 'h2',
        description: 'EDの医学的定義、有病率、誤解の解消。',
        subsections: [
          { heading: 'EDの定義と種類', level: 'h3', description: '器質性・心因性・混合性の分類' },
          { heading: '年齢別の有病率', level: 'h3', description: '統計データに基づく解説' },
        ],
      },
      {
        heading: 'EDの主な原因',
        level: 'h2',
        description: '身体的・心理的原因を分類して解説。',
        subsections: [
          { heading: '身体的要因', level: 'h3', description: '血管障害・神経障害・ホルモン異常' },
          { heading: '心理的要因', level: 'h3', description: 'ストレス・不安・パフォーマンス不安' },
          { heading: '生活習慣との関係', level: 'h3', description: '喫煙・飲酒・運動不足' },
        ],
      },
      {
        heading: '治療薬比較',
        level: 'h2',
        description: '3大ED治療薬を客観的に比較。',
        subsections: [
          { heading: 'シルデナフィル（バイアグラ）', level: 'h3', description: '効果・作用時間・副作用' },
          { heading: 'タダラフィル（シアリス）', level: 'h3', description: '効果・作用時間・副作用' },
          { heading: 'バルデナフィル（レビトラ）', level: 'h3', description: '効果・作用時間・副作用' },
          { heading: 'ジェネリック薬の選択肢', level: 'h3', description: '価格差・入手方法' },
        ],
      },
      {
        heading: 'クリニックの選び方',
        level: 'h2',
        description: 'プライバシーに配慮したクリニック選びのポイント。',
        subsections: [
          { heading: '選ぶ際のポイント', level: 'h3', description: 'プライバシー配慮・費用・アクセス' },
          { heading: '初回受診の流れ', level: 'h3', description: '来院〜処方までのステップ' },
        ],
      },
      {
        heading: 'オンライン診療のメリット',
        level: 'h2',
        description: 'オンライン診療の流れと利点を解説。',
        subsections: [
          { heading: 'オンライン診療の手順', level: 'h3', description: '予約〜配送までの流れ' },
          { heading: '対面診療との比較', level: 'h3', description: '費用・利便性・プライバシー' },
        ],
      },
      {
        heading: 'まとめ',
        level: 'h2',
        description: '要点まとめとCTA。プライバシーへの配慮を強調。',
      },
    ],
    ctaPositions: [
      { afterSectionIndex: 3, variant: 'secondary' },
      { afterSectionIndex: 6, variant: 'primary' },
    ],
    affiliateInsertionPoints: [
      { sectionIndex: 3, type: 'comparison-table', description: '治療薬比較セクションにクリニック情報を挿入' },
      { sectionIndex: 5, type: 'recommendation-box', description: 'オンライン診療セクションにおすすめクリニックを挿入' },
      { sectionIndex: 6, type: 'inline-link', description: 'まとめのCTAにリンクを挿入' },
    ],
    wordCountTarget: 4000,
  },

  // =========================================================
  // 脱毛（医療脱毛・エステ脱毛）
  // 導入→脱毛の種類→部位別解説→クリニック比較→費用→痛み・リスク→まとめ
  // =========================================================
  'hair-removal': {
    sections: [
      {
        heading: '導入',
        level: 'h2',
        description: 'メンズ脱毛の需要増を背景に、記事の対象と得られる情報を明示。PR表記。',
      },
      {
        heading: '脱毛の種類と特徴',
        level: 'h2',
        description: '医療脱毛とエステ脱毛の違い、レーザーの種類を解説。',
        subsections: [
          { heading: '医療脱毛（レーザー脱毛）', level: 'h3', description: '特徴・メリット・デメリット' },
          { heading: 'エステ脱毛（光脱毛/IPL）', level: 'h3', description: '特徴・メリット・デメリット' },
          { heading: 'レーザーの種類', level: 'h3', description: 'アレキ・ダイオード・YAGの特徴' },
        ],
      },
      {
        heading: '部位別の解説',
        level: 'h2',
        description: '主要部位ごとの回数・期間・注意点を解説。',
        subsections: [
          { heading: 'ヒゲ（顔）脱毛', level: 'h3', description: '回数目安・痛み・仕上がり' },
          { heading: '全身脱毛', level: 'h3', description: '範囲・回数・所要時間' },
          { heading: 'VIO脱毛', level: 'h3', description: 'プライバシー配慮・痛み対策' },
          { heading: 'その他の部位', level: 'h3', description: '腕・脚・背中・胸' },
        ],
      },
      {
        heading: 'クリニック・サロン比較',
        level: 'h2',
        description: '主要クリニック・サロンを客観基準で比較。',
        subsections: [
          { heading: '比較基準の説明', level: 'h3', description: '費用・機器・実績・通いやすさ' },
          { heading: '主要クリニック比較表', level: 'h3', description: '表形式で比較データを提示' },
        ],
      },
      {
        heading: '費用の目安',
        level: 'h2',
        description: '部位別・プラン別の費用を整理。',
        subsections: [
          { heading: '部位別の費用相場', level: 'h3', description: '費用表を提示' },
          { heading: '費用を抑えるポイント', level: 'h3', description: 'キャンペーン・セットプラン等' },
        ],
      },
      {
        heading: '痛み・リスクと対策',
        level: 'h2',
        description: '施術時の痛みとリスクへの対処法。',
        subsections: [
          { heading: '痛みの程度と軽減策', level: 'h3', description: '麻酔クリーム・冷却・蓄熱式' },
          { heading: '起こりうるリスクと副作用', level: 'h3', description: '火傷・肌荒れ等のリスク' },
        ],
      },
      {
        heading: 'まとめ',
        level: 'h2',
        description: '要点まとめとCTA。初回カウンセリングへの誘導。',
      },
    ],
    ctaPositions: [
      { afterSectionIndex: 3, variant: 'secondary' },
      { afterSectionIndex: 6, variant: 'primary' },
    ],
    affiliateInsertionPoints: [
      { sectionIndex: 3, type: 'comparison-table', description: 'クリニック比較セクションに比較表を挿入' },
      { sectionIndex: 4, type: 'recommendation-box', description: '費用セクションにおすすめプランを挿入' },
      { sectionIndex: 6, type: 'inline-link', description: 'まとめのCTAにカウンセリング予約リンクを挿入' },
    ],
    wordCountTarget: 4500,
  },

  // =========================================================
  // スキンケア（メンズコスメ・皮膚科系）
  // 導入→悩み別解説→成分解説→おすすめ商品→クリニック治療→日常ケア→まとめ
  // =========================================================
  skincare: {
    sections: [
      {
        heading: '導入',
        level: 'h2',
        description: 'メンズスキンケアの重要性と記事の概要を提示。PR表記。',
      },
      {
        heading: '悩み別の解説',
        level: 'h2',
        description: 'メンズに多い肌悩みとそれぞれの原因・対策を解説。',
        subsections: [
          { heading: 'テカリ・脂性肌', level: 'h3', description: '原因と対処法' },
          { heading: 'ニキビ・ニキビ跡', level: 'h3', description: '原因と治療法の選択肢' },
          { heading: 'シミ・くすみ', level: 'h3', description: '原因と予防・改善法' },
          { heading: '毛穴の開き・黒ずみ', level: 'h3', description: '原因とケア方法' },
        ],
      },
      {
        heading: '注目成分の解説',
        level: 'h2',
        description: 'スキンケアで知っておくべき有効成分を解説。',
        subsections: [
          { heading: 'ビタミンC誘導体', level: 'h3', description: '効果と選び方' },
          { heading: 'レチノール', level: 'h3', description: '効果と注意点' },
          { heading: 'ナイアシンアミド', level: 'h3', description: '効果と使い方' },
          { heading: 'セラミド・ヒアルロン酸', level: 'h3', description: '保湿成分の役割' },
        ],
      },
      {
        heading: 'おすすめ商品',
        level: 'h2',
        description: '悩み別・肌質別のおすすめスキンケアアイテム。',
        subsections: [
          { heading: '洗顔料のおすすめ', level: 'h3', description: '肌質別の選び方' },
          { heading: '化粧水のおすすめ', level: 'h3', description: '成分と価格帯別' },
          { heading: '美容液・クリームのおすすめ', level: 'h3', description: '悩み別の選び方' },
        ],
      },
      {
        heading: 'クリニック治療の選択肢',
        level: 'h2',
        description: 'セルフケアで改善しない場合のクリニック治療を紹介。',
        subsections: [
          { heading: 'レーザー治療', level: 'h3', description: 'シミ取り・毛穴等' },
          { heading: 'ケミカルピーリング', level: 'h3', description: 'ニキビ跡・肌質改善' },
          { heading: '皮膚科受診の目安', level: 'h3', description: 'セルフケアとの使い分け' },
        ],
      },
      {
        heading: '日常ケアのポイント',
        level: 'h2',
        description: '毎日のスキンケアルーティンと生活習慣のアドバイス。',
        subsections: [
          { heading: '基本のスキンケア手順', level: 'h3', description: '正しい洗顔〜保湿の流れ' },
          { heading: '紫外線対策', level: 'h3', description: '日焼け止めの選び方と使い方' },
          { heading: '食事・生活習慣の改善', level: 'h3', description: '肌に良い食事・睡眠' },
        ],
      },
      {
        heading: 'まとめ',
        level: 'h2',
        description: '要点まとめとCTA。おすすめアイテムへの誘導。',
      },
    ],
    ctaPositions: [
      { afterSectionIndex: 3, variant: 'secondary' },
      { afterSectionIndex: 6, variant: 'primary' },
    ],
    affiliateInsertionPoints: [
      { sectionIndex: 3, type: 'recommendation-box', description: 'おすすめ商品セクションに購入リンクを挿入' },
      { sectionIndex: 4, type: 'inline-link', description: 'クリニック治療セクションに予約リンクを挿入' },
      { sectionIndex: 6, type: 'inline-link', description: 'まとめのCTAにリンクを挿入' },
    ],
    wordCountTarget: 4000,
  },

  // =========================================================
  // コラム
  // =========================================================
  column: {
    sections: [
      {
        heading: '導入',
        level: 'h2',
        description: '読者の興味を引くリード文。トピックの概要。',
      },
      {
        heading: '本題',
        level: 'h2',
        description: 'コラムの本題。読みやすくカジュアルなトーンで展開。',
        subsections: [
          { heading: 'ポイント1', level: 'h3', description: '最も重要なポイント' },
          { heading: 'ポイント2', level: 'h3', description: '補足ポイント' },
          { heading: 'ポイント3', level: 'h3', description: '追加情報' },
        ],
      },
      {
        heading: 'まとめ',
        level: 'h2',
        description: '要点まとめ。関連記事への誘導。',
      },
    ],
    ctaPositions: [
      { afterSectionIndex: 2, variant: 'secondary' },
    ],
    affiliateInsertionPoints: [],
    wordCountTarget: 2500,
  },
}
