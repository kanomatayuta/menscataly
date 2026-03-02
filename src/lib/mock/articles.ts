import type { ArticleCardData } from "@/components/ui/Card";

// microCMS未接続時のモックデータ
// 本番では src/lib/microcms/ のクライアントに差し替える

export type MockArticle = ArticleCardData & {
  content: string;
  supervisor?: {
    name: string;
    title: string;
  };
  tags?: string[];
};

export const MOCK_ARTICLES: MockArticle[] = [
  {
    slug: "aga-treatment-guide",
    title: "AGAの治療法を徹底解説｜フィナステリドとミノキシジルの効果と選び方",
    excerpt:
      "AGA（男性型脱毛症）の治療には、フィナステリドやミノキシジルが広く用いられています。それぞれの作用機序や期待できる効果について、最新の研究をもとに解説します。",
    category: "aga",
    publishedAt: "2026-02-01T09:00:00+09:00",
    updatedAt: "2026-03-01T09:00:00+09:00",
    content: `
      <p>AGA（男性型脱毛症）は、多くの男性が悩む症状のひとつです。適切な治療を行うことで、発毛を促進する効果が期待できます。</p>
      <h2>フィナステリドについて</h2>
      <p>フィナステリドは5αリダクターゼ阻害薬であり、DHT（ジヒドロテストステロン）の生成を抑制する作用があります。</p>
    `,
    supervisor: {
      name: "田中 誠 先生",
      title: "皮膚科専門医・毛髪診療専門医",
    },
    tags: ["AGA", "フィナステリド", "ミノキシジル", "薄毛"],
  },
  {
    slug: "medical-hair-removal-mens",
    title: "メンズ医療脱毛の完全ガイド｜クリニック選びから施術の流れまで",
    excerpt:
      "医療脱毛はレーザー照射によりメラニン色素に作用し、毛の成長を抑制する施術です。自己処理の手間を減らしたい方に向けて、クリニック選びのポイントを詳しく解説します。",
    category: "hair-removal",
    publishedAt: "2026-02-05T09:00:00+09:00",
    content: `
      <p>医療脱毛は、医師の管理のもとで行われる安全性の高い脱毛方法です。</p>
      <h2>医療脱毛の仕組み</html>
      <p>レーザーはメラニン色素に反応し、毛根へダメージを与えることで毛の再生を抑制する効果があります。</p>
    `,
    supervisor: {
      name: "山田 美里 先生",
      title: "美容皮膚科専門医",
    },
    tags: ["医療脱毛", "レーザー脱毛", "メンズ美容"],
  },
  {
    slug: "mens-skincare-basics",
    title: "メンズスキンケアの基本｜洗顔・保湿・日焼け止めの正しい使い方",
    excerpt:
      "男性の肌は女性と比べて皮脂分泌が多く、ケアの方法が異なります。毎日のスキンケアルーティンを正しく身につけることで、肌環境を整える効果が期待できます。",
    category: "skincare",
    publishedAt: "2026-02-10T09:00:00+09:00",
    content: `
      <p>男性の肌は皮脂腺が発達しており、適切なケアが重要です。</p>
      <h2>洗顔の基本</h2>
      <p>ぬるま湯での洗顔が肌への刺激を抑えながら汚れを落とすのに適しています。</p>
    `,
    tags: ["スキンケア", "洗顔", "保湿", "日焼け止め"],
  },
  {
    slug: "ed-treatment-options",
    title: "ED治療の選択肢｜PDE5阻害薬の種類と特徴をわかりやすく解説",
    excerpt:
      "ED（勃起不全）の治療薬としてPDE5阻害薬が広く用いられています。シルデナフィル、タダラフィルなどの特徴を比較し、医師との相談にお役立てください。",
    category: "ed",
    publishedAt: "2026-02-15T09:00:00+09:00",
    content: `
      <p>EDは適切な治療を受けることで改善が期待できる状態です。まずは専門の医療機関にご相談ください。</p>
      <h2>PDE5阻害薬について</h2>
      <p>PDE5阻害薬はcGMPの分解を抑制することで血流を改善する作用があります。</p>
    `,
    supervisor: {
      name: "佐藤 健一 先生",
      title: "泌尿器科専門医",
    },
    tags: ["ED", "勃起不全", "PDE5阻害薬"],
  },
  {
    slug: "aga-early-signs",
    title: "AGAの初期サインを見逃すな｜セルフチェック方法と受診タイミング",
    excerpt:
      "AGAは早期発見・早期治療が重要です。抜け毛の量や生え際の変化など、自分でできるセルフチェックの方法と、クリニックへの相談タイミングについて解説します。",
    category: "aga",
    publishedAt: "2026-02-20T09:00:00+09:00",
    content: `
      <p>AGAの初期サインに気づくことが、早期治療の第一歩です。</p>
    `,
    tags: ["AGA", "薄毛", "セルフチェック"],
  },
  {
    slug: "mens-acne-skincare",
    title: "メンズニキビケアの正解｜ニキビができやすい肌質の原因と対策",
    excerpt:
      "成人男性のニキビは皮脂過多や肌のターンオーバーの乱れが主な原因とされています。適切なスキンケアと生活習慣の見直しで肌環境を整えることが期待できます。",
    category: "skincare",
    publishedAt: "2026-02-25T09:00:00+09:00",
    content: `
      <p>ニキビケアは正しいスキンケアが基本です。</p>
    `,
    tags: ["ニキビ", "スキンケア", "メンズ美容"],
  },
];

// カテゴリでフィルタリング
export function getArticlesByCategory(
  category?: string
): MockArticle[] {
  if (!category) return MOCK_ARTICLES;
  return MOCK_ARTICLES.filter((a) => a.category === category);
}

// スラッグで単一記事を取得
export function getArticleBySlug(slug: string): MockArticle | undefined {
  return MOCK_ARTICLES.find((a) => a.slug === slug);
}
