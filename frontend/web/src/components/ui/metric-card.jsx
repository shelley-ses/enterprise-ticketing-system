import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function MetricCard({
  title,
  value,
  trend,
  trendPositive = true,
  icon,
  iconBg = "bg-blue-50 text-accent",
  loading = false,
  className,
  onClick,
}) {
  if (loading) {
    return (
      <div className={cn("p-6 rounded-[14px] bg-surface shadow-sm border border-slate-100/50 space-y-3 font-sans", className)}>
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-8 w-16" />
        <div className="flex justify-between items-center pt-2">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-6 rounded-[14px] bg-surface shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md border border-slate-100/50 font-sans flex flex-col justify-between",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div>
        <p className="text-xs font-semibold text-eyebrow uppercase tracking-wider mb-2">
          {title}
        </p>
        <p className="text-3xl font-bold text-dark-slate font-sans tracking-tight">
          {value}
        </p>
      </div>

      <div className="flex items-center justify-between mt-4">
        {trend ? (
          <span
            className={cn(
              "text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center",
              trendPositive
                ? "bg-emerald-50 text-emerald-600"
                : "bg-red-50 text-red-600"
            )}
          >
            {trend}
          </span>
        ) : (
          <span />
        )}

        {icon && (
          <div
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
              iconBg
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
