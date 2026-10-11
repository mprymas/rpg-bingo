import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Reward } from "@/types";

type RewardOption = Pick<Reward, "id" | "slug" | "label" | "description">;

export interface RewardRulesFieldsProps {
  rewards: RewardOption[];
  lineRewardIds: string[];
  thresholdRewardIds: string[];
  thresholdCount: number;
  maxCells: number;
  /** When true, show threshold count as invalid (kitchen-sink / client hint). */
  thresholdInvalid?: boolean;
  idPrefix?: string;
  onLineRewardToggle: (rewardId: string, checked: boolean) => void;
  onThresholdRewardToggle: (rewardId: string, checked: boolean) => void;
  onThresholdCountChange: (value: number) => void;
}

function CatalogChecklist({
  rewards,
  selectedIds,
  idPrefix,
  onToggle,
}: {
  rewards: RewardOption[];
  selectedIds: string[];
  idPrefix: string;
  onToggle: (rewardId: string, checked: boolean) => void;
}) {
  if (rewards.length === 0) {
    return <p className="text-muted-foreground text-sm">Brak nagród w katalogu.</p>;
  }

  const selected = new Set(selectedIds);
  return (
    <div className="space-y-2">
      {rewards.map((reward) => {
        const id = `${idPrefix}-${reward.id}`;
        return (
          <div key={reward.id} className="flex items-start gap-2">
            <Checkbox
              id={id}
              checked={selected.has(reward.id)}
              onCheckedChange={(checked) => {
                onToggle(reward.id, checked === true);
              }}
              className="mt-0.5"
            />
            <Label htmlFor={id} className="text-foreground cursor-pointer font-normal">
              <span className="font-medium">{reward.label}</span>
              <span className="text-muted-foreground block text-sm font-normal">{reward.description}</span>
            </Label>
          </div>
        );
      })}
    </div>
  );
}

export function RewardRulesFields({
  rewards,
  lineRewardIds,
  thresholdRewardIds,
  thresholdCount,
  maxCells,
  thresholdInvalid = false,
  idPrefix = "rules",
  onLineRewardToggle,
  onThresholdRewardToggle,
  onThresholdCountChange,
}: RewardRulesFieldsProps) {
  const thresholdCountId = `${idPrefix}-threshold-count`;

  return (
    <>
      <fieldset className="space-y-3">
        <legend className="text-muted-foreground text-sm font-medium">Nagroda za wiersz/kolumnę</legend>
        <p className="text-muted-foreground text-sm">
          Nic nie zaznaczono — brak nagrody za wiersz/kolumnę. Kilka zaznaczonych — losujemy spośród nich.
        </p>
        <CatalogChecklist
          rewards={rewards}
          selectedIds={lineRewardIds}
          idPrefix={`${idPrefix}-line`}
          onToggle={onLineRewardToggle}
        />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-muted-foreground text-sm font-medium">Nagroda za {thresholdCount} pól</legend>
        <p className="text-muted-foreground text-sm">
          Nic nie zaznaczono — brak nagrody progowej. Kilka zaznaczonych — losujemy spośród nich przy dołączeniu gracza.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={thresholdCountId} className="text-foreground cursor-pointer font-normal">
            Liczba pól (N)
          </Label>
          <Input
            id={thresholdCountId}
            type="number"
            min={1}
            max={maxCells}
            value={thresholdCount}
            onChange={(e) => {
              const value = Number.parseInt(e.target.value, 10);
              if (Number.isNaN(value)) {
                onThresholdCountChange(1);
                return;
              }
              onThresholdCountChange(Math.max(1, Math.min(maxCells, value)));
            }}
            aria-invalid={thresholdInvalid || undefined}
            className={cn("w-20 text-center", thresholdInvalid && "border-destructive ring-destructive/20 ring-2")}
          />
          <span className="text-muted-foreground text-sm">(1–{maxCells})</span>
        </div>
        {thresholdInvalid && (
          <p className="text-destructive text-sm" role="alert">
            Przy wybranych nagrodach progowych N musi być między 1 a {maxCells}.
          </p>
        )}
        <CatalogChecklist
          rewards={rewards}
          selectedIds={thresholdRewardIds}
          idPrefix={`${idPrefix}-threshold`}
          onToggle={onThresholdRewardToggle}
        />
      </fieldset>
    </>
  );
}
