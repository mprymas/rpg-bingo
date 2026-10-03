import { useState, type SubmitEvent } from "react";
import { flushSync } from "react-dom";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  code: string;
  prefill: string;
  nickError: boolean;
  fullError?: boolean;
}

export default function JoinNickForm({ code, prefill, nickError, fullError = false }: Props) {
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    // Paint the pending label before the browser navigates away on the native POST.
    event.preventDefault();
    flushSync(() => {
      setSubmitting(true);
    });
    event.currentTarget.submit();
  }

  return (
    <form method="POST" action="/api/play/join" className="space-y-4" onSubmit={handleSubmit}>
      <input type="hidden" name="code" value={code} />
      <div>
        <Label htmlFor="nick" className="mb-1">
          Nick
        </Label>
        <Input
          id="nick"
          name="nick"
          type="text"
          maxLength={24}
          defaultValue={prefill}
          aria-invalid={nickError || undefined}
        />
        {nickError && <p className="text-destructive mt-1 text-sm">Nick musi mieć od 1 do 24 znaków.</p>}
        {fullError && <p className="text-destructive mt-1 text-sm">Stół jest pełny (max 10 graczy).</p>}
      </div>
      <SubmitButton pending={submitting || undefined} pendingText="Wchodzenie...">
        Wejdź
      </SubmitButton>
    </form>
  );
}
