import { useState, type SubmitEvent } from "react";
import { flushSync } from "react-dom";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props {
  /** Kitchen-sink: block real navigation */
  demo?: boolean;
  /** stack = home full-width; inline = dashboard row */
  layout?: "stack" | "inline";
  inputId?: string;
}

export default function JoinSessionForm({ demo = false, layout = "stack", inputId = "session-code" }: Props) {
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    if (demo) {
      event.preventDefault();
      return;
    }

    // Paint the pending label before the browser navigates away on the native GET.
    event.preventDefault();
    flushSync(() => {
      setSubmitting(true);
    });
    event.currentTarget.submit();
  }

  return (
    <form
      method="GET"
      action="/play"
      className={cn(layout === "stack" ? "space-y-4" : "flex flex-col gap-3 sm:flex-row sm:items-end")}
      onSubmit={handleSubmit}
    >
      <div className={layout === "inline" ? "min-w-0 flex-1" : undefined}>
        <Label htmlFor={inputId} className="mb-1">
          Kod sesji
        </Label>
        <Input
          id={inputId}
          type="text"
          name="code"
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          className="font-mono text-base tracking-widest uppercase"
        />
      </div>
      <SubmitButton
        pending={submitting || undefined}
        pendingText="Dołączanie..."
        className={layout === "inline" ? "shrink-0 sm:w-auto" : undefined}
      >
        Dołącz
      </SubmitButton>
    </form>
  );
}
