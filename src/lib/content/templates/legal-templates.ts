/**
 * E-E-A-T強化 — 免責事項・編集方針・プライバシーポリシー・PR表記テンプレート
 *
 * 薬機法第66条・67条 / 景表法 / ステマ規制 / YMYL / E-E-A-T 対応
 * カテゴリごとに最適化された法的テンプレートを提供する
 */

// ============================================================
// 型定義
// ============================================================

/** 免責事項カテゴリ */
export type DisclaimerCategory =
  | 'medical'      // AGA / ED などの医療系
  | 'beauty'       // スキンケア / 脱毛などの美容系
  | 'supplement'   // サプリメント・健康食品
  | 'general'      // コラム・一般情報

/** 免責事項テンプレート */
export interface DisclaimerTemplate {
  /** カテゴリ */
  category: DisclaimerCategory
  /** テンプレートテキスト */
  text: string
  /** HTMLテンプレート */
  html: string
  /** JSON-LD 構造化データ */
  structuredData: Record<string, unknown>
}

/** 編集方針テンプレート */
export interface EditorialPolicyTemplate {
  /** 編集方針テキスト */
  text: string
  /** HTMLテンプレート */
  html: string
}

/** プライバシーポリシーテンプレート */
export interface PrivacyPolicyTemplate {
  /** プライバシーポリシーテキスト */
  text: string
  /** HTMLテンプレート */
  html: string
}

/** PR表記深度レベル */
export type AffiliateDisclosureDepth = 'minimal' | 'standard' | 'detailed'

/** PR表記テンプレート */
export interface AffiliateDisclosureTemplate {
  /** 深度レベル */
  depth: AffiliateDisclosureDepth
  /** PR表記テキスト */
  text: string
  /** HTMLテンプレート */
  html: string
  /** 配置位置 */
  position: 'top' | 'bottom' | 'both'
}

// ============================================================
// 免責事項テンプレート定義
// ============================================================

