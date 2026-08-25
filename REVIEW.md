# Antara — Bug-fix pass: navbar, date selector, calibration notice, category rename

**Status: ALL COMPLETED — of the 4 named items, 2 didn't actually reproduce against the live app (verified, not assumed — see below for exactly what was checked and how), 1 was already partially addressed by the prior session and is now strengthened and verified, and 1 (the rename) is done everywhere it needed to be. A general bug pass found one genuinely dead code path, flagged rather than silently wired up. Nothing here needed a backend/Ollama change, so this is a frontend + one backend display-string commit.**

Per the brief's explicit instruction: every item below was checked against the real, live app (not assumed from the prior session's notes) before touching anything, using a real rendered browser (a locally-launched headless Chromium via `playwright-core`, same setup as the Phase 2 archetype-screen verification — the browser extension tool wasn't reachable in this environment either).

---

## 1. Superadmin/demo navbar theme mismatch — investigated, does not reproduce

**Confirmed the theme first, not assumed:** `frontend/tailwind.config.ts` — `background: #08090C`, `primary` is the violet family (`#8B5CF6` etc.). This is the real, current theme.

**Then actually looked at the screen(s) this could mean.** The brief's own hedge ("demo signor navbar" — likely "demo superadmin navbar") pointed at real ambiguity, so rather than guess, checked every place a superadmin/demo indicator renders: the shared header in `MobileFrame.tsx` (used on every screen), `SuperadminPanel.tsx` (`/admin`), and `/admin/training-insights`. Signing in as the real superadmin requires a real Firebase session — scripted one for real via a temporary, fully-reverted test hook in `AuthContext.tsx` (a custom-token sign-in gated behind a one-off query param, removed before committing; `git diff` confirms it's gone) rather than skip the visual check.

**Result: no mismatch found anywhere.** Screenshotted the Today header (DEMO/LIVE toggle, ADMIN badge, streak badge), the full `/admin` dashboard, and `/admin/training-insights` — all three consistently use the same violet/near-black/amber/emerald/cyan palette already established everywhere else in the app. No emerald/gold remnant, no old header, no visual drift. This looks like a prior-session note that either was already fixed by an earlier pass, or never accurately described the current app — either way, it doesn't reproduce now. Not "fixed" because there was nothing broken to fix.

## 2. Date selector not triggering a refresh — investigated, the described feature doesn't exist

