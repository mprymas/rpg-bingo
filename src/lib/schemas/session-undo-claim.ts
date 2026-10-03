import { z } from "zod";

export const sessionUndoClaimBodySchema = z.object({
  position: z
    .number({ error: "Nieprawidłowa pozycja" })
    .int({ error: "Nieprawidłowa pozycja" })
    .min(0, { error: "Nieprawidłowa pozycja" }),
});

export type SessionUndoClaimBody = z.infer<typeof sessionUndoClaimBodySchema>;
