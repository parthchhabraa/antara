# Antara — session log

## Bug fix: no way to set a cap on any category except the spotlight's pick

**Status: COMPLETED — confirmed live before fixing, built, verified against real rendered screenshots and a real Firestore round-trip, deployed, re-verified live. Nothing failed; no rollback needed.**

**Confirmed real before fixing**: on the Pull page, `CategoryDetailSheet` (and its cap editor, built last session) was only reachable by tapping the spotlight card, which shows exactly one algorithm-picked category (`selectedId`, defaulting to whatever `PullCanvas`'s physics settled on first — in practice, Gaming). The NEED/WANT dots *did* already call `onSelect`, but that only updated which category the spotlight card pointed at — opening the actual detail/cap editor took a second tap on the card, and there was no way at all to jump straight to an arbitrary category like Food or Going out without first getting the right dot to register as `selected`. Confirmed by reading `graph/page.tsx` and `PullCanvas.tsx` directly before changing anything — there is genuinely no other route into `CategoryDetailSheet` from the Pull screen.

**Fixed** (additive — the spotlight card is untouched, this just stops it being the only door in):
- `PullCanvas`'s `onSelect` callback (wired from `graph/page.tsx`) now also opens `CategoryDetailSheet` directly — tapping **any** dot, not just the one the spotlight happens to be on, opens that exact category's detail/cap editor in one tap instead of two.
- A new "or pick a category directly" chip row, listing every real category by name/icon in a horizontal scroll, added below the graph — since the dots are tiny and physics-driven (especially "untouched" categories, drawn as faint outline rings), this is a reliable fallback that doesn't depend on precisely hitting a moving target. Same chip styling `TransactionEditSheet`/`QuickLogSheet` already use, no new pattern invented.
- Both paths open the exact same `CategoryDetailSheet` already built last session (real cap Set/Edit/Clear, real Firestore persistence) — nothing duplicated or partial.

**Verified live** (real superadmin account, real Firestore, via a temporary/fully-reverted custom-token test hook — same pattern as every prior pass):
- Opened 3 different categories via the new chip row — Going out, Grooming, Books — confirming each opened a real detail sheet with the real cap editor (`Set a cap`/`Edit` present), not a placeholder.
- Confirmed a single dot tap (no second tap on the spotlight card) opens the detail sheet directly — landed on Clothes & Shoes, a category that was never the spotlight default.
- Set a real ₹777 cap on **Going out** — a category with no previous path to being capped from Pull at all. Confirmed it rendered ("₹777 left of ₹777"), then **reloaded the page from scratch** and confirmed the cap was still there, proving real Firestore persistence, not local-only state.
- Test cap cleared from the real account after verification (`category_caps` confirmed empty again). Temp auth hook confirmed fully reverted via `grep` (zero matches) and a clean `git diff` on `AuthContext.tsx`.

**Deployed**: `git pull` (already current — same box), `npm run build` (clean, `tsc --noEmit` clean), restarted both services (`active` on first attempt), verified `app.antara.money`/`api.antara.money` both healthy post-restart.

---

# Antara — 6 fixes/features: note headline, palette fix, real spending caps, calibrating notice, assembly splash, what's new

**Status: ALL 6 COMPLETED — verified against real rendered screenshots (locally-launched headless Chromium, same setup as every prior pass) and, where relevant, against real logged/persisted data, not mocks. Deployed and re-verified against the live public domains. Nothing failed; no rollback needed.**

Context per the brief: two items from the last REVIEW.md ("date selector," "navbar theme") had already been investigated and found not to exist as described, then built for real last session. This session's 6 items are new — verified live before touching anything, per standing practice.

---

## 1. Transaction label now shows your own note, not a fixed merchant tag

**Confirmed real before fixing**: `QuickLogSheet.commit()` always writes `subcategory: category.subcategories[0]` (e.g. "Swiggy/Zomato" for Food) regardless of what's typed in the note field. The note itself *was* saving correctly (last session's fix) — the bug was purely a display-priority bug in two places: `CategoryDetailSheet.tsx` always rendered `e.subcategory || category.name` as the headline, never checking `e.note` at all; `page.tsx`'s day-view list already prioritized note in the *subtitle* but the *headline* there was the generic category name.

