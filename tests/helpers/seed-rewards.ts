/**
 * Fixed catalog reward ids mirroring supabase/seed.sql.
 * Use slug as the primary handle in create bodies; never hardcode UUIDs at call sites.
 */

const SEED_REWARD_IDS = {
  inspiration: "ae52e490-555f-4f60-8313-1e26cc9ee71a",
  item: "5dc80d76-2947-4f78-84a0-f0cbc1c7bddf",
  "side-quest": "cc7aa51f-cfdd-4454-89c5-30dcc9759a2f",
  clue: "44185abe-9d08-4b3a-bd85-3beba1dfaf25",
  "npc-help": "848e72a5-b072-40b1-9113-28cf0f9c3243",
  experience: "cc7e81db-165e-4de0-ada8-7839a84d0a19",
} as const;

export type SeedRewardSlug = keyof typeof SEED_REWARD_IDS;

export function rewardIdForSlug(slug: string): string {
  const id = SEED_REWARD_IDS[slug as SeedRewardSlug];
  if (!id) {
    throw new Error(`Unknown seed reward slug: ${slug}`);
  }
  return id;
}
