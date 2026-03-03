interface ComplianceScoreBadgeProps {
  score: number;
}

export function ComplianceScoreBadge({ score }: ComplianceScoreBadgeProps) {
  let colorClasses: string;

  if (score >= 95) {
    colorClasses = "bg-green-100 text-green-800";
  } else if (score >= 80) {
    colorClasses = "bg-yellow-100 text-yellow-800";
  } else {
    colorClasses = "bg-red-100 text-red-800";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colorClasses}`}
    >
      {score}%
    </span>
  );
}
