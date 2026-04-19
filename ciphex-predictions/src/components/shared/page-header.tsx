import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  accent?: string;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  accent = "#3fb950",
}: PageHeaderProps) {
  return (
    <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6">
      <div className="min-w-0 flex-1">
        <div
          className="mb-2 md:mb-3 font-mono text-[10px] md:text-[11px] font-medium uppercase tracking-[0.14em]"
          style={{ color: accent }}
        >
          / {eyebrow}
        </div>
        <h1 className="m-0 text-[24px] md:text-[28px] xl:text-[32px] font-semibold leading-[1.1] tracking-[-0.025em] text-[#f0f6fc]">
          {title}
        </h1>
        {subtitle && (
          <p className="m-0 mt-2 max-w-[720px] text-[13px] md:text-[14px] leading-[1.6] text-[#8b949e]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
