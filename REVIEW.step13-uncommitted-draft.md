# Antara — Step 13 Review

**Status: ALL COMPLETED — monthly budget is now editable (onboarding + always-on edit affordance), transaction delete and edit both shipped and live-tested against real production Firestore (catching and fixing a real `updateDoc` bug along the way), the 18-category taxonomy was confirmed already consistent everywhere a user picks a category, and the full Step 1–12 gap audit is below as its own section.**

---

## 1. Editable monthly budget

**The brief's premise didn't match the code** — I grepped for a literal hardcoded `2000` before touching anything and found none tied to the monthly budget (only unrelated per-category survey benchmarks in `constants.ts`/`engine.py`, e.g. `dates-outings` and `clothes-shoes` both happen to have a `monthly_cap`/`median_spend_inr` of exactly 2000, which is a coincidence, not the bug described). The real fallback in code was `profile?.monthly_budget || 5000` in three places ([page.tsx](frontend/src/app/page.tsx), [graph/page.tsx](frontend/src/app/graph/page.tsx), and `WhyPredictionSheet`'s caller). The actual bug was real, though: `monthly_budget` was a per-profile Firestore field with a sensible default (5000 for real accounts, 4500 demo, 3500 guest, 10000 superadmin-demo) — but **nothing anywhere let a user ever change it**. Flagging this mismatch rather than silently building against the brief's stated number, per this engagement's standing practice.

Built:
- **Onboarding**: [BudgetSheet.tsx](frontend/src/components/BudgetSheet.tsx) in `mode="onboarding"`, wired into [AppBootGate.tsx](frontend/src/components/AppBootGate.tsx) right after `pendingConsent` (Step 12's ConsentGate) and before the first Today render, exactly as specified. A brand-new real profile now starts with `monthly_budget: 0` — an explicit "not set yet" sentinel (see [AuthContext.tsx](frontend/src/lib/AuthContext.tsx)'s `needsBudgetSetup`) — rather than a silently-fine default, so the gate can't be skipped by accident. Superadmin is exempted (their own dev account, not someone who needs onboarding).
- **Always-editable afterward**: an "Edit" affordance directly under the BurnGauge on the Today screen (`Budget ₹X/mo · Edit`), opening the same `BudgetSheet` in `mode="edit"`, pre-filled, dismissible. Works for real accounts (Firestore write via new `saveMonthlyBudget()` in [api.ts](frontend/src/lib/api.ts)) **and** Demo/Guest mode (local profile state only, no Firestore) — both paths tested live.
- Every real read of `monthly_budget` (`page.tsx`, `graph/page.tsx`) already went through `profile?.monthly_budget`, so once the field is genuinely user-set, nothing else needed changing there; the `|| 5000` fallback stays as a defensive no-op for the (now unreachable, for a fully onboarded real user) missing-field case.

**Live-tested, not just built:**
- Real account (superadmin's own live Firestore profile): opened Edit, changed ₹5,000 → ₹604 → ₹2,000, watched burn rate/LEFT/PER DAY/run-out date recompute correctly at each step in the real running app, confirmed the final value in Firestore directly.
- Demo/Guest mode: same Edit control, same sheet, confirmed it updates local state and burn metrics with no Firestore call (and no crash from the lack of one).

---

## 2. Delete (and edit) transactions

Built as the priority item. Interaction: tap an entry (in `CategoryDetailSheet`, reachable from both Today's "What's pushing the date" rows and Pull's category tile) → [TransactionEditSheet.tsx](frontend/src/components/TransactionEditSheet.tsx) opens, pre-filled. This app has no swipe gestures anywhere else — every other interaction is tap-into-a-bottom-sheet — so a detail-sheet-with-buttons, not a bolted-on swipe, is what "consistent with the app's existing gesture language" meant here.

- **Delete**: two-tap confirm (first tap arms a red "Tap again to confirm — can't be undone" state, auto-disarms after 4s) rather than a native `window.confirm()`, matching this app's established pattern (Step 12's ConsentGate) of custom UI over browser dialogs for anything user-facing.
- **Edit** (bonus, built since it's the same surface): amount (same numeric keypad as QuickLogSheet), category (same chip row, all 18), and note, with a real dirty-check — "Save changes" stays disabled until something actually changed.
- New `deleteLiveTransaction()` / `updateLiveTransaction()` in [api.ts](frontend/src/lib/api.ts). No Firestore rules change needed — the existing transactions-subcollection `write` rule (Step 12: `isSuperAdmin() || (isOwner(userId) && (isBetaAllowlisted() || isPublicSignupEnabled()))`) already covers create/update/delete as one verb.

**Streak behavior — decided and stated, per the brief's explicit ask**: deleting or editing a transaction **does not touch streak fields** (`currentStreak`/`longestStreak`/`lastLoggedDate`/`streakFreezesAvailable`). The streak records "you logged something that calendar day," which already happened and isn't retroactively undone by later deleting the specific entry that triggered it — recomputing streak state from the full transaction history on every delete would also mean a months-old cleanup edit could silently break a *current* streak the user has no reason to think is at risk. Burn rate and "Why this pace?" needed no special handling: both are recomputed from the live `transactions` array on every render, so a delete/edit is reflected automatically the moment the array updates (onSnapshot for real accounts, local state for demo).

**Live-tested against real production Firestore, and this caught a real bug:**
- Delete: removed a stray ₹10 test transaction from the superadmin's real account, confirmed via direct Firestore read that the doc was actually gone (not just hidden in the UI), confirmed the category total, burn rate, and "left of cap" all recomputed correctly.
- Edit: changed a ₹500 entry's category and added a note, confirmed it moved between category buckets live with correct recomputed totals on both sides.
- **Found and fixed a real bug while testing "clear the note" specifically**: `updateDoc()` throws on an `undefined` field value (confirmed via a `window.onerror`/`unhandledrejection` listener injected into the live page — `FirebaseError: Function updateDoc() called with invalid data. Unsupported field value: undefined`). The original code sent `note: note.trim() || undefined` to clear a note; fixed to send `""` instead (every reader of `.note` already treats a falsy value as "no note"). Rebuilt, redeployed, retested the same clear-note case live — confirmed fixed, then restored the test entry to its original state.

---

## 3. Category taxonomy — verified, not just assumed

**Already matched everywhere — nothing needed fixing.** Diffed the category id sets directly: frontend `STARTER_CATEGORIES` ([constants.ts](frontend/src/lib/constants.ts)) and backend `CATEGORIES_METADATA` ([engine.py](backend/app/ml/engine.py)) both have exactly the same 18 ids (17 survey-matched categories + `miscellaneous`, the one intentional catch-all not in the survey, documented as such in `constants.ts`'s own header comment). Confirmed this 18-category list is what actually renders in every category-picking surface:
- **Quick-log keypad** ([QuickLogSheet.tsx](frontend/src/components/QuickLogSheet.tsx)) — all 18 chips, confirmed live.
- **Category detail sheet** and the new **transaction edit sheet** — same chip set, confirmed live (screenshot shows all 18 from "Food" through "Coaching").
- **Pull's category dot-graph** ([PullCanvas.tsx](frontend/src/components/PullCanvas.tsx)) and **`WhyPredictionSheet`** — both import `STARTER_CATEGORIES` directly, no separate list.
- **Admin panel**: there is no dedicated "category management" screen — [DataConfigPanel.tsx](frontend/src/components/DataConfigPanel.tsx) is the closest thing (per-category ML trust *weights*, not category CRUD) and also imports `STARTER_CATEGORIES` directly. No prior brief promised a category-CRUD admin screen, so this isn't a gap, just noting what exists.

No older/shorter subset was found anywhere. Single source of truth on each side of the frontend/backend boundary, kept in sync by id.

---

## 4. Feature gap audit (Steps 1–12)

**Methodology note**: I have this session's own record of Steps 11 and 12 in full. For Steps 1–10 I don't have the original briefs' literal text archived anywhere in the repo (there is no `STEPS.md` or similar — see the "no roadmap document" note below) — this audit reconstructs what was planned vs. shipped from commit `86c8ef5`'s own detailed per-step breakdown (written honestly at the time, bundling Steps 6–11 into one commit), plus direct code inspection and live testing this pass. Where I say "confirmed live," that's this session's own verification, not a repeat of someone else's claim.

### The streak/retention mechanic (Step 8) — explicitly asked about

**Built, live, and working.** Not a partial or abandoned feature:
- `computeStreakUpdate()` / `saveStreakUpdate()` / `streakToastMessage()` in [api.ts](frontend/src/lib/api.ts) — day-boundary logic, freeze-consumption, milestone detection (7/30/100 days), all pure and independently reasoned-about.
- Wired into **both** Today's and Pull's `handleCommit` (a real log from either screen counts).
- `StreakBadge.tsx` renders in the header for real accounts, hidden until there's an actual streak (no discouraging "0").
- Verified live this pass, incidentally, through my own test transactions: the superadmin's real Firestore profile currently shows `currentStreak: 1, longestStreak: 1, lastLoggedDate: "Fri Aug 21 2026"` — a real value produced by the real code path, not a mock.

### Still-open items from earlier steps

| # | Item | From | Status |
|---|---|---|---|
| 1 | **Survey app lives on an unmerged branch.** `origin/claude/antara-spending-survey-6o4o2w` (built on top of this same repo, not a separate project) has never been merged to `main` — 77 files diverged, both additions and deletions, meaning `main`'s own `lib/api.ts`/`constants.ts` have since drifted further from it too. | Flagged in Step 11's own review as a "deserves its own flag" finding | **Still open** — confirmed via `git branch -a` and `git diff main origin/claude/...` this pass. Not touched this session (out of scope for Step 13, and a merge this size needs its own dedicated pass, not a blind attempt here). |
| 2 | **All survey-derived benchmarks and category caps rest on `n=3` survey responses.** Every `monthly_cap` in `constants.ts` and every `benchmark_pct`/`median_spend_inr` in `engine.py` is commented `// survey median, n=3` or `# n=3`. This was an acknowledged, self-aware limitation at the time each of those was computed, not a bug — but it's never been revisited as more responses come in. | Present since Step 8–10 | **Still open.** No caps/benchmarks have been recomputed against a larger sample since. |
| 3 | **Backend test `test_ml_cold_start_heuristic_mode` is stale and currently fails.** It asserts `len(res.category_breakdown) == 12` (the taxonomy had 12 categories before Step 9's 18-category realignment) and feeds in a transaction with `category="food-delivery"` — an id that was merged into `food-snacks` during that same realignment and no longer exists in `CATEGORIES_METADATA`. Ran the backend suite this pass: `1 failed, 2 passed`. | Broke silently at Step 9, never re-run/updated since | **Newly surfaced this pass** — not fixed (outside Steps 1–3's scope), but it's a two-line fix if it becomes the next brief: update the expected count to 18 (or better, assert against `len(CATEGORIES_METADATA)` so it can't drift again) and use a real category id. |
| 4 | **`frontend/src/tests/firestore-rules.test.ts` exists but cannot currently run.** `@firebase/rules-unit-testing` is a devDependency and the test file itself looks complete, but there's no `jest` package installed, no `"test"` script in `package.json`, and no Firestore emulator running. It was written (likely alongside an early rules pass) and then never wired into anything executable. | Present since early steps, never mentioned as broken in any review since | **Newly surfaced this pass.** This session's own rules verification (Step 12's toggle test, and implicitly this pass's delete/edit tests) has been done by hitting real production Firestore directly instead — which works, but isn't a substitute for a fast, repeatable local rules test suite. |
| 5 | **No single roadmap/step-brief archive exists in the repo.** Each step's brief lives only in that session's chat history; the repo has no `STEPS.md`, changelog, or equivalent. This audit had to be reconstructed from commit messages and code comments rather than re-reading source briefs. Not a code bug, but worth naming as the reason item Steps 1–5 specifically get thinner coverage above than Steps 8–12. | — | **Observation, not a defect** — flagging per the brief's instruction to be honest about what's actually re-verifiable. |

Nothing else turned up an explicit "TODO", "FIXME", "deferred", "open question", "coming soon", or "not implemented" marker anywhere in `frontend/src`, `backend/app`, or `firestore.rules` (checked via broad case-insensitive grep across all three). Steps 6, 7, 9, 10, and 12's other deliverables (redesign, Tailscale/domain access, survey ETL + admin data-config, public-signup toggle, legal pages) all still render/respond correctly per this pass's own smoke checks (build passed, `/`, `/graph`, `/admin`, `/privacy`, `/terms` all 200, services active) — no additional silent regressions found beyond items 3–4 above.

**Per the brief: items 1–3 above are built regardless of this audit. Everything in the table is listed for the next brief to prioritize, not built blind this pass.**

---

## Verification performed

- Fresh `npm run build` — clean, twice (once before, once after the `updateDoc` bug fix) — no type errors.
- Live browser testing against real production Firestore (superadmin's actual account) for both budget-edit and delete/edit-transaction flows, with before/after Firestore reads via the Admin SDK to confirm writes actually landed (not just UI-appeared-to-work).
- Live browser testing of budget-edit in Demo/Guest mode (no Firestore user) to confirm the no-`user` code path works.
- Caught a real bug via an injected `unhandledrejection`/`error` listener in the live page, not just by reading code — the `updateDoc`/`undefined` issue would not have been visible from a code read alone (JS doesn't type-check this at compile time).
- Test-data cleanup: the synthetic ₹10 entry was deleted for real; the ₹500 test-edit entry and the budget value were both restored to their pre-testing state (category, note, and ₹2,000 budget) — confirmed via a final Firestore read.
- Category taxonomy: programmatic id-set diff between `constants.ts` and `engine.py` (18/18 match), plus live visual confirmation of all 18 chips in QuickLogSheet and TransactionEditSheet.
- `git status` shows exactly the expected changed/new files, nothing stray.
- Backend test suite run (`pytest`) as part of the gap audit — surfaced the stale test in item 3 above.
- Service health: `antara-frontend.service` and `antara-ml.service` both `active`; public domain routes all return 200.
