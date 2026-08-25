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
export interface ChangelogEntry {
  version: string;
  date: string; // display-only, "August 2026" style — not parsed
  highlights: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.4.0",
    date: "August 2026",
    highlights: [
      "Notes on any log now double as the headline — type \"McDonald's with Aryan\" and that's what shows in your history, not a generic tag.",
      "As you type a note, Antara quietly suggests the right category if it's confident — never forced, easy to ignore.",
      "Tap any day on the week strip to see exactly what you spent that day, not just the month so far.",
      "Set your own spending cap on any category — not just the ones with survey data behind them.",
      "Cleaner header — data source, admin, and sign-out now live behind one menu instead of three separate badges.",
      "\"Still calibrating\" now shows up on the home screen too, not just in the detail sheets, while Antara is still learning your habits.",
    ],
  },
  {
    version: "1.3.0",
    date: "August 2026",
    highlights: [
      "Antara can now explain *why* it's predicting what it's predicting — tap \"Why?\" under your run-out date for a real, model-generated breakdown.",
      "New /review screen — a quick survey to tell us what's working and what isn't, right inside the app.",
      "\"Dating & going out\" renamed to \"Going out\" everywhere in the app.",
      "Free-text notes can now be attached to a logged expense and show up later in its history.",
    ],
  },
];

export const CURRENT_APP_VERSION = CHANGELOG[0].version;
