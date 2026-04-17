import { cn } from "@/lib/utils";

interface EmptyStateProps {
  message: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  message,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-[#30363d] bg-[#161b22] p-12 text-center",
        className
      )}
    >
      {icon && <div className="mb-4 text-[#8b949e]">{icon}</div>}
      <p className="text-sm font-medium text-[#f0f6fc]">{message}</p>
      {description && (
        <p className="mt-1 text-xs text-[#8b949e]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
