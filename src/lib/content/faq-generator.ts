/**
 * FAQ自動生成モジュール
 * キーワード・カテゴリに基づいたSEO最適化FAQを自動生成する
 *
 * - People Also Ask (PAA) 形式を意識したFAQアイテム生成
 * - カテゴリ別テンプレート（AGA, ED, 脱毛, スキンケア, サプリ）
 * - 薬機法第66条・67条準拠（NG表現を含まない）
 * - FAQ構造化データ（JSON-LD）対応
 */

// ============================================================
// 型定義
// ============================================================

/** FAQ アイテム */
export interface FAQItem {
  /** 質問テキスト */
  question: string
  /** 回答テキスト */
  answer: string
  /** FAQ カテゴリ（質問の分類） */
  faqCategory: string
}

/** FAQ 生成結果 */
export interface FAQGenerationResult {
  /** キーワード */
  keyword: string
  /** カテゴリ */
  category: string
  /** 生成された FAQ アイテムリスト */
  items: FAQItem[]
  /** FAQ構造化データ (JSON-LD) */
  structuredData: Record<string, unknown>
  /** FAQ の Markdown テキスト */
  markdown: string
  /** FAQ の HTML テキスト */
  html: string
}

/** カテゴリ別 FAQ テンプレート */
interface CategoryFAQTemplate {
  /** カテゴリ ID */
  category: string
  /** FAQ テーマ（質問のカテゴリ分類） */
  themes: string[]
  /** テンプレート質問・回答ペア */
  templates: FAQItem[]
}

// ============================================================
// カテゴリ別テンプレート定義
// ============================================================