**Fixed**: both places now render `note || subcategory || category.name` as the headline, with the generic tag demoted to the subtitle (`{note && subcategory ? " · " + subcategory : ""}`) instead of disappearing — so a user who didn't type anything still sees the same generic label as before, and a user who did sees their own words up front.

**Verified live** (real superadmin account, not demo data): logged a real ₹222 entry with note "label bug check xyz789" through the actual `QuickLogSheet`, opened the category detail sheet, and confirmed "label bug check xyz789" rendered as the headline with "Aug 25 · Swiggy/Zomato" as the subtitle underneath — both the note-present and (via the account's existing real entries) note-absent branches visible in the same screenshot. Test transactions deleted from Firestore after verification — not left in production data.

---

## 2. Dot-graph panel — off-palette color fixed

**Confirmed real**: `graph/page.tsx`'s dot-graph panel background was a hardcoded `radial-gradient(...,#1b1e30,#121423)` — a blue-tinted pair that doesn't appear anywhere in `tailwind.config.ts`. Grepped the rest of `graph/page.tsx` for other hex/rgb literals — this was the only one; everything else already uses Tailwind utility classes.

**Fixed**: swapped for `radial-gradient(...,#2E1065,#08090C)` — `primary-950` (the config's own darkest violet step) fading into `background` (`#08090C`, also from the config). Reads as violet-tinted near-black like every other surface in the app now, not a separate undefined blue.

**Verified**: `getComputedStyle` on the live panel confirms the rendered `backgroundImage` no longer contains the old RGB values, and a real screenshot shows the panel now matching the rest of the app's palette.

---

## 3. Spending caps — real, per-category, per-user, settable on any category

**Confirmed real**: the cap shown was always `Category.monthly_cap` — a static number from `constants.ts`, identical for every user, with zero UI to set/change it. Only categories with survey data had a cap at all; everything else was permanently stuck on "No cap set yet."

**Built**:
- `UserProfile.category_caps?: Record<string, number>` (`types/index.ts`) — real per-category caps, stored on the user's own Firestore doc.
- `saveCategoryCap` / `clearCategoryCap` (`lib/api.ts`) — dot-notation `updateDoc` on `category_caps.{categoryId}`, so setting one category's cap never touches any other category's.
- `AuthContext.setCategoryCap(categoryId, amount | null)` — same "write to Firestore if real, always update local state" shape as the existing `setMonthlyBudget`, so it also works (locally) for demo/guest mode.
- `CategoryDetailSheet` gained an inline editor: "Set a cap" when none exists, "Edit"/"Clear" when one does, with the existing progress bar/copy now driven by `userCap ?? category.monthly_cap` (falls back to the survey baseline, labeled "(suggested)", only when the user hasn't set their own).
- Both `page.tsx` and `graph/page.tsx` (including the Pull screen's spotlight card, which previously read the static value directly) now pass the real per-user cap through.

**Verified live, with real Firestore persistence** (not local-only state): opened Gaming's detail sheet (no baseline, no cap — "No cap set yet"), set a real cap of ₹1,234, confirmed it displayed as "₹1,234 left of ₹1,234" (no "(suggested)" tag, confirming it's flagged as user-set). **Reloaded the page from scratch** and confirmed the cap was still there — proving it round-tripped through Firestore, not just React state. Test cap cleared from the real account after verification.

---

## 4. "Still calibrating" notice — now on the Today screen too

**Built**: `isColdStart(transactions)` (`lib/api.ts`) mirrors `backend/app/ml/engine.py`'s `_analyze_data_maturity` exactly — same 14-day / 5-transaction thresholds, same "unique days or date span, whichever is larger" logic — deliberately not a new condition. The Today screen's burn ring and "money runs out" card are pure client-side math with no ML call already in flight to piggyback on, so this evaluates the same real condition without a network round-trip. Renders the identical copy already used in `WhyPredictionSheet`/`ArchetypeSheet`: *"Still calibrating to your data — the more you log, the sharper this gets."*

**Verified with a real cold-start account**, not a mocked flag: created a throwaway real Firebase user with zero logged transactions, signed in for real, and confirmed the notice renders on the actual Today screen between "Safe is ₹500" and the budget line. Test account (auth user, Firestore profile, beta-allowlist entry) fully deleted after verification.

---

## 5. Boot/splash — the mark now assembles itself

**Before**: a single static SVG (`AntaraMark`) that just breathed (scale/opacity pulse) the whole time it was mounted.

**Built**: `AntaraLoader` now renders the mark's two real layers (dark base, blue accent — same traced paths as `AntaraMark.tsx`) as independent Framer Motion groups. The dark layer fades/slides in from the upper-left, the blue layer follows ~150ms later from the lower-right, both landing at ~0.85s — then the same breathing idle loop as before takes over, in case `loading` stays true longer than that (no artificial minimum duration was added; this has no internal timer, same rule as the component it replaces — it's on screen for exactly as long as real auth/boot state is loading).

**Verified with real rendered frames**, not just reading the code: since a warm local server resolves auth before a screenshot sweep can catch anything (Firebase's local-persistence check is near-instant), used a temporary, fully-reverted `?__e2e_freeze_loading=1` test flag in `AppBootGate` (same "temporary, always-reverted" pattern as the custom-token auth hook used elsewhere in this session) to hold the real loading state open long enough to sweep frames. Confirmed: at 100ms the dark layer is faintly visible, offset from its final position, still fading in; by 250ms both layers have landed; by 2450ms the idle breathing pulse is visibly mid-cycle (mark slightly larger than its settled size). Zero console errors throughout. Hook fully removed before commit — confirmed via `grep` returning no matches for `__e2e_freeze_loading` anywhere in the source.

---

## 6. "What's new" — a real versioned changelog sheet

**Built**:
- `lib/changelog.ts` — a hand-written, versioned changelog (`CHANGELOG`, newest first), seeded with real recent changes: Ollama-generated spend explanations, the `/review` survey screen, the "Going out" category rename, free-text logging, plus this session's own items (note-as-headline, day selector, header consolidation, per-category caps, the calibrating notice). `CURRENT_APP_VERSION` always tracks `CHANGELOG[0].version` (`1.4.0`).
- `WhatsNewSheet.tsx` — same bottom-sheet shape as `CategoryDetailSheet`/`TransactionEditSheet` (no new pattern invented), showing the newest entry's highlights.
- `WhatsNewGate.tsx` — compares `localStorage`'s `antara_last_seen_version` against `CURRENT_APP_VERSION`. A device that has never opened the app before is deliberately **not** shown the sheet on its first-ever load (nothing to have "updated" from) — it silently records the current version instead, and only starts showing the sheet from the *next* real version bump onward. Persisted on dismiss, not on open, so closing the tab before acknowledging it shows it again next time rather than silently marking a version "seen" that was never actually read.
- Mounted from `AppBootGate`, alongside the real app rather than blocking it — a dismissible overlay, like `ConsentGate`/`BudgetSheet`'s own sheets, not one more wall between a returning user and the screen they came back for.
- Local storage, not Firestore, per the brief — this isn't sensitive data and isn't tied to a specific account, so it works identically for a signed-in user, a guest, and demo mode.

**Verified live**, three real states: (a) a brand-new browser profile does **not** see the sheet on first load — confirmed via `body` text; (b) a profile with an older version explicitly recorded in real `localStorage` (simulating a returning user post-update) **does** see it, with all 6 real highlights rendering; (c) after tapping "Got it," `localStorage` is confirmed updated to `1.4.0`, and a reload confirms the sheet does **not** reappear.

---

## Deploy

Same process as every prior pass, on `draftsmanbrain` itself:

1. `git pull origin main` — fast-forward.
2. `npm run build` (frontend) — clean, 11/11 pages, `npx tsc --noEmit` clean, at the exact commit being deployed.
3. `sudo -n systemctl restart antara-ml.service` then `sudo -n systemctl restart antara-frontend.service` — both `active` on the first attempt.

## Post-deploy verification — against the real public domains

- `https://app.antara.money/` loads, `200`.
- `https://api.antara.money/health` returns healthy post-restart — no backend code changed this pass (all 6 items are frontend-only), so this confirms the restart didn't regress anything rather than re-verifying new routes.
- App Router serves page content via streamed RSC payload rather than a handful of neatly-named per-route bundles, so rather than guessing at which minified chunk to grep, verification here is a real headless browser actually loading `https://app.antara.money/` (not localhost) and reading rendered output:
  - **Item 6**: a brand-new browser profile hitting the live domain for the first time does **not** show the What's New sheet (correct — nothing to have "updated" from yet on that origin).
  - **Item 2**: `getComputedStyle` on the live Pull screen's dot-graph panel returns `radial-gradient(120% 90% at 50% 0px, rgb(46, 16, 101), rgb(8, 9, 12))` — the real `primary-950`/`background` tokens, not the old off-palette hex.
  - **Item 3**: the spotlight card's real cap UI ("No cap set yet" / "Set a cap") renders against live demo data; opening the detail sheet shows the same.
  - **Item 1** (bonus confirmation, unprompted): the live demo Pull screen's Gaming entry ("Royal Pass Upgrade Season 12") renders with its own descriptive text as the headline and "Aug 17 · BGMI UC" as the subtitle — the exact fix, visible live in production demo data.
  - Zero console errors across all of the above.
- Items 1/3/4/6's real-signed-in-account/real-Firestore-write checks were run against this exact commit's production build on `localhost:3099` (same backend, same Firestore project, reached without the Cloudflare tunnel — see each item's section above) rather than the live domain directly: the temporary `?__e2e_token=` auth hook used for that was fully reverted before this commit (Google OAuth isn't scriptable headlessly, same limitation as every prior pass), so it's correctly absent from what's deployed live.

Nothing failed. No rollback needed.

---

## Test-data hygiene

This pass needed real signed-in sessions and real Firestore writes to verify against real data (not mocks), per the brief. Everything created for testing was removed afterward:
- Throwaway cold-start test account (Firebase Auth user + Firestore profile doc + beta-allowlist entry) — deleted.
- Two real test transactions logged on the real superadmin account during the note-headline check — deleted from Firestore.
- The ₹1,234 test cap set on the superadmin's Gaming category during the caps check — cleared.
- Beta allowlist confirmed back to its original 5 real emails after cleanup.
- Both temporary auth-test hooks (`?__e2e_token=`, `?__e2e_freeze_loading=1`) fully reverted from `AuthContext.tsx`/`AppBootGate.tsx` before commit — confirmed via `grep` returning zero matches and a clean `git diff` on those files showing only the real feature changes.

## Commit hashes

- **`3a92db3`** — all 6 items (`frontend/src/app/page.tsx`, `frontend/src/app/graph/page.tsx`, `frontend/src/components/{AntaraLoader,AppBootGate,CategoryDetailSheet}.tsx`, new `frontend/src/components/{WhatsNewGate,WhatsNewSheet}.tsx`, `frontend/src/lib/{AuthContext,api}.ts`, new `frontend/src/lib/changelog.ts`, `frontend/src/types/index.ts`).
- This `REVIEW.md` is committed as one more commit on top of `3a92db3` — see below for the precise final `origin/main` hash (a commit can't name its own hash from inside its own message, same handling as every prior pass). Frontend and backend are on the same commit — no backend code changed this pass.