const DISCLAIMER_TEMPLATES: Record<DisclaimerCategory, DisclaimerTemplate> = {
  medical: {
    category: 'medical',
    text: [
      '【免責事項】',
      '本記事は医療情報を提供するものであり、診断・治療を目的としたものではありません。',
      '記事内で紹介している治療法・医薬品の情報は、医師の診察・指導のもとで行う治療の参考情報として提供しています。',
      '自己判断での治療開始・変更・中止は避け、必ず医師にご相談ください。',
      '',
      '医薬品の効果・副作用には個人差があります。',
      '治療費用は医療機関によって異なります。記載の費用は参考情報であり、正確な金額は各医療機関にお問い合わせください。',
      '本記事の情報は執筆時点のものであり、最新の医療情報・ガイドラインとは異なる場合があります。',
      '',
      '※本記事はアフィリエイト広告（PR）を含みます。',
    ].join('\n'),
    html: `<div class="disclaimer-box disclaimer-medical" role="complementary" aria-label="免責事項">
  <h4>免責事項</h4>
  <p>本記事は医療情報を提供するものであり、診断・治療を目的としたものではありません。</p>
  <p>記事内で紹介している治療法・医薬品の情報は、医師の診察・指導のもとで行う治療の参考情報として提供しています。自己判断での治療開始・変更・中止は避け、必ず医師にご相談ください。</p>
  <p>医薬品の効果・副作用には個人差があります。治療費用は医療機関によって異なります。</p>
  <p class="freshness-note">本記事の情報は執筆時点のものであり、最新の医療情報・ガイドラインとは異なる場合があります。</p>
  <p class="pr-disclosure">※本記事はアフィリエイト広告（PR）を含みます。</p>
</div>`,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'MedicalWebPage',
      lastReviewed: '{{UPDATED_AT}}',
      about: {
        '@type': 'MedicalCondition',
      },
      mainContentOfPage: {
        '@type': 'WebPageElement',
        cssSelector: '.article-content',
      },
    },
  },

  beauty: {
    category: 'beauty',
    text: [
      '【免責事項】',
      '効果には個人差があります。本記事で紹介している化粧品・美容施術の効果を保証するものではありません。',
      '肌に異常を感じた場合は直ちに使用を中止し、皮膚科専門医にご相談ください。',
      '',
      '化粧品の「浸透」とは角質層までを指します。',
      '「エイジングケア」とは年齢に応じたお手入れのことです。',
      '施術・施術費用は各クリニック・サロンによって異なります。',
      '',
      '※本記事はアフィリエイト広告（PR）を含みます。',
    ].join('\n'),
    html: `<div class="disclaimer-box disclaimer-beauty" role="complementary" aria-label="免責事項">
  <h4>免責事項</h4>
  <p>効果には個人差があります。本記事で紹介している化粧品・美容施術の効果を保証するものではありません。</p>
  <p>肌に異常を感じた場合は直ちに使用を中止し、皮膚科専門医にご相談ください。</p>
  <p>化粧品の「浸透」とは角質層までを指します。「エイジングケア」とは年齢に応じたお手入れのことです。</p>
  <p class="freshness-note">施術・施術費用は各クリニック・サロンによって異なります。</p>
  <p class="pr-disclosure">※本記事はアフィリエイト広告（PR）を含みます。</p>
</div>`,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      lastReviewed: '{{UPDATED_AT}}',
    },
  },

  supplement: {
    category: 'supplement',
    text: [
      '【免責事項】',
      '本品は特定保健用食品ではありません。疾病の診断、治療、予防を目的としたものではありません。',
      '食生活は、主食、主菜、副菜を基本に、食事のバランスを。',
      '',
      'サプリメントは医薬品ではなく、効果・効能を保証するものではありません。',
      '効果には個人差があります。',
      '持病のある方や薬を服用中の方は、使用前に必ず医師・薬剤師にご相談ください。',
      '妊娠中・授乳中の方は、ご使用前に医師にご相談ください。',
      '',
      '※本記事はアフィリエイト広告（PR）を含みます。',
    ].join('\n'),
    html: `<div class="disclaimer-box disclaimer-supplement" role="complementary" aria-label="免責事項">
  <h4>免責事項</h4>
  <p>本品は特定保健用食品ではありません。疾病の診断、治療、予防を目的としたものではありません。</p>
  <p>食生活は、主食、主菜、副菜を基本に、食事のバランスを。</p>
  <p>サプリメントは医薬品ではなく、効果・効能を保証するものではありません。効果には個人差があります。</p>
  <p>持病のある方や薬を服用中の方は、使用前に必ず医師・薬剤師にご相談ください。</p>
  <p class="pr-disclosure">※本記事はアフィリエイト広告（PR）を含みます。</p>
</div>`,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      lastReviewed: '{{UPDATED_AT}}',
    },
  },

  general: {
    category: 'general',
    text: [
      '【免責事項】',
      '本記事の情報は一般的な情報提供を目的としており、医療行為に代わるものではありません。',
      '具体的な症状やお悩みがある場合は、各専門の医療機関にご相談ください。',
      '',
      '記載の情報は執筆時点のものであり、変更される場合があります。',
      '',
      '※本記事はアフィリエイト広告（PR）を含みます。',
    ].join('\n'),
    html: `<div class="disclaimer-box disclaimer-general" role="complementary" aria-label="免責事項">
  <h4>免責事項</h4>
  <p>本記事の情報は一般的な情報提供を目的としており、医療行為に代わるものではありません。</p>
  <p>具体的な症状やお悩みがある場合は、各専門の医療機関にご相談ください。</p>
  <p class="freshness-note">記載の情報は執筆時点のものであり、変更される場合があります。</p>
  <p class="pr-disclosure">※本記事はアフィリエイト広告（PR）を含みます。</p>
</div>`,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      lastReviewed: '{{UPDATED_AT}}',
    },
  },
}

// ============================================================
// カテゴリ → 免責事項カテゴリ マッピング
// ============================================================

/**
 * ContentCategory や文字列をDisclaimerCategoryにマッピングする
 */
function mapToDisclaimerCategory(category: string): DisclaimerCategory {
  switch (category) {
    case 'aga':
    case 'ed':
      return 'medical'
    case 'hair-removal':
    case 'skincare':
      return 'beauty'
    case 'supplement':
      return 'supplement'
    case 'column':
    default:
      return 'general'
  }
}

// ============================================================
// メイン関数
// ============================================================

/**
 * カテゴリ別の免責事項テンプレートを取得する
 *
 * ContentCategory（aga, ed, hair-removal, skincare, column）や
 * DisclaimerCategory（medical, beauty, supplement, general）のどちらでも指定可能。
 *
 * @param category コンテンツカテゴリまたは免責事項カテゴリ
 * @returns 免責事項テンプレート
 *
 * @example
 * ```ts
 * const disclaimer = getDisclaimerTemplate('aga');
 * console.log(disclaimer.text);
 * // "【免責事項】\n本記事は医療情報を提供するものであり..."
 * ```
 */
export function getDisclaimerTemplate(category: string): DisclaimerTemplate {
  // まず DisclaimerCategory として直接マッチを試行
  if (category in DISCLAIMER_TEMPLATES) {
    return DISCLAIMER_TEMPLATES[category as DisclaimerCategory]
  }
  // ContentCategory からマッピング
  const disclaimerCategory = mapToDisclaimerCategory(category)
  return DISCLAIMER_TEMPLATES[disclaimerCategory]
}

