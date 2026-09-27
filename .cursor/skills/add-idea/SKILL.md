---
name: add-idea
description: Save phrase or reward ideas into context/ideas for a future catalog expansion. Dedupes against the ideas list and supabase/seed.sql (exact and similar), then suggests a roadmap change when a type backlog exceeds 5. Use when the user runs /add-idea, wants to park a bingo phrase or reward idea, or mentions saving catalog ideas for later.
---

# /add-idea — Park a Phrase or Reward Idea

Append one idea to `context/ideas/phrases.md` or `context/ideas/rewards.md`. Ideas are a staging backlog — not applied to the DB until a later change promotes them into `supabase/seed.sql`.

## Initial Response

1. **If type + content were provided inline**, parse them (see Argument Parsing) and proceed to Dedup.
2. **If only a type was provided** (`phrase` / `reward`), ask for the missing fields for that type, then proceed.
3. **If nothing was provided**, respond with:

```
I'll park an idea under context/ideas/.

Tell me the type and the content:

  /add-idea phrase <phrase text>
  /add-idea reward <slug> <Label> — <description>

Or reply with:
  1. type — phrase or reward
  2. content — phrase text, or for rewards: slug, label, and description
```

Then **wait**.

## Argument Parsing

Split the raw argument on the first run of whitespace:

| First token | Rest | Meaning |
|-------------|------|---------|
| `phrase` / `phrases` / `p` | phrase text (required) | Phrase idea |
| `reward` / `rewards` / `r` | reward fields (see below) | Reward idea |
| anything else / empty | treat as missing type | Fall through to interactive prompt |

**Reward rest** — accept either:

- `slug Label — description` (em dash or hyphen surrounded by spaces)
- `slug | Label | description`
- Or freeform; if slug/label/description cannot be separated confidently, ask for the three fields.

Derive `slug` if the user gives only a label: lowercase, ASCII-fold Polish diacritics when obvious (`ł`→`l`, `ó`→`o`, …), spaces → hyphens, strip other punctuation. Echo the derived slug and confirm before saving.

**Phrase text** — use the rest verbatim (trim ends only). Do not “improve” wording.

## File layout

| Type | Path | Entry shape |
|------|------|-------------|
| phrase | `context/ideas/phrases.md` | `- <phrase text>` |
| reward | `context/ideas/rewards.md` | `- **<slug>**: <Label> — <description>` |

### Self-bootstrap

If the target file is missing, create `context/ideas/` as needed and write the canonical header below, then append the entry. If the file exists, leave the header alone and append at the end.

**phrases.md header:**

```markdown
# Phrase ideas

> Staging backlog for bingo phrases. Promote into `supabase/seed.sql` via a roadmap change when ready.

```

**rewards.md header:**

```markdown
# Reward ideas

> Staging backlog for rewards. Promote into `supabase/seed.sql` via a roadmap change when ready.

```

## Dedup

Before writing, load:

1. The target ideas file (if it exists)
2. `supabase/seed.sql` — phrases from `INSERT INTO public.phrases` string literals; rewards from `INSERT INTO public.rewards` (`slug`, `label`, `description`)

### Normalize for comparison

- Trim, collapse internal whitespace, case-fold
- For rewards, compare slug, label, and description separately
- Strip surrounding quotes from seed literals

### Match tiers

1. **Exact** — normalized equality against an ideas bullet or a seed row (phrase text; for rewards any of slug / label / description exact).
2. **Similar** — likely the same idea, including:
   - one string contains the other (length ≥ 8 on the shorter side)
   - high token overlap (≥ ~70% of tokens shared)
   - near-paraphrase / same intent in Polish (e.g. “Upoluj zwierzę” vs “Upoluj dzikie zwierzę”)
   - reward slug differs only by hyphenation/plural, or labels clearly alias each other

If **any** exact or similar hit exists:

1. List each hit with source (`ideas` vs `seed.sql`) and tier (`exact` / `similar`).
2. Ask and **wait** — do not write yet:

```
This looks like it may already exist:

  - [exact] ideas: …
  - [similar] seed.sql: …

Add it anyway, revise the wording, or cancel?
```

3. On **add anyway** → continue to Write. On **revise** → take new wording and re-run Dedup. On **cancel** → stop with no file changes.

No hits → Write immediately.

## Write

1. Append a single bullet in the canonical entry shape (one blank line before the bullet only if the file does not already end with a newline-separated list — keep the file tidy, no duplicate blank runs).
2. Re-read the file and confirm the new bullet is present at the end.
3. Count **idea bullets** in that file (lines matching `^- `). Do **not** count seed.sql rows toward this threshold.
4. Report:

```
Saved to context/ideas/<file>:
  <entry>
  (<n> ideas of this type staged)
```

## Backlog threshold (> 5)

If **after** the append the bullet count for that type is **greater than 5**:

1. Draft a kebab-case **change-id** and a one-line **roadmap slice** outcome in Polish (match `context/foundation/roadmap.md` tone), e.g.:

| Type | change-id pattern | Slice wording sketch |
|------|-------------------|----------------------|
| phrase | `expand-phrase-catalog` or `add-phrase-batch-YYYY-MM` | zasilenie puli haseł kolejną partią ze stagingu `context/ideas/phrases.md` |
| reward | `expand-reward-catalog` or `add-reward-batch-YYYY-MM` | rozszerzenie katalogu nagród o pozycje ze stagingu `context/ideas/rewards.md` |

Prefer a stable id (`expand-phrase-catalog`) if no open change with that id exists under `context/changes/` or `context/archive/`; otherwise use a dated batch id.

2. Suggest next steps (do **not** run them unless the user asks):

```
You now have <n> staged <phrases|rewards> (> 5). Consider promoting them:

  change-id: <id>
  slice: <one-line outcome>

  /10x-new <id> <slice>
  /10x-roadmap   # register the slice when you open/adjust the milestone
```

3. Stop. Do not create the change folder or edit the roadmap from this skill.

If count ≤ 5, stop after the save report — no roadmap suggestion.

## Rules

- **One idea per invocation.** Multiple ideas → multiple `/add-idea` calls.
- **Append-only.** Never edit or delete existing ideas through this skill.
- **Do not modify `supabase/seed.sql`.** This skill only stages ideas.
- **Do not invent catalog copy.** Use the user’s wording; only derive reward `slug` when missing, and confirm it.
- **Wait on duplicates.** Exact or similar → user decision before any write.
