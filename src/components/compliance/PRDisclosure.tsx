type PRDisclosureVariant = "default" | "compact" | "detailed" | "banner";

type PRDisclosureProps = {
  variant?: PRDisclosureVariant;
  className?: string;
};

const DISCLOSURE_TEXTS: Record<PRDisclosureVariant, { title: string; body: string }> = {
  default: {
    title: "PR・広告について",
    body: "本記事はアフィリエイトプログラムに参加しています。記事内のリンクから商品・サービスのご購入があった場合、当サイトに報酬が支払われることがあります。",
  },
  compact: {
    title: "PR",
    body: "本記事はアフィリエイト広告を含みます。",
  },
  detailed: {
    title: "広告・PR表記",
    body: "本記事はアフィリエイトプログラムに参加しています。記事内のリンクから商品・サービスのご購入があった場合、当サイト（メンズカタリ）に報酬が支払われることがあります。ただし、これにより記事の内容や評価が変わることはなく、読者の方への正確な情報提供を最優先としています。",
  },
  banner: {
    title: "【PR・広告】",
    body: "※ 本記事はアフィリエイトプログラムに参加しています",
  },
};

export function PRDisclosure({
  variant = "default",
  className = "",
}: PRDisclosureProps) {
  const { title, body } = DISCLOSURE_TEXTS[variant];

  if (variant === "compact") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 ${className}`}
        role="note"
        aria-label="広告・PR表記"
        data-testid="pr-disclosure"
      >
        <span aria-hidden="true">PR</span>
        <span className="sr-only">広告掲載あり</span>
      </span>
    );
  }

  if (variant === "banner") {
    return (
      <div
        className={`rounded bg-amber-50 px-4 py-2 text-sm text-amber-800 ${className}`}
        role="note"
        aria-label="広告・PR表記"
        data-testid="pr-disclosure"
      >
        <span className="font-semibold">{title}</span>{" "}
        <span>{body}</span>
      </div>
    );
  }

  return (
    <aside
      className={`rounded-lg border border-amber-200 bg-amber-50 p-4 ${className}`}
      aria-label="広告・PR表記"
      role="note"
      data-testid="pr-disclosure"
    >
      <div className="flex gap-3">
        {/* アイコン */}
        <div className="flex-shrink-0">
          <svg
            className="mt-0.5 h-5 w-5 text-amber-500"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        {/* テキスト */}
        <div>
          <p className="text-sm font-semibold text-amber-800">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-amber-700">{body}</p>
        </div>
      </div>
    </aside>
  );
}
