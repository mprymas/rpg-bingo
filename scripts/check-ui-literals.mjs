// Fails if cleaned UI views reintroduce literal colours / palette classes / arbitrary px|rem.
// Zero deps. Scoped list grows as more views leave the cosmic one-offs behind.
// Pattern mirrors /.cursor/skills/10x-ui hardcoded-value scan (+ ban on bg-cosmic).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Views brought onto semantic tokens by ui-new-session-board (extend when another view is cleaned). */
const SCOPED_FILES = [
  "src/pages/sessions/new/index.astro",
  "src/pages/sessions/new/kitchen-sink.astro",
  "src/components/sessions/NewSessionForm.tsx",
  "src/components/auth/ServerError.tsx",
  "src/pages/dashboard/index.astro",
  "src/pages/dashboard/kitchen-sink.astro",
  "src/components/dashboard/DashboardActions.tsx",
  "src/components/dashboard/DashboardPanel.astro",
  "src/pages/sessions/[id].astro",
  "src/pages/sessions/board/kitchen-sink.astro",
  "src/components/sessions/BoardGrid.astro",
  "src/pages/play/[code].astro",
  "src/components/play/JoinNickForm.tsx",
  "src/pages/auth/signin/index.astro",
  "src/pages/auth/signin/kitchen-sink.astro",
  "src/components/auth/SignInForm.tsx",
  "src/components/auth/FormField.tsx",
  "src/components/auth/SubmitButton.tsx",
  "src/components/auth/PasswordToggle.tsx",
  "src/pages/auth/signup/index.astro",
  "src/pages/auth/signup/kitchen-sink.astro",
  "src/components/auth/SignUpForm.tsx",
  "src/pages/auth/confirm-email/index.astro",
  "src/pages/auth/confirm-email/kitchen-sink.astro",
];

const LITERAL_RE =
  /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(|-\[[0-9.]+(px|rem)\]|\b(bg|text|border|ring|outline|from|via|to|fill|stroke|shadow|divide)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)\b|\bbg-cosmic\b/g;

const root = resolve(import.meta.dirname, "..");
const hits = [];

for (const rel of SCOPED_FILES) {
  const abs = resolve(root, rel);
  let source;
  try {
    source = readFileSync(abs, "utf8");
  } catch (err) {
    console.error(`check-ui-literals: missing scoped file ${rel}`);
    console.error(err);
    process.exit(1);
  }

  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    LITERAL_RE.lastIndex = 0;
    const matches = line.match(LITERAL_RE);
    if (!matches) continue;
    for (const m of matches) {
      hits.push(`${rel}:${String(i + 1)}: ${m}`);
    }
  }
}

if (hits.length > 0) {
  console.error(
    "check-ui-literals: forbidden literals in tokenized views (use semantic tokens / src/components/ui):\n",
  );
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}

console.log(`check-ui-literals: ok (${String(SCOPED_FILES.length)} files)`);
