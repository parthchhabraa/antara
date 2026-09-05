// Brief 5 (2026-09-05): the one funnel instrumented so far — landed →
// signed in → consented → first transaction logged → returned on day 2 →
// still logging on day 7. "Landed" is Umami's own automatic pageview
// tracking (no code needed here); day-2/day-7 return is Umami's built-in
// Retention report, computed from the same anonymous per-browser visitor
// id Umami already assigns to every pageview — also no extra event
// needed. The three events below are the only custom instrumentation this
// funnel actually requires; see layout.tsx for why the script might not
// be present at all (local dev, or the env var unset).
//
// Never pass anything that could identify a real person (email, uid,
// display name, transaction amount/category) as event data — this is
// aggregate product-funnel telemetry, not a per-user behavioural log. If
// a future event genuinely needs a property, keep it to a category/tier
// label, never a raw value tied to one account.
export type FunnelEvent = "signed_in" | "consented" | "transaction_logged";

declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, unknown>) => void };
  }
}

export function trackEvent(event: FunnelEvent): void {
  try {
    window.umami?.track(event);
  } catch {
    // Analytics must never be able to break the app it's measuring —
    // an ad-blocker, a not-yet-loaded script, or Umami being down are all
    // silently swallowed here.
  }
}
