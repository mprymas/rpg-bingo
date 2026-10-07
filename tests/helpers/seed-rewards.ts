/**
 * Resolve catalog reward ids by slug from the signed-in create-session page.
 * Create API accepts UUID `rewardId` only; slugs are the stable test handle.
 * Parses Astro island props on GET /sessions/new (no rewards REST API, no Supabase in tests).
 */

import type { HttpClient } from "./http";

interface CatalogReward {
  id: string;
  slug: string;
  label?: string;
  description?: string;
}

/** Astro serializes island props as [typeTag, value] tuples (0 = plain). */
function reviveAstroValue(raw: unknown): unknown {
  if (!Array.isArray(raw) || raw.length !== 2 || typeof raw[0] !== "number") {
    if (Array.isArray(raw)) return raw.map(reviveAstroValue);
    if (raw && typeof raw === "object") {
      return Object.fromEntries(
        Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, reviveAstroValue(v)]),
      );
    }
    return raw;
  }
  const [type, value] = raw as [number, unknown];
  if (type === 0) {
    if (value && typeof value === "object") return reviveAstroValue(value);
    return value;
  }
  if (type === 1 && Array.isArray(value)) return value.map(reviveAstroValue);
  return value;
}

function decodeHtmlEntities(escaped: string): string {
  return escaped
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractIslandPropsJson(html: string): string {
  const match = /<astro-island\b[^>]*\bprops="([^"]+)"/i.exec(html);
  if (!match?.[1]) {
    throw new Error("Could not find astro-island props on /sessions/new (catalog unavailable?)");
  }
  return decodeHtmlEntities(match[1]);
}

function catalogFromIslandProps(propsJson: string): CatalogReward[] {
  const revived = reviveAstroValue(JSON.parse(propsJson)) as { rewards?: unknown };
  if (!Array.isArray(revived.rewards)) {
    throw new Error("astro-island props on /sessions/new missing rewards array");
  }
  const catalog: CatalogReward[] = [];
  for (const row of revived.rewards) {
    if (!row || typeof row !== "object") continue;
    const { id, slug } = row as Record<string, unknown>;
    if (typeof id === "string" && typeof slug === "string") {
      catalog.push({ id, slug });
    }
  }
  return catalog;
}

/**
 * Look up a live catalog reward UUID by slug via signed-in GET /sessions/new.
 * Throws if the slug is missing (no silent skip for Risk #4).
 */
export async function rewardIdForSlug(client: HttpClient, slug: string): Promise<string> {
  const page = await client.request("/sessions/new");
  if (page.status !== 200) {
    throw new Error(`rewardIdForSlug: GET /sessions/new expected 200, got ${page.status}`);
  }
  if (typeof page.body !== "string") {
    throw new Error("rewardIdForSlug: /sessions/new body was not HTML text");
  }
  const catalog = catalogFromIslandProps(extractIslandPropsJson(page.body));
  const match = catalog.find((r) => r.slug === slug);
  if (!match) {
    throw new Error(`Unknown catalog reward slug: ${slug}`);
  }
  return match.id;
}