const FAQ_TEMPLATES: Record<string, CategoryFAQTemplate> = {
  aga: {
    category: 'aga',
    themes: ['治療費', '効果期間', '副作用', '保険適用', 'クリニック選び', '治療薬', 'オンライン診療', '初期脱毛'],
    templates: [
      {
        question: '{{KEYWORD}}の治療費用はどのくらいかかりますか？',
        answer: '{{KEYWORD}}の治療費用は、治療法やクリニックによって異なります。一般的に、フィナステリドの内服治療は月額3,000円〜10,000円（税込）程度、ミノキシジル外用薬は月額5,000円〜15,000円（税込）程度が目安です。ただし、これらは参考価格であり、正確な費用は各医療機関にお問い合わせください（※費用は医療機関により異なります）。',
        faqCategory: '治療費',
      },
      {
        question: '{{KEYWORD}}の効果が出るまでどのくらいかかりますか？',
        answer: '{{KEYWORD}}の効果は個人差がありますが、一般的に治療開始から3〜6ヶ月程度で効果を実感される方が多いとされています。日本皮膚科学会のガイドラインでは、少なくとも6ヶ月以上の継続治療が推奨されています。効果の実感には個人差がありますので、担当医と相談しながら治療を継続することが大切です。',
        faqCategory: '効果期間',
      },
      {
        question: '{{KEYWORD}}に副作用はありますか？',
        answer: '{{KEYWORD}}に使用される治療薬には、副作用が生じる場合があります。フィナステリドでは性欲減退や勃起機能の低下が、ミノキシジルでは頭皮のかゆみや初期脱毛が報告されています。副作用の発現率は臨床試験で数%程度とされていますが、症状が現れた場合は速やかに担当医にご相談ください。',
        faqCategory: '副作用',
      },
      {
        question: '{{KEYWORD}}は保険適用されますか？',
        answer: '{{KEYWORD}}は、現在の日本の医療制度においては自由診療（保険適用外）となります。そのため、治療費は全額自己負担となります。ただし、一部の医療費控除の対象となる場合がありますので、詳細は税務署または税理士にご確認ください。',
        faqCategory: '保険適用',
      },
      {
        question: '{{KEYWORD}}のクリニックはどのように選べばよいですか？',
        answer: '{{KEYWORD}}のクリニック選びでは、以下のポイントを参考にしてください。(1) 日本皮膚科学会認定の専門医が在籍しているか、(2) 治療実績や症例数が公開されているか、(3) 料金体系が明確か、(4) オンライン診療に対応しているか、(5) 無料カウンセリングがあるか。複数のクリニックを比較検討し、ご自身に合ったクリニックを選ぶことをおすすめします。',
        faqCategory: 'クリニック選び',
      },
      {
        question: '{{KEYWORD}}はオンライン診療で受けられますか？',
        answer: '{{KEYWORD}}は多くのクリニックでオンライン診療に対応しています。オンライン診療では、スマートフォンやパソコンを使って自宅から受診でき、処方薬は自宅に配送されます。ただし、初回は対面診療が推奨される場合もありますので、各クリニックの対応をご確認ください。',
        faqCategory: 'オンライン診療',
      },
      {
        question: '{{KEYWORD}}で初期脱毛は起こりますか？',
        answer: '{{KEYWORD}}の治療開始後、一時的に抜け毛が増える「初期脱毛」が起こる場合があります。これは治療薬の作用により毛周期がリセットされる過程で生じるもので、通常1〜3ヶ月程度で収まるとされています。不安な場合は担当医にご相談ください。',
        faqCategory: '初期脱毛',
      },
      {
        question: '{{KEYWORD}}の治療は何歳から始められますか？',
        answer: '{{KEYWORD}}の治療は、一般的に20歳以上の方を対象としています。フィナステリドは成人男性に処方される医薬品であり、未成年者への使用は認められていません。薄毛が気になり始めたら、早めに専門医に相談することが効果的な治療につながります。',
        faqCategory: '治療薬',
      },
    ],
  },

  ed: {
    category: 'ed',
    themes: ['治療薬比較', 'オンライン診療', '費用', '副作用', '原因', '治療期間', '受診の流れ', '生活習慣'],
    templates: [
      {
        question: '{{KEYWORD}}の治療薬にはどのような種類がありますか？',
        answer: '{{KEYWORD}}の主な治療薬には、シルデナフィル（バイアグラ）、タダラフィル（シアリス）、バルデナフィル（レビトラ）の3種類があります。それぞれ作用時間や特徴が異なります。シルデナフィルは効果持続時間が約4〜6時間、タダラフィルは最大36時間とされています。治療薬の選択は、医師の診察に基づいて行われます。',
        faqCategory: '治療薬比較',
      },
      {
        question: '{{KEYWORD}}はオンライン診療で治療できますか？',
        answer: '{{KEYWORD}}はオンライン診療での治療に対応しているクリニックが増えています。プライバシーに配慮された環境で受診でき、処方薬は自宅に配送されます。ただし、基礎疾患の有無や服用中の薬によってはオンライン診療が適さない場合もありますので、各クリニックにご確認ください。',
        faqCategory: 'オンライン診療',
      },
      {
        question: '{{KEYWORD}}の治療費用はどのくらいですか？',
        answer: '{{KEYWORD}}の治療費用はクリニックや使用する薬剤によって異なります。一般的に1錠あたり1,000円〜2,500円（税込）程度が目安です。ジェネリック医薬品を選択することで費用を抑えられる場合もあります。正確な費用は各医療機関にお問い合わせください（※自由診療のため保険適用外）。',
        faqCategory: '費用',
      },
      {
        question: '{{KEYWORD}}の治療薬に副作用はありますか？',
        answer: '{{KEYWORD}}の治療薬（PDE5阻害薬）には、頭痛、顔面紅潮、鼻づまり、消化不良などの副作用が報告されています。多くの場合は軽度で一時的ですが、視覚異常や4時間以上持続する勃起（持続勃起症）などの症状が現れた場合は、直ちに医師の診察を受けてください。',
        faqCategory: '副作用',
      },
      {
        question: '{{KEYWORD}}の原因にはどのようなものがありますか？',
        answer: '{{KEYWORD}}の原因は大きく分けて、(1) 器質性（血管や神経の問題）、(2) 心因性（ストレス、不安、緊張）、(3) 混合性（両方の要因）の3つがあります。加齢、生活習慣病（糖尿病、高血圧等）、喫煙、飲酒、ストレスなどがリスク因子とされています。原因に応じた適切な治療法がありますので、まずは専門医にご相談ください。',
        faqCategory: '原因',
      },
      {
        question: '{{KEYWORD}}の治療は恥ずかしくないですか？',
        answer: '{{KEYWORD}}は40歳以上の男性の約3人に1人が経験するとされている一般的な症状です。近年はオンライン診療の普及により、対面での受診に抵抗がある方でも気軽に相談できる環境が整っています。専門のクリニックではプライバシーに最大限配慮した診療体制を整えています。',
        faqCategory: '受診の流れ',
      },
      {
        question: '{{KEYWORD}}は生活習慣の改善で治りますか？',
        answer: '{{KEYWORD}}の改善には、生活習慣の見直しが効果的な場合があります。適度な運動、バランスの取れた食事、十分な睡眠、禁煙、適度な飲酒などが推奨されています。ただし、生活習慣の改善だけで十分な効果が得られない場合は、医師の診察に基づいた治療が必要です。',
        faqCategory: '生活習慣',
      },
      {
        question: '{{KEYWORD}}の治療薬は他の薬と併用できますか？',
        answer: '{{KEYWORD}}の治療薬（PDE5阻害薬）は、硝酸剤（ニトログリセリン等）との併用が禁忌です。また、一部の降圧剤やα遮断薬との併用にも注意が必要です。服用中の薬がある方は、必ず診察時に医師にお伝えください。自己判断での服用は危険ですので、必ず医師の処方に従ってください。',
        faqCategory: '治療薬比較',
      },
    ],
  },

  'hair-removal': {
    category: 'hair-removal',
    themes: ['回数', '痛み', '費用', 'エステとの違い', 'アフターケア', '部位', '期間', '肌トラブル'],
    templates: [
      {
        question: '{{KEYWORD}}は何回通えば完了しますか？',
        answer: '{{KEYWORD}}の完了までの回数は、部位や毛質、使用するレーザーの種類によって個人差があります。一般的に医療脱毛の場合、5〜10回程度の施術で満足される方が多いとされています。ただし、毛量や毛質により追加施術が必要になる場合もあります。詳しくは無料カウンセリングでご相談ください。',
        faqCategory: '回数',
      },
      {
        question: '{{KEYWORD}}は痛いですか？',
        answer: '{{KEYWORD}}の痛みの感じ方には個人差があります。一般的に「輪ゴムで弾かれたような感覚」と表現されることが多いです。近年は蓄熱式ダイオードレーザーなど痛みの少ない機器も普及しています。痛みが心配な方は、麻酔クリームの使用が可能なクリニックもありますので、事前にご確認ください。',
        faqCategory: '痛み',
      },
      {
        question: '{{KEYWORD}}の費用はどのくらいですか？',
        answer: '{{KEYWORD}}の費用は、施術部位やクリニックによって大きく異なります。全身脱毛の場合、5回コースで200,000円〜400,000円（税込）程度が目安ですが、キャンペーンや部位別プランでさらに費用を抑えられる場合もあります。正確な料金は各クリニック・サロンにお問い合わせください（※価格は参考値であり、時期・条件により異なります）。',
        faqCategory: '費用',
      },
      {
        question: '医療脱毛とエステ脱毛の違いは何ですか？',
        answer: '医療脱毛はクリニック（医療機関）で行われ、高出力のレーザーを使用します。エステ脱毛はサロンで行われ、光（IPL）を使用します。医療脱毛のほうが1回あたりの効果が高いとされていますが、費用も高めになる傾向があります。どちらも効果には個人差がありますので、ご自身の予算や求める効果に合わせてお選びください。',
        faqCategory: 'エステとの違い',
      },
      {
        question: '{{KEYWORD}}後のアフターケアはどうすればよいですか？',
        answer: '{{KEYWORD}}後は以下のアフターケアが推奨されます。(1) 施術当日は激しい運動・入浴を控える、(2) 日焼け止めを塗って紫外線対策をする、(3) 保湿を十分に行う、(4) 施術部位を強くこすらない。赤みや腫れが長引く場合は、施術を受けたクリニックに相談してください。',
        faqCategory: 'アフターケア',
      },
      {
        question: '{{KEYWORD}}で人気の部位はどこですか？',
        answer: '{{KEYWORD}}で人気の部位は、男性の場合はヒゲ（口周り・あご・頬）、VIO、全身が上位を占めています。特にヒゲ脱毛は毎日の髭剃りの手間を軽減できるとして、ビジネスマンを中心に人気が高まっています。部位ごとの料金や回数の目安は、各クリニックの公式サイトでご確認ください。',
        faqCategory: '部位',
      },
      {
        question: '{{KEYWORD}}は肌が弱くても受けられますか？',
        answer: '{{KEYWORD}}は肌が弱い方でも受けられる場合がありますが、事前に医師による肌状態の確認が必要です。アトピー性皮膚炎や敏感肌の方は、出力調整や使用機器の選定など、肌質に合わせた対応が可能なクリニックを選ぶことをおすすめします。まずは無料カウンセリングでご相談ください。',
        faqCategory: '肌トラブル',
      },
      {
        question: '{{KEYWORD}}は1回の施術時間はどのくらいですか？',
        answer: '{{KEYWORD}}の1回あたりの施術時間は部位によって異なります。ヒゲ脱毛は約15〜30分、全身脱毛は約60〜120分が目安です。施術前の準備やクーリング時間を含めると、全体でさらに15〜30分程度かかる場合があります。',
        faqCategory: '期間',
      },
    ],
  },

  skincare: {
    category: 'skincare',
    themes: ['使い方', '成分', '肌質別', '値段', '効果', '選び方', '肌トラブル', '紫外線対策'],
    templates: [
      {
        question: '{{KEYWORD}}の正しい使い方は？',
        answer: '{{KEYWORD}}の基本的な使い方は、洗顔後の清潔な肌に適量を塗布することです。スキンケアの順番は一般的に「化粧水→美容液→乳液→クリーム」の順で行います。使用量や頻度は製品ごとに異なりますので、各製品の説明書をご確認ください。効果には個人差があります。',
        faqCategory: '使い方',
      },
      {
        question: '{{KEYWORD}}にはどのような成分が含まれていますか？',
        answer: '{{KEYWORD}}に配合される主な有効成分には、保湿成分（セラミド、ヒアルロン酸等）、整肌成分（ナイアシンアミド、ビタミンC誘導体等）などがあります。成分の効果には個人差があり、すべての方に同様の効果を保証するものではありません。肌に合わない場合は使用を中止し、皮膚科専門医にご相談ください。',
        faqCategory: '成分',
      },
      {
        question: '{{KEYWORD}}は自分の肌質に合いますか？',
        answer: '{{KEYWORD}}の肌質との相性は個人差があります。脂性肌・乾燥肌・混合肌・敏感肌など、肌質に合わせた製品選びが重要です。初めて使用する製品は、パッチテスト（腕の内側などに少量を塗布して24時間様子を見る）を行うことをおすすめします。肌質に不安がある方は、皮膚科専門医にご相談ください。',
        faqCategory: '肌質別',
      },
      {
        question: '{{KEYWORD}}の価格帯はどのくらいですか？',
        answer: '{{KEYWORD}}の価格帯は製品によって幅があります。ドラッグストアで購入できる手頃なものから、デパートコスメのような高価格帯のものまで様々です。価格と効果は必ずしも比例しません。ご自身の予算に合わせて、成分や使用感で選ぶことをおすすめします（※価格は販売店・時期により異なります）。',
        faqCategory: '値段',
      },
      {
        question: '{{KEYWORD}}の効果はいつ頃から実感できますか？',
        answer: '{{KEYWORD}}の効果を実感するまでの期間は個人差がありますが、一般的に肌のターンオーバー（約28日）の1〜2サイクル、つまり1〜2ヶ月程度の継続使用が推奨されています。ただし、効果の実感には個人差があり、すべての方に同様の効果を保証するものではありません。',
        faqCategory: '効果',
      },
      {
        question: '{{KEYWORD}}の選び方のポイントは？',
        answer: '{{KEYWORD}}を選ぶ際のポイントは、(1) 自分の肌質（乾燥肌、脂性肌、混合肌等）に合っているか、(2) 目的に合った有効成分が配合されているか、(3) 継続して購入できる価格帯か、(4) テクスチャー（使用感）が好みに合うか、の4点です。迷った場合はサンプルやトライアルセットで試してみることをおすすめします。',
        faqCategory: '選び方',
      },
      {
        question: '{{KEYWORD}}で肌荒れすることはありますか？',
        answer: 'どのようなスキンケア製品でも、肌質や体調によって肌荒れを引き起こす場合があります。使用中に赤み、かゆみ、腫れなどの異常が現れた場合は、直ちに使用を中止し、皮膚科専門医にご相談ください。初めて使用する際はパッチテストを行うことをおすすめします。',
        faqCategory: '肌トラブル',
      },
      {
        question: 'メンズスキンケアで日焼け止めは必要ですか？',
        answer: '紫外線は肌の老化（光老化）やシミの原因となるため、男性でも日焼け止めの使用は推奨されています。SPF30・PA+++程度の日焼け止めを毎日使用することで、紫外線による肌ダメージを軽減する効果が期待できます。屋外での活動が多い方は、こまめな塗り直しが大切です。',
        faqCategory: '紫外線対策',
      },
    ],
  },

  supplement: {
    category: 'supplement',
    themes: ['効果', '飲み方', '副作用', '選び方', 'エビデンス', '価格', '安全性', '食事との関係'],
    templates: [
      {
        question: '{{KEYWORD}}にはどのような効果がありますか？',
        answer: '{{KEYWORD}}に含まれる成分には、特定の健康効果に関する研究報告がありますが、サプリメントは医薬品ではなく、効果・効能を保証するものではありません。効果には個人差があります。特定保健用食品（トクホ）や機能性表示食品の場合は、消費者庁に届出された機能性表示をご確認ください。',
        faqCategory: '効果',
      },
      {
        question: '{{KEYWORD}}の正しい飲み方は？',
        answer: '{{KEYWORD}}の飲み方は製品ごとに異なりますので、パッケージに記載された1日の摂取目安量を守ってお召し上がりください。一般的に、水またはぬるま湯での摂取が推奨されています。過剰摂取は健康に悪影響を及ぼす場合がありますので、摂取目安量を超えないようにご注意ください。',
        faqCategory: '飲み方',
      },
      {
        question: '{{KEYWORD}}に副作用はありますか？',
        answer: 'サプリメントは医薬品ではありませんが、体質や体調によっては胃腸の不調やアレルギー反応などが生じる場合があります。特に持病のある方や薬を服用中の方は、相互作用の可能性がありますので、使用前に必ず医師・薬剤師にご相談ください。体調に異変を感じた場合は、使用を中止し医療機関を受診してください。',
        faqCategory: '副作用',
      },
      {
        question: '{{KEYWORD}}の選び方のポイントは？',
        answer: '{{KEYWORD}}を選ぶ際は、(1) 含有成分と配合量が明記されているか、(2) GMP認定工場で製造されているか、(3) 第三者機関の検査を受けているか、(4) 機能性表示食品やトクホの認証があるか、(5) 継続可能な価格帯か、を確認することをおすすめします。過大な効果を謳う製品には注意が必要です。',
        faqCategory: '選び方',
      },
      {
        question: '{{KEYWORD}}のエビデンス（科学的根拠）はありますか？',
        answer: '{{KEYWORD}}のエビデンスは成分ごとに異なります。一部の成分については学術論文や臨床試験で効果が報告されていますが、サプリメントとしての効果を直接証明するものではありません。国立健康・栄養研究所の「健康食品の安全性・有効性情報」サイトで、各成分の科学的根拠を確認することができます。',
        faqCategory: 'エビデンス',
      },
      {
        question: '{{KEYWORD}}は薬と一緒に飲んでも大丈夫ですか？',
        answer: 'サプリメントと医薬品の併用は、相互作用により薬の効果に影響を及ぼす場合があります。特にワーファリン（抗凝血薬）とビタミンK、降圧剤とグレープフルーツ由来成分などの組み合わせには注意が必要です。薬を服用中の方は、必ず医師・薬剤師にご相談のうえ使用してください。',
        faqCategory: '安全性',
      },
      {
        question: '{{KEYWORD}}はどのくらいの期間飲み続ければよいですか？',
        answer: '{{KEYWORD}}の効果を実感するまでの期間は成分や個人差によって異なりますが、一般的に3ヶ月程度の継続摂取が推奨されることが多いです。ただし、効果には個人差があり、全ての方に同様の効果を保証するものではありません。長期間使用しても効果を感じない場合は、見直しを検討してください。',
        faqCategory: '効果',
      },
      {
        question: 'サプリメントは食事の代わりになりますか？',
        answer: 'サプリメントは食事の代わりにはなりません。サプリメントはあくまで「栄養補助食品」であり、バランスの取れた食事を基本とした上で、不足しがちな栄養素を補うために活用するものです。厚生労働省の「日本人の食事摂取基準」に基づき、まずは食事からの栄養摂取を心がけましょう。',
        faqCategory: '食事との関係',
      },
    ],
  },
}