/**
 * 編集方針テンプレートを取得する
 *
 * MENS CATALY の編集方針（E-E-A-T強化）テキストを返す。
 * サイト全体で統一された編集ポリシーを保証する。
 *
 * @returns 編集方針テンプレート
 *
 * @example
 * ```ts
 * const policy = getEditorialPolicyTemplate();
 * console.log(policy.text);
 * ```
 */
export function getEditorialPolicyTemplate(): EditorialPolicyTemplate {
  const text = [
    '【編集方針】',
    '',
    'MENS CATALY（メンズカタリ）は、男性の医療・美容に関する正確で信頼性の高い情報を提供することを使命としています。',
    '',
    '■ 情報の正確性',
    '記事の内容は、公的機関のガイドライン（厚生労働省、PMDA等）、学会発表、査読済み論文（PubMed等）に基づいて作成しています。',
    '執筆後は専門医・薬剤師等の有資格者による監修を受けています。',
    '',
    '■ 透明性',
    '本サイトはアフィリエイトプログラムに参加しており、記事内のリンクから商品・サービスを購入・申込された場合に報酬が発生することがあります。',
    'ただし、商品・サービスの評価・推奨はサービスの品質に基づいた独自の基準によるものであり、広告主からの指示・依頼によるものではありません。',
    '',
    '■ コンプライアンス',
    '記事の作成にあたっては、薬機法（医薬品、医療機器等の品質、有効性及び安全性の確保等に関する法律）第66条・第67条、景品表示法、ステマ規制を遵守しています。',
    'AIによる自動コンプライアンスチェックと人的レビューの二重体制で品質を管理しています。',
    '',
    '■ 更新方針',
    '医療・美容に関する情報は変化が早いため、公開後も定期的に内容を見直し、最新情報への更新を行っています。',
    '情報の正確性に疑義がある場合は、記事の非公開化を含む迅速な対応を行います。',
    '',
    '■ お問い合わせ',
    '記事内容に関するご指摘・ご意見は、お問い合わせフォームよりご連絡ください。',
  ].join('\n')

  const html = `<div class="editorial-policy" role="complementary" aria-label="編集方針">
  <h2>編集方針</h2>
  <p>MENS CATALY（メンズカタリ）は、男性の医療・美容に関する正確で信頼性の高い情報を提供することを使命としています。</p>

  <h3>情報の正確性</h3>
  <p>記事の内容は、公的機関のガイドライン（厚生労働省、PMDA等）、学会発表、査読済み論文（PubMed等）に基づいて作成しています。執筆後は専門医・薬剤師等の有資格者による監修を受けています。</p>

  <h3>透明性</h3>
  <p>本サイトはアフィリエイトプログラムに参加しており、記事内のリンクから商品・サービスを購入・申込された場合に報酬が発生することがあります。ただし、商品・サービスの評価・推奨はサービスの品質に基づいた独自の基準によるものであり、広告主からの指示・依頼によるものではありません。</p>

  <h3>コンプライアンス</h3>
  <p>記事の作成にあたっては、薬機法第66条・第67条、景品表示法、ステマ規制を遵守しています。AIによる自動コンプライアンスチェックと人的レビューの二重体制で品質を管理しています。</p>

  <h3>更新方針</h3>
  <p>医療・美容に関する情報は変化が早いため、公開後も定期的に内容を見直し、最新情報への更新を行っています。情報の正確性に疑義がある場合は、記事の非公開化を含む迅速な対応を行います。</p>

  <h3>お問い合わせ</h3>
  <p>記事内容に関するご指摘・ご意見は、お問い合わせフォームよりご連絡ください。</p>
</div>`

  return { text, html }
}

/**
 * プライバシーポリシーテンプレートを取得する
 *
 * Cookie/ITP対応、GA4、アフィリエイトリンクに関するプライバシーポリシーを返す。
 *
 * @returns プライバシーポリシーテンプレート
 *
 * @example
 * ```ts
 * const privacy = getPrivacyPolicyTemplate();
 * console.log(privacy.text);
 * ```
 */
