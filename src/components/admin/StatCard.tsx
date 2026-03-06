type StatCardVariant = "default" | "success" | "warning" | "danger" | "purple" | "blue";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  variant?: StatCardVariant;
}

const VARIANT_STYLES: Record<StatCardVariant, string> = {
  default: "border-slate-200",
  success: "border-green-300 bg-green-50/50",
  warning: "border-amber-300 bg-amber-50/50",
  danger: "border-red-300 bg-red-50/50",
  purple: "border-purple-300 bg-purple-50/50",
  blue: "border-blue-300 bg-blue-50/50",
};

const VARIANT_VALUE_COLORS: Record<StatCardVariant, string> = {
  default: "text-slate-900",
  success: "text-green-700",
  warning: "text-amber-700",
  danger: "text-red-700",
  purple: "text-purple-600",
  blue: "text-blue-700",
};

export function StatCard({
  title,
  value,
  subtitle,
  variant = "default",
}: StatCardProps) {
  return (
    <div
      className={`rounded-lg border bg-white p-5 shadow-sm ${VARIANT_STYLES[variant]}`}
    >
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p
        className={`mt-1 text-2xl font-bold ${VARIANT_VALUE_COLORS[variant]}`}
      >
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
      )}
    </div>
  );
}