// ============================================================
// メイン関数
// ============================================================

/**
 * キーワード・カテゴリに基づいてFAQアイテムを自動生成する
 *
 * カテゴリ別のテンプレートをベースに、キーワードを埋め込んだ
 * SEO最適化FAQを5〜8件生成する。
 * 全FAQは薬機法準拠（NG表現を含まない）。
 *
 * @param keyword メインキーワード
 * @param category コンテンツカテゴリ（aga, ed, hair-removal, skincare, supplement, column）
 * @returns FAQ生成結果（FAQアイテム、構造化データ、Markdown、HTML）
 *
 * @example
 * ```ts
 * const result = generateFAQsForKeyword('AGA治療', 'aga');
 * console.log(result.items.length); // 5-8
 * console.log(result.structuredData); // JSON-LD
 * ```
 */
export function generateFAQsForKeyword(
  keyword: string,
  category: string
): FAQGenerationResult {
  // カテゴリマッピング
  const mappedCategory = mapFAQCategory(category)
  const template = FAQ_TEMPLATES[mappedCategory]

  if (!template) {
    // テンプレートが存在しないカテゴリの場合は空の結果を返す
    return {
      keyword,
      category,
      items: [],
      structuredData: buildFAQStructuredData([]),
      markdown: '',
      html: '',
    }
  }

  // テンプレートからFAQアイテムを生成（5〜8件）
  const targetCount = Math.min(8, Math.max(5, template.templates.length))
  const selectedTemplates = template.templates.slice(0, targetCount)

  const items: FAQItem[] = selectedTemplates.map((t) => ({
    question: t.question.replace(/\{\{KEYWORD\}\}/g, keyword),
    answer: t.answer.replace(/\{\{KEYWORD\}\}/g, keyword),
    faqCategory: t.faqCategory,
  }))

  // 各種フォーマットを生成
  const structuredData = buildFAQStructuredData(items)
  const markdown = buildFAQMarkdown(items)
  const html = buildFAQHtml(items)

  return {
    keyword,
    category,
    items,
    structuredData,
    markdown,
    html,
  }
}

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * カテゴリ文字列をFAQテンプレートのキーにマッピングする
 */