export function getPrivacyPolicyTemplate(): PrivacyPolicyTemplate {
  const text = [
    '【プライバシーポリシー】',
    '',
    'MENS CATALY（メンズカタリ）（以下「当サイト」）は、ユーザーの個人情報の取り扱いについて、以下のとおりプライバシーポリシーを定めます。',
    '',
    '■ 個人情報の収集について',
    '当サイトでは、お問い合わせフォーム等を通じて、お名前・メールアドレス等の個人情報をご提供いただく場合があります。',
    '収集した個人情報は、お問い合わせへの対応およびサービスの向上のためにのみ使用します。',
    '',
    '■ アクセス解析ツールについて',
    '当サイトでは、Googleが提供するアクセス解析ツール「Google Analytics 4（GA4）」を使用しています。',
    'GA4はCookieを使用してデータを収集しますが、個人を特定する情報は含まれません。',
    'データの収集はGoogleのプライバシーポリシーに基づいて管理されます。',
    '詳細はGoogleのプライバシーポリシー（https://policies.google.com/privacy）をご確認ください。',
    '',
    '■ Cookie（クッキー）について',
    '当サイトでは、ユーザー体験の向上、アクセス解析、広告配信のためにCookieを使用しています。',
    'ブラウザの設定によりCookieの受け入れを拒否することができますが、一部の機能がご利用いただけなくなる場合があります。',
    '',
    '■ 広告配信について',
    '当サイトは、以下のアフィリエイトサービスプロバイダ（ASP）と提携し、広告を掲載しています。',
    '- A8.net（株式会社ファンコミュニケーションズ）',
    '- afb（株式会社フォーイット）',
    '- アクセストレード（株式会社インタースペース）',
    '- もしもアフィリエイト（株式会社もしも）',
    '',
    'これらのASPは、ITP（Intelligent Tracking Prevention）対応のためにファーストパーティCookieまたはサーバーサイドトラッキングを使用する場合があります。',
    '',
    '■ 第三者への提供について',
    '収集した個人情報は、法令に基づく場合を除き、第三者に提供することはありません。',
    '',
    '■ プライバシーポリシーの変更について',
    '当サイトは、必要に応じてプライバシーポリシーを変更することがあります。',
    '変更後のプライバシーポリシーは、当ページに掲載された時点で効力を生じるものとします。',
    '',
    '制定日: {{ESTABLISHED_DATE}}',
    '最終更新日: {{UPDATED_DATE}}',
  ].join('\n')

  const html = `<div class="privacy-policy" role="main" aria-label="プライバシーポリシー">
  <h1>プライバシーポリシー</h1>
  <p>MENS CATALY（メンズカタリ）（以下「当サイト」）は、ユーザーの個人情報の取り扱いについて、以下のとおりプライバシーポリシーを定めます。</p>

  <h2>個人情報の収集について</h2>
  <p>当サイトでは、お問い合わせフォーム等を通じて、お名前・メールアドレス等の個人情報をご提供いただく場合があります。収集した個人情報は、お問い合わせへの対応およびサービスの向上のためにのみ使用します。</p>

  <h2>アクセス解析ツールについて</h2>
  <p>当サイトでは、Googleが提供するアクセス解析ツール「Google Analytics 4（GA4）」を使用しています。GA4はCookieを使用してデータを収集しますが、個人を特定する情報は含まれません。</p>
  <p>詳細は<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Googleのプライバシーポリシー</a>をご確認ください。</p>

  <h2>Cookie（クッキー）について</h2>
  <p>当サイトでは、ユーザー体験の向上、アクセス解析、広告配信のためにCookieを使用しています。ブラウザの設定によりCookieの受け入れを拒否することができますが、一部の機能がご利用いただけなくなる場合があります。</p>

  <h2>広告配信について</h2>
  <p>当サイトは、以下のアフィリエイトサービスプロバイダ（ASP）と提携し、広告を掲載しています。</p>
  <ul>
    <li>A8.net（株式会社ファンコミュニケーションズ）</li>
    <li>afb（株式会社フォーイット）</li>
    <li>アクセストレード（株式会社インタースペース）</li>
    <li>もしもアフィリエイト（株式会社もしも）</li>
  </ul>

  <h2>第三者への提供について</h2>
  <p>収集した個人情報は、法令に基づく場合を除き、第三者に提供することはありません。</p>

  <h2>プライバシーポリシーの変更について</h2>
  <p>当サイトは、必要に応じてプライバシーポリシーを変更することがあります。変更後のプライバシーポリシーは、当ページに掲載された時点で効力を生じるものとします。</p>

  <p class="policy-dates">制定日: {{ESTABLISHED_DATE}}<br>最終更新日: {{UPDATED_DATE}}</p>
</div>`

  return { text, html }
}

