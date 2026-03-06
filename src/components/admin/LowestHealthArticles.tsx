import Link from "next/link";

interface HealthScoreData {
  articleId: string;
  title: string;
  slug: string;
  total: number;
  status: "healthy" | "needs_improvement" | "critical";
  topRecommendation: string | null;
}

interface LowestHealthArticlesProps {
  articles: HealthScoreData[];
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  healthy: { bg: "bg-green-100", text: "text-green-700", label: "良好" },
  needs_improvement: { bg: "bg-amber-100", text: "text-amber-700", label: "改善必要" },
  critical: { bg: "bg-red-100", text: "text-red-700", label: "要注意" },
};

function getScoreColor(score: number): string {
  if (score >= 70) return "text-green-700";
  if (score >= 40) return "text-amber-700";
  return "text-red-700";
}

export function LowestHealthArticles({ articles }: LowestHealthArticlesProps) {
  if (articles.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-slate-500">ヘルススコアデータなし</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-medium text-slate-600">
        スコアが低い記事 (Top 5)
      </h3>
      <div className="space-y-3">
        {articles.map((article) => {
          const style = STATUS_STYLES[article.status] ?? STATUS_STYLES.critical;
          return (
            <div
              key={article.articleId}
              className="rounded-md border border-slate-100 p-3 transition-colors hover:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/articles/${article.articleId}`}
                    className="block truncate text-sm font-medium text-slate-800 hover:text-blue-600 hover:underline"
                  >
                    {article.title}
                  </Link>
                  {article.topRecommendation && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {article.topRecommendation}
                    </p>
                  )}
                </div>
                <div className="flex flex-shrink-0 flex-col items-end gap-1">
                  <span className={`text-lg font-bold ${getScoreColor(article.total)}`}>
                    {article.total}
                  </span>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}
                  >
                    {style.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
