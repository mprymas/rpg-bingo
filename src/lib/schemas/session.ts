import { z } from "zod";
import { BOARD_SIZES } from "@/types";

const customPhraseSchema = z.object({
  text: z.string().trim().min(1).max(120),
  guaranteed: z.boolean(),
});

const rewardCountSchema = z.object({
  rewardId: z.uuid({ error: "Nieprawidłowy identyfikator nagrody" }),
  count: z
    .int({ error: "Liczba nagród musi być liczbą całkowitą" })
    .min(0, { error: "Liczba nagród nie może być ujemna" })
    .max(25, { error: "Liczba nagród jednego typu — maksymalnie 25" }),
});

export const createSessionSchema = z
  .object({
    size: z.union([z.literal(BOARD_SIZES[0]), z.literal(BOARD_SIZES[1]), z.literal(BOARD_SIZES[2])], {
      error: "Nieprawidłowy rozmiar planszy",
    }),
    customPhrases: z.array(customPhraseSchema).max(50),
    rewards: z
      .array(rewardCountSchema)
      .refine((rewards) => new Set(rewards.map((r) => r.rewardId)).size === rewards.length, {
        message: "Identyfikatory nagród muszą być unikalne",
      }),
  })
  .superRefine((data, ctx) => {
    const maxCells = data.size * data.size;
    const guaranteedCount = data.customPhrases.filter((p) => p.guaranteed).length;
    if (guaranteedCount > maxCells) {
      ctx.addIssue({
        code: "custom",
        message: `Zbyt wiele haseł gwarantowanych — maksymalnie ${maxCells}`,
        path: ["customPhrases"],
      });
    }
    const rewardSum = data.rewards.reduce((sum, r) => sum + r.count, 0);
    if (rewardSum > maxCells) {
      ctx.addIssue({
        code: "custom",
        message: `Zbyt wiele nagród — maksymalnie ${maxCells}`,
        path: ["rewards"],
      });
    }
  });

export type CreateSessionSchemaInput = z.infer<typeof createSessionSchema>;