/**
 * アフィリエイト表記（PR表記）テンプレートを深度レベルに応じて取得する
 *
 * ステマ規制（2023年10月施行）に準拠したPR表記テンプレートを、
 * minimal / standard / detailed の3段階で返す。
 *
 * @param depth PR表記の深度レベル
 * @returns PR表記テンプレート
 *
 * @example
 * ```ts
 * const disclosure = getAffiliateDisclosureTemplate('standard');
 * console.log(disclosure.text);
 * // "※本記事はアフィリエイト広告（成果報酬型広告）を含みます..."
 * ```
 */
export function getAffiliateDisclosureTemplate(
  depth: AffiliateDisclosureDepth
): AffiliateDisclosureTemplate {
  return AFFILIATE_DISCLOSURE_TEMPLATES[depth]
}

// ============================================================
// PR表記テンプレート定義
// ============================================================

const AFFILIATE_DISCLOSURE_TEMPLATES: Record<AffiliateDisclosureDepth, AffiliateDisclosureTemplate> = {
  minimal: {
    depth: 'minimal',
    text: '【PR】本記事はアフィリエイト広告を含みます。',
    html: '<p class="pr-disclosure pr-minimal">【PR】本記事はアフィリエイト広告を含みます。</p>',
    position: 'top',
  },

  standard: {
    depth: 'standard',
    text: '※本記事はアフィリエイト広告（成果報酬型広告）を含みます。記事内で紹介するサービス・商品へのリンクからご購入・ご契約いただいた場合、当サイトに報酬が発生することがあります。ただし、紹介内容はサービスの品質に基づいた独自の評価であり、広告主からの指示・依頼によるものではありません。',
    html: `<div class="pr-disclosure pr-standard">
  <p>※本記事はアフィリエイト広告（成果報酬型広告）を含みます。</p>
  <p>記事内で紹介するサービス・商品へのリンクからご購入・ご契約いただいた場合、当サイトに報酬が発生することがあります。ただし、紹介内容はサービスの品質に基づいた独自の評価であり、広告主からの指示・依頼によるものではありません。</p>
</div>`,
    position: 'top',
  },

  detailed: {
    depth: 'detailed',
    text: [
      '【広告表記・免責事項】',
      '',
      '■ 広告について',
      '本記事はアフィリエイト広告（成果報酬型広告）を含みます。記事内で紹介するサービス・商品へのリンクからご購入・ご契約いただいた場合、当サイトに報酬が発生することがあります。',
      '',
      '■ 編集の独立性',
      '紹介内容はサービスの品質に基づいた独自の評価であり、広告主からの指示・依頼によるものではありません。広告の有無は記事の内容・評価に影響しません。',
      '',
      '■ 提携ASP',
      '当サイトは A8.net、afb、アクセストレード、もしもアフィリエイト等のASPと提携しています。',
      '',
      '■ 注意事項',
      '記事内の価格・情報は執筆時点のものです。最新情報は各公式サイトでご確認ください。',
      '医療・美容に関する情報は個人差があります。治療・施術の判断は必ず医師にご相談ください。',
    ].join('\n'),
    html: `<div class="pr-disclosure pr-detailed" role="complementary" aria-label="広告表記・免責事項">
  <h4>広告表記・免責事項</h4>
  <section>
    <h5>広告について</h5>
    <p>本記事はアフィリエイト広告（成果報酬型広告）を含みます。記事内で紹介するサービス・商品へのリンクからご購入・ご契約いただいた場合、当サイトに報酬が発生することがあります。</p>
  </section>
  <section>
    <h5>編集の独立性</h5>
    <p>紹介内容はサービスの品質に基づいた独自の評価であり、広告主からの指示・依頼によるものではありません。広告の有無は記事の内容・評価に影響しません。</p>
  </section>
  <section>
    <h5>提携ASP</h5>
    <p>当サイトは A8.net、afb、アクセストレード、もしもアフィリエイト等のASPと提携しています。</p>
  </section>
  <section>
    <h5>注意事項</h5>
    <p>記事内の価格・情報は執筆時点のものです。最新情報は各公式サイトでご確認ください。</p>
    <p>医療・美容に関する情報は個人差があります。治療・施術の判断は必ず医師にご相談ください。</p>
  </section>
</div>`,
    position: 'both',
  },
}

// ============================================================
// ユーティリティ
// ============================================================

/**
 * 全免責事項カテゴリの一覧を取得する
 */
export function getAllDisclaimerCategories(): DisclaimerCategory[] {
  return Object.keys(DISCLAIMER_TEMPLATES) as DisclaimerCategory[]
}

/**
 * 全PR表記深度レベルの一覧を取得する
 */
export function getAllAffiliateDisclosureDepths(): AffiliateDisclosureDepth[] {
  return Object.keys(AFFILIATE_DISCLOSURE_TEMPLATES) as AffiliateDisclosureDepth[]
}
