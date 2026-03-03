export type ArticleCategory = "aga" | "hair-removal" | "skincare" | "ed" | "column";

const CATEGORY_LABELS: Record<ArticleCategory, string> = {
  aga: "AGA・薄毛",
  "hair-removal": "メンズ脱毛",
  skincare: "スキンケア",
  ed: "ED治療",
  column: "コラム",
};

const CATEGORY_STYLE_VARS: Record<ArticleCategory, string> = {
  aga: "bg-blue-100 text-blue-800",
  "hair-removal": "bg-purple-100 text-purple-800",
  skincare: "bg-emerald-100 text-emerald-800",
  ed: "bg-red-100 text-red-800",
  column: "bg-amber-100 text-amber-800",
};

type BadgeProps = {
  category: ArticleCategory;
  className?: string;
};

export function Badge({ category, className = "" }: BadgeProps) {
  const label = CATEGORY_LABELS[category];
  const colorClasses = CATEGORY_STYLE_VARS[category];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClasses} ${className}`}
      aria-label={`カテゴリ: ${label}`}
    >
      {label}
    </span>
  );
}

// テキストベースの汎用バッジ
type GenericBadgeProps = {
  label: string;
  colorClass?: string;
  className?: string;
};

export function GenericBadge({
  label,
  colorClass = "bg-neutral-100 text-neutral-800",
  className = "",
}: GenericBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass} ${className}`}
    >
      {label}
    </span>
  );
}
