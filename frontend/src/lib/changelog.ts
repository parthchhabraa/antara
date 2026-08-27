// Versioned "what's new" changelog — a simple, hand-maintained data source
// (not derived from git history) so the highlights shown to users can be
// written in plain, teen-friendly language rather than commit messages.
//
// To ship a new entry: add it to the TOP of CHANGELOG (newest first) with a
// bumped `version`. CURRENT_APP_VERSION always tracks CHANGELOG[0].version,
// so nothing else needs updating — WhatsNewGate compares that against
// whatever version is stored in localStorage from the last time someone
// dismissed the sheet, and shows the newest entry automatically the next
// time the app opens after a bump.
export interface ChangelogAction {
  label: string;
  // Where "Set up" should take the user — a path this app already has a
  // route for, optionally with a query param a page checks on mount to
  // open a specific sheet (see page.tsx's `openSheet` handling for
  // "/?open=wallets"). Tapping this closes the What's New sheet first.
  href: string;
}

export interface ChangelogHighlight {
  text: string;
  // A real screenshot of the feature as it actually looks in the live
  // app — never placeholder art or a mockup. Path under /public, e.g.
  // "/changelog/1.5.0-wallets.png". Optional: most highlights are fine as
  // plain text, same as every entry before this one.
  image?: string;
  // Only for highlights that gate on the user actually entering real data
  // to be useful (a new wallet, an income source, …) — a pure UI/bugfix
  // highlight should never have one of these.
  action?: ChangelogAction;
}

export interface ChangelogEntry {
  version: string;
  date: string; // display-only, "August 2026" style — not parsed
  highlights: ChangelogHighlight[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.5.0",
    date: "August 2026",
    highlights: [
      {
        text: "Real wallets — track actual balances across Cash, UPI, a piggy bank, whatever you actually use — separate from your monthly budget plan.",
        image: "/changelog/1.5.0-wallets.png",
        action: { label: "Open Wallets", href: "/?open=wallets" },
      },
      {
        text: "Log real income (allowance, gifts, freelance work) and watch it land in the right wallet's balance immediately.",
      },
      {
        text: "\"Instances\" — pin a budget to the categories that matter for a month (exams, a trip) and Antara fills in the rest from your real spending, not a guess.",
      },
      {
        text: "A real confidence-over-time curve on the Pull screen — see your own actual path from \"early estimate\" to a personalized prediction, not a generic chart.",
      },
      {
        text: "\"Ask Antara\" — a real chat that can explain its own predictions (\"why did you say I'll run out on the 31st,\" \"how confident are you\") using the same real numbers the rest of the app computes, redesigned this update with suggested follow-ups and a cleaner, more conversational layout.",
      },
      {
        text: "Any category's spending cap is now reachable directly from the Pull screen's graph — not just whichever one it happened to spotlight.",
      },
    ],
  },
  {
    version: "1.4.0",
    date: "August 2026",
    highlights: [
      { text: "Notes on any log now double as the headline — type \"McDonald's with Aryan\" and that's what shows in your history, not a generic tag." },
      { text: "As you type a note, Antara quietly suggests the right category if it's confident — never forced, easy to ignore." },
      { text: "Tap any day on the week strip to see exactly what you spent that day, not just the month so far." },
      { text: "Set your own spending cap on any category — not just the ones with survey data behind them." },
      { text: "Cleaner header — data source, admin, and sign-out now live behind one menu instead of three separate badges." },
      { text: "\"Still calibrating\" now shows up on the home screen too, not just in the detail sheets, while Antara is still learning your habits." },
    ],
  },
  {
    version: "1.3.0",
    date: "August 2026",
    highlights: [
      { text: "Antara can now explain *why* it's predicting what it's predicting — tap \"Why?\" under your run-out date for a real, model-generated breakdown." },
      { text: "New /review screen — a quick survey to tell us what's working and what isn't, right inside the app." },
      { text: "\"Dating & going out\" renamed to \"Going out\" everywhere in the app." },
      { text: "Free-text notes can now be attached to a logged expense and show up later in its history." },
    ],
  },
];

export const CURRENT_APP_VERSION = CHANGELOG[0].version;
