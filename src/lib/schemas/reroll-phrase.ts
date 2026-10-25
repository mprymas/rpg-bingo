import { z } from "zod";

const positionSchema = z
  .number({ error: "Nieprawidłowa pozycja" })
  .int({ error: "Nieprawidłowa pozycja" })
  .min(0, { error: "Nieprawidłowa pozycja" })
  .max(24, { error: "Nieprawidłowa pozycja" });

const phraseSchema = z
  .string({ error: "Hasło jest wymagane" })
  .trim()
  .min(1, { error: "Hasło jest wymagane" })
  .max(120, { error: "Hasło może mieć maksymalnie 120 znaków" });

const overrideSchema = z.object({
  position: positionSchema,
  phrase: phraseSchema,
});

export const rerollPhraseBodySchema = z.object({
  position: positionSchema,
  overrides: z
    .array(overrideSchema)
    .refine((overrides) => new Set(overrides.map((item) => item.position)).size === overrides.length, {
      message: "Pozycje muszą być unikalne",
    }),
});

export type RerollPhraseBody = z.infer<typeof rerollPhraseBodySchema>;
