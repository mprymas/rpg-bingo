import { z } from "zod";
import { canonicalPlayerNick } from "@/lib/player-cookie";
import { SESSION_CODE_PATTERN } from "@/lib/services/session-code";

export const playJoinCodeSchema = z.string().trim().toUpperCase().regex(SESSION_CODE_PATTERN);

export const playJoinNickSchema = z
  .string()
  .trim()
  .refine((nick) => canonicalPlayerNick(nick) !== null, {
    message: "Nick musi mieć od 1 do 24 znaków.",
  });
