// src/components/CreditsBadge.tsx
interface CreditsBadgeProps {
  credits: number;
}

export default function CreditsBadge({ credits }: CreditsBadgeProps) {
  const isZero = credits === 0;
  const isLow = credits > 0 && credits < 3;

  return (
    <div
      className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition-all ${
        isZero
          ? "bg-red-100 text-red-700"
          : isLow
          ? "bg-amber-100 text-amber-700"
          : "bg-emerald-100 text-emerald-700"
      }`}
    >
      {/* Number + forced spacing */}
      <span className="tabular-nums">{credits}</span>

      {/* This span gives perfect, consistent spacing */}
      <span className="w-2" aria-hidden="true" />

      {/* Text */}
      <span className="font-medium">
        {credits === 1 ? "parse" : "parses"} left
      </span>

      {/* Optional CTA when zero */}
      {isZero && (
        <a
          href="/dashboard/billing"
          className="ml-3 text-xs font-medium underline hover:no-underline"
        >
          Add credits →
        </a>
      )}
    </div>
  );
}