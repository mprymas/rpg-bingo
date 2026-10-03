import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SubmitButtonProps {
  pendingText: string;
  icon?: ReactNode;
  children: ReactNode;
  /** Kitchen-sink only — forces the pending label without a real submit. */
  pending?: boolean;
  className?: string;
}

export function SubmitButton({ pendingText, icon, children, pending: pendingOverride, className }: SubmitButtonProps) {
  const { pending: formPending } = useFormStatus();
  const pending = pendingOverride ?? formPending;

  return (
    <Button type="submit" disabled={pending} className={cn("w-full", className)}>
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="border-primary-foreground/30 border-t-primary-foreground size-4 animate-spin rounded-full border-2" />
          {pendingText}
        </span>
      ) : (
        <span className="flex items-center gap-2">
          {icon}
          {children}
        </span>
      )}
    </Button>
  );
}
