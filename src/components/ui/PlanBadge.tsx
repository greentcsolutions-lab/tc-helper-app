// src/components/ui/PlanBadge.tsx
import Link from "next/link";
import { PLAN_CONFIGS, type PlanType } from "@/lib/whop";

interface PlanBadgeProps {
  planType: PlanType;
}

const PLAN_STYLES: Record<PlanType, string> = {
  FREE: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  BASIC: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  STANDARD: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
  DEV: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
};

export default function PlanBadge({ planType }: PlanBadgeProps) {
  const config = PLAN_CONFIGS[planType];
  const style = PLAN_STYLES[planType] || PLAN_STYLES.FREE;
  const isFree = planType === "FREE";

  return (
    <Link
      href="/dashboard/billing"
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80 ${style}`}
    >
      <span>{config?.name || planType}</span>
      {isFree && (
        <span className="ml-1.5 text-[10px] opacity-70">Plan</span>
      )}
    </Link>
  );
}