function mapFAQCategory(category: string): string {
  switch (category) {
    case 'aga':
      return 'aga'
    case 'ed':
      return 'ed'
    case 'hair-removal':
      return 'hair-removal'
    case 'skincare':
      return 'skincare'
    case 'supplement':
      return 'supplement'
    case 'column':
    default:
      return category
  }
}

/**
 * FAQ構造化データ（JSON-LD）を構築する
 */
function buildFAQStructuredData(items: FAQItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

/**
 * FAQ Markdown テキストを構築する
 */
function buildFAQMarkdown(items: FAQItem[]): string {
  if (items.length === 0) return ''

  const lines: string[] = ['## よくある質問（FAQ）', '']

  for (const item of items) {
    lines.push(`### ${item.question}`)
    lines.push('')
    lines.push(item.answer)
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * FAQ HTMLテキストを構築する
 */
function buildFAQHtml(items: FAQItem[]): string {
  if (items.length === 0) return ''

  const faqItems = items
    .map(
      (item) => `  <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <h3 class="faq-question" itemprop="name">${escapeHtml(item.question)}</h3>
    <div class="faq-answer" itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">${escapeHtml(item.answer)}</p>
    </div>
  </div>`
    )
    .join('\n')

  return `<section class="faq-section" itemscope itemtype="https://schema.org/FAQPage">
  <h2>よくある質問（FAQ）</h2>
${faqItems}
</section>`
}

/**
 * HTML エスケープ
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ============================================================
// ユーティリティ
// ============================================================

/**
 * 利用可能なFAQカテゴリ一覧を取得する
 */
export function getAvailableFAQCategories(): string[] {
  return Object.keys(FAQ_TEMPLATES)
}

/**
 * カテゴリのFAQテーマ一覧を取得する
 */
export function getFAQThemes(category: string): string[] {
  const mapped = mapFAQCategory(category)
  return FAQ_TEMPLATES[mapped]?.themes ?? []
}

// ============================================================
// FAQ薬機法チェック統合
// ============================================================

import { ComplianceChecker } from '@/lib/compliance/checker'
import type { ComplianceResult } from '@/lib/compliance/types'

/** FAQ薬機法チェック結果 */
export interface FAQComplianceResult {
  /** FAQ生成結果 */
  faqResult: FAQGenerationResult
  /** 各FAQアイテムのコンプライアンスチェック結果 */
  complianceResults: Array<{
    /** FAQアイテムインデックス */
    index: number
    /** 質問テキスト */
    question: string
    /** 回答のコンプライアンスチェック結果 */
    result: ComplianceResult
  }>
  /** 全体のコンプライアンススコア（平均） */
  overallScore: number
  /** 全体が準拠しているか */
  isCompliant: boolean
  /** 違反を含むFAQの件数 */
  violationCount: number
}

/**
 * FAQ生成後にコンプライアンスチェックを行う統合関数
 *
 * generateFAQsForKeyword() でFAQを生成した後、
 * ComplianceChecker.check() で各回答の薬機法チェックを実行する。
 *
 * @param keyword メインキーワード
 * @param category コンテンツカテゴリ
 * @param checkerOptions ComplianceChecker のオプション（省略時はデフォルト）
 * @returns FAQ生成結果 + コンプライアンスチェック結果
 *
 * @example
 * ```ts
 * const result = generateAndCheckFAQs('AGA治療', 'aga');
 * console.log(`FAQ数: ${result.faqResult.items.length}`);
 * console.log(`準拠率: ${result.overallScore}`);
 * console.log(`違反FAQ数: ${result.violationCount}`);
 * if (!result.isCompliant) {
 *   result.complianceResults
 *     .filter(r => !r.result.isCompliant)
 *     .forEach(r => {
 *       console.log(`FAQ ${r.index}: ${r.question}`);
 *       r.result.violations.forEach(v => {
 *         console.log(`  NG: ${v.ngText} → OK: ${v.suggestedText}`);
 *       });
 *     });
 * }
 * ```
 */
export function generateAndCheckFAQs(
  keyword: string,
  category: string,
  checkerOptions?: { categories?: string[]; strictMode?: boolean }
): FAQComplianceResult {
  // 1. FAQ生成
  const faqResult = generateFAQsForKeyword(keyword, category)

  // 2. ComplianceCheckerの初期化
  // カテゴリに応じたチェッカーオプションを設定
  const mappedCategory = mapFAQCategory(category)
  const defaultCategories: string[] = []

  // カテゴリに対応する辞書を追加
  switch (mappedCategory) {
    case 'aga':
      defaultCategories.push('aga', 'common')
      break
    case 'ed':
      defaultCategories.push('ed', 'common')
      break
    case 'hair-removal':
      defaultCategories.push('hair_removal', 'common')
      break
    case 'skincare':
      defaultCategories.push('skincare', 'common')
      break
    case 'supplement':
      defaultCategories.push('supplement', 'common')
      break
    default:
      defaultCategories.push('common')
  }

  const checker = new ComplianceChecker({
    categories: (checkerOptions?.categories ?? defaultCategories) as import('@/lib/compliance/types').Category[],
    strictMode: checkerOptions?.strictMode ?? false,
  })

  // 3. 各FAQアイテムの回答をチェック
  const complianceResults = faqResult.items.map((item, index) => {
    const result = checker.check(item.answer)
    return {
      index,
      question: item.question,
      result,
    }
  })

  // 4. 全体スコアの計算
  const scores = complianceResults.map((r) => r.result.score)
  const overallScore =
    scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
      : 100

  const violationCount = complianceResults.filter(
    (r) => !r.result.isCompliant
  ).length

  const isCompliant = violationCount === 0

  return {
    faqResult,
    complianceResults,
    overallScore,
    isCompliant,
    violationCount,
  }
}
