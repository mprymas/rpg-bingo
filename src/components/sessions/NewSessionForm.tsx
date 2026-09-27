import React, { useState } from "react";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServerError } from "@/components/auth/ServerError";
import { useCreateSession } from "@/components/hooks/useCreateSession";
import { cn } from "@/lib/utils";
import { BOARD_SIZES, type BoardSize, type Reward } from "@/types";

type RewardOption = Pick<Reward, "id" | "slug" | "label" | "description">;

interface CustomPhraseRow {
  text: string;
  guaranteed: boolean;
}

interface Props {
  rewards: RewardOption[];
}

const inputClass =
  "w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400";

function defaultRewardCounts(rewards: RewardOption[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const reward of rewards) {
    counts[reward.id] = reward.slug === "inspiration" ? 3 : 0;
  }
  return counts;
}

export default function NewSessionForm({ rewards }: Props) {
  const [size, setSize] = useState<BoardSize>(5);
  const [customPhrases, setCustomPhrases] = useState<CustomPhraseRow[]>([{ text: "", guaranteed: false }]);
  const [rewardCounts, setRewardCounts] = useState<Record<string, number>>(() => defaultRewardCounts(rewards));
  const { pending, error, createSession } = useCreateSession();

  const maxCells = size * size;
  const guaranteedCount = customPhrases.filter((row) => row.text.trim() && row.guaranteed).length;
  const rewardTotal = Object.values(rewardCounts).reduce((sum, count) => sum + count, 0);
  const overLimit = guaranteedCount > maxCells || rewardTotal > maxCells;

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
    if (pending || overLimit) return;

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
        <legend className="text-sm font-medium text-blue-100/80">Rozmiar planszy</legend>
        <div className="flex flex-wrap gap-2">
          {BOARD_SIZES.map((option) => (
            <label
              key={option}
              className={cn(
                "cursor-pointer rounded-lg border px-4 py-2 text-sm transition-colors",
                size === option
                  ? "border-purple-400/60 bg-purple-600/40 text-white"
                  : "border-white/20 bg-white/5 text-blue-100/80 hover:bg-white/10",
              )}
            >
              <input
                type="radio"
                name="size"
                value={option}
                checked={size === option}
                onChange={() => {
                  setSize(option);
                }}
                className="sr-only"
              />
              {option}×{option}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-blue-100/80">Własne hasła</legend>
        <div className="space-y-3">
          {customPhrases.map((row, index) => (
            <div
              key={index}
              className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-center"
            >
              <input
                type="text"
                value={row.text}
                onChange={(e) => {
                  updatePhrase(index, { text: e.target.value });
                }}
                placeholder="Wpisz hasło…"
                maxLength={120}
                className={cn(inputClass, "sm:flex-1")}
              />
              <label className="flex shrink-0 items-center gap-2 text-sm text-blue-100/80">
                <input
                  type="checkbox"
                  checked={row.guaranteed}
                  onChange={(e) => {
                    updatePhrase(index, { guaranteed: e.target.checked });
                  }}
                  className="size-4 rounded border-white/20 bg-white/10 text-purple-500 focus:ring-purple-400"
                />
                Gwarantowane na planszy
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  removePhrase(index);
                }}
                aria-label="Usuń hasło"
                className="shrink-0 text-blue-100/60 hover:bg-white/10 hover:text-white"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={addPhrase}
          className="border-white/20 bg-white/5 text-white hover:bg-white/10"
        >
          <Plus className="size-4" />
          Dodaj hasło
        </Button>
        <p className={cn("text-sm", guaranteedCount > maxCells ? "text-red-300" : "text-blue-100/60")}>
          Gwarantowane: {guaranteedCount} / {maxCells}
        </p>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-blue-100/80">Nagrody</legend>
        <div className="space-y-3">
          {rewards.map((reward) => (
            <div
              key={reward.id}
              className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">{reward.label}</p>
                <p className="text-sm text-blue-100/60">{reward.description}</p>
              </div>
              <input
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
                className={cn(inputClass, "w-20 text-center sm:shrink-0")}
                aria-label={`Liczba nagród: ${reward.label}`}
              />
            </div>
          ))}
        </div>
        <p className={cn("text-sm", rewardTotal > maxCells ? "text-red-300" : "text-blue-100/60")}>
          Nagrody: {rewardTotal} / {maxCells}
        </p>
      </fieldset>

      <ServerError message={error} />

      <Button
        type="submit"
        disabled={pending || overLimit}
        className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white transition-colors hover:bg-purple-500"
      >
        {pending ? (
          <span className="flex items-center gap-2">
            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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
