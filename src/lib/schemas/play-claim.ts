import { z } from "zod";
import { playJoinCodeSchema } from "@/lib/schemas/play-join";

export const playClaimBodySchema = z.object({
  code: playJoinCodeSchema,
  position: z
    .number({ error: "Nieprawidłowa pozycja" })
    .int({ error: "Nieprawidłowa pozycja" })
    .min(0, { error: "Nieprawidłowa pozycja" })
    .max(24, { error: "Nieprawidłowa pozycja" }),
});

export type PlayClaimBody = z.infer<typeof playClaimBodySchema>;