Searched the entire frontend for any interactive date/day-selection state (`selectedDate`, `onDateSelect`, any day-strip with a tap handler) — found none. The only day-strip in the app is the 7-bar spending chart on the Today screen (`page.tsx`'s `weekBars`); read its full render code directly: it's a purely informational height-chart with **no `onClick` anywhere on it, no selection state, no filtering of category data by day**. Category totals shown elsewhere in the app are always month-aggregate, never per-day. Also checked `CategoryDetailSheet.tsx`, `graph/page.tsx`, and the admin/training-insights screens for any date-range picker — none exists there either.

There's nothing here to reproduce a "not triggering a refresh" bug against, because there's no tappable date selector wired to anything in the current codebase. Rather than build a new tap-to-filter-by-day feature speculatively (a materially different, larger scope than "fix the bug"), flagging this as not reproducible against the live app as described — if a real per-day drill-down is wanted, that's a feature brief, not a bug fix.

## 3. "Still calibrating" notice for low-confidence output — extended, not duplicated

The prior (Phase 2) session had already softened the cold-start language in `WhyPredictionSheet.tsx` — "Early estimate" → "Still learning" badge, and a "Still learning your habits · day X of 14" label. That's real, and it does already read as soft/human rather than clinical. But there wasn't a distinct, explicit **notice** beyond that terse label, and the equivalent state in the archetype screen (built this same continuation, `ArchetypeSheet.tsx`) had a badge but no accompanying sentence either.

Added one line, in both places the app currently renders a confidence/cold-start tier (confirmed via grep these are the only two — `/categorize`'s `needs_review` has no frontend consumer yet, so there's nothing to extend there without inventing new UI):

> *Still calibrating to your data — the more you log, the sharper this gets.*

Same wording, same soft amber tone, in `WhyPredictionSheet.tsx` (shown when `modeTone === "early"`) and `ArchetypeSheet.tsx` (shown when `is_cold_start`) — one small addition to each existing conditional, not a new logic path. **Verified rendered, not just written**: used Playwright's network interception to serve real-shaped cold-start responses to the actual, unmodified component code (no component patched for this check) and screenshotted both — the notice renders cleanly under each badge, correct color, reads naturally, no layout issues.

## 4. Category rename: "Dating" → "Going out" — done everywhere it's a real display string

Grepped case-insensitively for every occurrence of "Dating" across the repo before touching anything. Updated every place it was an actual human-facing label:
- `frontend/src/lib/constants.ts` — `STARTER_CATEGORIES`'s `name` ("Dating & going out" → "Going out") and `short` ("Dating" → "Going out"). **`id: "dates-outings"` deliberately untouched** — it's a kebab-case id, not a display string, and every transaction any real user has ever logged has `category: "dates-outings"` stored on it; renaming the id would silently orphan that data. This matches the brief's own instruction ("if they're IDs, just update the display label, don't break existing stored data").
- `backend/app/ml/engine.py` — `CATEGORIES_METADATA["dates-outings"]["name"]`, same rename. This also automatically updates the *Ollama categorize prompt* (Phase 2's `_CATEGORY_LIST_FOR_PROMPT` is built from this exact dict) — no separate change needed there, confirming "don't duplicate the logic" held up in practice.
- `frontend/src/lib/surveyConstants.ts` — the `/review` survey's own category label ("Dates & outings" → "Going out"). This is a pure display string (the survey only ever stores the `id` in `category_spend`, never the label), so this was safe to change with zero effect on already-collected survey data.
- `scripts/seed_categories.py` — the Firestore `categories` collection seed's `name` field. Checked first whether this collection is ever read at runtime (`grep`ed for `collection(db, "categories")` anywhere in the running app) — it isn't; nothing currently reads it. Updated anyway since the brief named it explicitly and it costs nothing.

**Left alone, correctly**: two occurrences of the string `dating-outings` (note: different from `dates-outings`) in `constants.ts`'s migration-history comment and `seed_categories.py`'s stale-category cleanup list — these refer to the *old, pre-Step-9* category id from a previous rename, not the current display name. Changing them would misrepresent the actual migration history.

**Verified**: fresh `pytest` (17/17) and `npx tsc --noEmit`/`npm run build` (clean, 11/11 pages) after the rename, and a real screenshot of the QuickLogSheet category-chip row showing "Going out" rendering correctly in place (fits the existing chip styling fine, no truncation — the row is a `whitespace-nowrap`, horizontally-scrollable strip, not a fixed width).

## 5. General bug pass

Swept console errors across all 7 routes (`/`, `/graph`, `/admin`, `/admin/training-insights`, `/review`, `/privacy`, `/terms`) with the real superadmin session from item 1's setup — **clean everywhere** except the expected CORS rejection from calling `api.antara.money` off an unlisted local test port (3099, only used for this session's own screenshots — not a real issue, `localhost:3000`/`3001` are the actual allowlisted dev ports).

**One real, previously-unnoticed thing found: `signInAsGuest()` and `signInWithDemoSuperadmin()` in `AuthContext.tsx` are dead code from the UI's perspective.** Both are fully implemented (they set a real demo profile, including a working demo-superadmin path with `role: 'superadmin'`) and exported from the auth context, but grepping the entire `src/app`/`src/components` tree for either function name outside `AuthContext.tsx` itself turns up **zero call sites** — no button anywhere invokes them. (`signInAsGuest` *is* called once internally, as a fallback when a non-allowlisted Google account tries to sign in — that path is real and works. `signInWithDemoSuperadmin` has no caller at all, internal or otherwise.) This incidentally explains why item 1 above was hard to check without scripting a real sign-in: the one built-in way to preview the superadmin UI without a real Google account is itself unreachable from any button.

**Not fixed — flagging instead.** Wiring `signInWithDemoSuperadmin` to a real, publicly-reachable button would let anyone previewing the app see the superadmin UI without real credentials — that's a product/security posture decision, not a "make dead code reachable" bug fix, and not mine to decide unilaterally. Worth a real answer from you: either remove it (dead code, per the standing practice of not leaving known-unused code sitting around — see Step 16), or wire it somewhere deliberately gated (e.g., a `?demo_admin=1` dev-only flag, not a real UI button).

---

## Commit

- Files changed: `backend/app/ml/engine.py`, `frontend/src/components/ArchetypeSheet.tsx`, `frontend/src/components/WhyPredictionSheet.tsx`, `frontend/src/lib/constants.ts`, `frontend/src/lib/surveyConstants.ts`, `scripts/seed_categories.py`.
- **`328ff2b`** — commit on `main`. This `REVIEW.md` update is one more on top, pushed together — see below for the exact final `origin/main` hash.

---

## Verification performed

- Read `tailwind.config.ts` directly before making any claim about the current theme.
- Read the actual render code for the Today week-bar strip and every other date-related component before concluding item 2 doesn't reproduce, rather than inferring from the bug's own description.
- Real Firebase sign-in as the actual superadmin (via a temporary, fully-reverted custom-token test hook — confirmed removed via `git diff` showing zero trace of it) to screenshot the header/admin screens for real, not skip the visual check because OAuth can't be scripted headlessly here.
- Playwright network interception (not component patching) to verify the new calibrating-notice renders correctly from the real, unmodified `WhyPredictionSheet`/`ArchetypeSheet` code.
- A real screenshot of the renamed category chip in `QuickLogSheet`.
- A console-error sweep across all 7 routes with a real authenticated session.
- `grep` for every call site of `signInAsGuest`/`signInWithDemoSuperadmin` before calling either one dead code.
- `pytest` (17/17) and `npx tsc --noEmit` + `npm run build` (clean, 11/11 pages) after every change, not just once at the end.
- Confirmed production (`antara-frontend.service`/`antara-ml.service`) untouched and healthy throughout — this session made no runtime-code changes that needed a live restart to verify (everything was checked against a temporary local dev server), and nothing here has been deployed live yet, consistent with the Phase 2 continuation entry above.
