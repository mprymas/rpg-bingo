import React, { useState } from "react";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ServerError } from "@/components/auth/ServerError";
import { useCreateSession } from "@/components/hooks/useCreateSession";
import { cn } from "@/lib/utils";
import { BOARD_SIZES, type BoardSize, type Reward } from "@/types";

type RewardOption = Pick<Reward, "id" | "slug" | "label" | "description">;

export type NewSessionDemoState = "default" | "focus" | "disabled" | "error" | "empty" | "loading";

interface CustomPhraseRow {
  text: string;
  guaranteed: boolean;
}

interface Props {
  rewards: RewardOption[];
  /** Kitchen-sink only — omit on the production create page. */
  demoState?: NewSessionDemoState;
}

function defaultRewardCounts(rewards: RewardOption[], demoState?: NewSessionDemoState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const reward of rewards) {
    counts[reward.id] = reward.slug === "inspiration" ? 3 : 0;
  }
  if (demoState === "disabled" && rewards.length > 0) {
    counts[rewards[0].id] = 99;
  }
  return counts;
}

function initialPhrases(demoState?: NewSessionDemoState): CustomPhraseRow[] {
  if (demoState === "focus") {
    return [{ text: "Hasło z focusem", guaranteed: false }];
  }
  if (demoState === "disabled") {
    return [
      { text: "Hasło gwarantowane 1", guaranteed: true },
      { text: "Hasło gwarantowane 2", guaranteed: true },
    ];
  }
  return [{ text: "", guaranteed: false }];
}

export default function NewSessionForm({ rewards, demoState }: Props) {
  const [size, setSize] = useState<BoardSize>(5);
  const [customPhrases, setCustomPhrases] = useState<CustomPhraseRow[]>(() => initialPhrases(demoState));
  const [rewardCounts, setRewardCounts] = useState<Record<string, number>>(() =>
    defaultRewardCounts(rewards, demoState),
  );
  const { pending, error, createSession } = useCreateSession();

  const maxCells = size * size;
  const guaranteedCount = customPhrases.filter((row) => row.text.trim() && row.guaranteed).length;
  const rewardTotal = Object.values(rewardCounts).reduce((sum, count) => sum + count, 0);
  const overLimit = guaranteedCount > maxCells || rewardTotal > maxCells;

  const effectivePending = demoState === "loading" ? true : pending;
  const effectiveOverLimit = demoState === "disabled" ? true : overLimit;
  const effectiveError = demoState === "error" ? "Nie udało się utworzyć sesji" : error;

  function updatePhrase(index: number, patch: Partial<CustomPhraseRow>) {
    setCustomPhrases((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removePhrase(index: number) {
    setCustomPhrases((rows) => rows.filter((_, i) => i !== index));
  }

  function addPhrase() {
    setCustomPhrases((rows) => [...rows, { text: "", guaranteed: false }]);
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (demoState || effectivePending || effectiveOverLimit) return;

    const phrases = customPhrases
      .map((row) => ({ text: row.text.trim(), guaranteed: row.guaranteed }))
      .filter((row) => row.text.length > 0);

    void createSession({
      size,
      customPhrases: phrases,
      rewards: rewards.map((reward) => ({
        rewardId: reward.id,
        count: rewardCounts[reward.id] ?? 0,
      })),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      <fieldset className="space-y-3">
        <legend className="text-muted-foreground text-sm font-medium">Rozmiar planszy</legend>
        <RadioGroup
          value={String(size)}
          onValueChange={(value) => {
            setSize(Number(value) as BoardSize);
          }}
          className="flex flex-wrap gap-3"
        >
          {BOARD_SIZES.map((option) => {
            const id = demoState ? `size-${demoState}-${option}` : `size-${option}`;
            return (
              <div key={option} className="flex items-center gap-2">
                <RadioGroupItem value={String(option)} id={id} />
                <Label htmlFor={id} className="text-foreground cursor-pointer font-normal">
                  {option}×{option}
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-muted-foreground text-sm font-medium">Własne hasła</legend>
        <div className="space-y-3">
          {customPhrases.map((row, index) => {
            const guaranteedId = demoState ? `guaranteed-${demoState}-${index}` : `guaranteed-${index}`;
            const showFocusRing = demoState === "focus" && index === 0;
            return (
              <div
                key={index}
                className="border-border bg-background flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center"
              >
                <Input
                  type="text"
                  value={row.text}
                  onChange={(e) => {
                    updatePhrase(index, { text: e.target.value });
                  }}
                  placeholder="Wpisz hasło…"
                  maxLength={120}
                  autoFocus={showFocusRing}
                  className={cn("sm:flex-1", showFocusRing && "border-ring ring-ring/50 ring-2")}
                />
                <div className="flex shrink-0 items-center gap-2">
                  <Checkbox
                    id={guaranteedId}
                    checked={row.guaranteed}
                    onCheckedChange={(checked) => {
                      updatePhrase(index, { guaranteed: checked === true });
                    }}
                  />
                  <Label htmlFor={guaranteedId} className="text-muted-foreground cursor-pointer font-normal">
                    Gwarantowane na planszy
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    removePhrase(index);
                  }}
                  aria-label="Usuń hasło"
                  className="text-muted-foreground shrink-0"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>
        <Button type="button" variant="outline" onClick={addPhrase}>
          <Plus className="size-4" />
          Dodaj hasło
        </Button>
        <p className={cn("text-sm", guaranteedCount > maxCells ? "text-destructive" : "text-muted-foreground")}>
          Gwarantowane: {guaranteedCount} / {maxCells}
        </p>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-muted-foreground text-sm font-medium">Nagrody</legend>
        {rewards.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Brak nagród w katalogu. Możesz wygenerować planszę bez nagród.
          </p>
        ) : (
          <div className="space-y-3">
            {rewards.map((reward) => (
              <div
                key={reward.id}
                className="border-border bg-background flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-foreground font-medium">{reward.label}</p>
                  <p className="text-muted-foreground text-sm">{reward.description}</p>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={maxCells}
                  value={rewardCounts[reward.id] ?? 0}
                  onChange={(e) => {
                    const value = Number.parseInt(e.target.value, 10);
                    setRewardCounts((prev) => ({
                      ...prev,
                      [reward.id]: Number.isNaN(value) ? 0 : Math.max(0, Math.min(maxCells, value)),
                    }));
                  }}
                  className="w-20 text-center sm:shrink-0"
                  aria-label={`Liczba nagród: ${reward.label}`}
                />
              </div>
            ))}
          </div>
        )}
        <p className={cn("text-sm", rewardTotal > maxCells ? "text-destructive" : "text-muted-foreground")}>
          Nagrody: {rewardTotal} / {maxCells}
        </p>
      </fieldset>

      <ServerError message={effectiveError} />

      <Button type="submit" disabled={effectivePending || effectiveOverLimit} className="w-full">
        {effectivePending ? (
          <span className="flex items-center gap-2">
            <span className="border-primary-foreground/30 border-t-primary-foreground size-4 animate-spin rounded-full border-2" />
            Generowanie…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Sparkles className="size-4" />
            Generuj planszę
          </span>
        )}
      </Button>
    </form>
  );
}
