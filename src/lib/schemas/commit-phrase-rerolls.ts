import { z } from "zod";

const phraseChangeSchema = z.object({
  position: z
    .number({ error: "Nieprawidłowa pozycja" })
    .int({ error: "Nieprawidłowa pozycja" })
    .min(0, { error: "Nieprawidłowa pozycja" })
    .max(24, { error: "Nieprawidłowa pozycja" }),
  phrase: z
    .string({ error: "Hasło jest wymagane" })
    .trim()
    .min(1, { error: "Hasło jest wymagane" })
    .max(120, { error: "Hasło może mieć maksymalnie 120 znaków" }),
});

export const commitPhraseRerollsBodySchema = z.object({
  changes: z
    .array(phraseChangeSchema)
    .min(1, { error: "Wybierz co najmniej jedno hasło" })
    .refine((changes) => new Set(changes.map((change) => change.position)).size === changes.length, {
      message: "Pozycje muszą być unikalne",
    }),
});

export type CommitPhraseRerollsBody = z.infer<typeof commitPhraseRerollsBodySchema>;
