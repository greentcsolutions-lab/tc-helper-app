// src/components/ui/CreditsBadge.tsx
import Link from "next/link";

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
      <span className="tabular-nums">{credits}</span>
      <span className="w-2" aria-hidden="true" />
      <span className="font-medium">
        {credits === 1 ? "parse" : "parses"} left
      </span>

      {/* Fixed: use Next.js Link instead of <a> → no hydration mismatch & fixes TS 2614 */}
      {isZero && (
        <Link
          href="/dashboard/billing"
          className="ml-3 text-xs font-medium underline hover:no-underline"
        >
          Add credits →
        </Link>
      )}
    </div>
  );
}