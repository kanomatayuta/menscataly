import Link from "next/link";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface AdminHeaderProps {
  title: string;
  breadcrumbs?: Breadcrumb[];
}

export function AdminHeader({ title, breadcrumbs }: AdminHeaderProps) {
  return (
    <div className="mb-8">
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-1.5 text-sm text-neutral-500">
            <li>
              <Link
                href="/admin"
                className="hover:text-neutral-700 hover:underline"
              >
                Admin
              </Link>
            </li>
            {breadcrumbs.map((crumb, index) => (
              <li key={index} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="text-neutral-300">
                  /
                </span>
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-neutral-700 hover:underline"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-neutral-700">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Page title */}
      <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
    </div>
  );
}
