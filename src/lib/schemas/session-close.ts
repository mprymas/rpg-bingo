import { z } from "zod";

export const sessionCloseBodySchema = z.object({
  replacedBySessionId: z.uuid({ error: "Nieprawidłowy identyfikator sesji" }),
});

export type SessionCloseBody = z.infer<typeof sessionCloseBodySchema>;
