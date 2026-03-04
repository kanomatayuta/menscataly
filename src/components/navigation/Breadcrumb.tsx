import Link from "next/link";

/** パンくずアイテム */
export interface BreadcrumbItemProps {
  /** ラベルテキスト */
  label: string;
  /** リンク先 (省略時はカレントページ) */
  href?: string;
}

type BreadcrumbProps = {
  items: BreadcrumbItemProps[];
  className?: string;
};

/**
 * パンくずリストコンポーネント
 *
 * Schema.org BreadcrumbList に対応した構造化データは
 * JSON-LD で別途出力されるため、ここでは UI のみ担当。
 */
export function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  return (
    <nav aria-label="パンくずリスト" className={`mb-6 ${className}`}>
      <ol
        className="flex flex-wrap items-center gap-1 text-sm text-neutral-500"
        role="list"
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={`${item.label}-${index}`}
              className="flex items-center gap-1"
            >
              {index > 0 && (
                <span aria-hidden="true" className="text-neutral-400">
                  /
                </span>
              )}
              {isLast || !item.href ? (
                <span className="text-neutral-700" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-neutral-700 hover:underline"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
