import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  message: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  message,
  description,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-[#f85149]/30 bg-[rgba(248,81,73,0.05)] p-12 text-center",
        className
      )}
    >
      <AlertCircle className="mb-4 size-8 text-[#f85149]" />
      <p className="text-sm font-medium text-[#f0f6fc]">{message}</p>
      {description && (
        <p className="mt-1 text-xs text-[#8b949e]">{description}</p>
      )}
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-4 gap-2 border-[#30363d] bg-[#161b22] text-[#f0f6fc] hover:bg-[#21262d]"
        >
          <RefreshCw className="size-3" />
          Retry
        </Button>
      )}
    </div>
  );
}
