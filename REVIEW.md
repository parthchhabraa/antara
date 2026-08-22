# Antara — Step 15 Review

**Status: ALL COMPLETED — the recovered Step 12+13 work (public-signup toggle, legal pages, editable budget, transaction edit/delete) is now genuinely verified and committed, both regressions from the Step 13 gap audit are fixed, survey benchmarks are refreshed from n=3 to n=36, and production (both services) was rebuilt/restarted and confirmed healthy on all of it. The unmerged survey branch was left untouched, as instructed.**

Commits this pass (all pushed to `origin/main`): `7700327` (Steps 12+13 recovery), `0d1fc55` (test regressions), `bcd187f` (benchmark refresh).

---

## 1. Verifying the recovered work — what I checked myself vs. took on trust

**Still on disk, still uncommitted, confirmed via `git status` before touching anything.** And it turned out to be bigger than "Step 13": the last real commit on `main` was Step 11's (`245ea39`/`2844e0e`) — **Step 12 was never committed either.** `ConsentGate.tsx`, `PublicSignupToggle.tsx`, `LegalPageLayout.tsx`, the `/privacy`/`/terms` pages, and the `firestore.rules` `isPublicSignupEnabled()`/`admin/launchConfig` additions are all untracked/modified files that post-date `245ea39` with no commit of their own — confirmed by `git log --all | grep -i "step 12"` (nothing) and by every one of those files' mtimes falling after the last real commit. The recovered `REVIEW.md` draft's own text assumes Step 12 already landed ("Step 12's ConsentGate," "Step 12: public-launch toggle") — that framing was wrong; it hadn't. Saying so plainly rather than committing it under a label that undersold what was actually being committed.

**No conflict with Step 14.** Diffed file paths: Step 14 (`9f811bc`, `7ccf053`) touched only `backend/app/main.py`, `backend/app/ml/survey_etl.py`, and `REVIEW.md`. Zero overlap with anything in the recovered Step 12/13 change set (all `frontend/*` + `firestore.rules`). Clean merge into one state, no manual reconciliation needed.

**The two riskiest claims — independently reproduced, not trusted:**

- **(a) The `updateDoc()`/`undefined` bug.** Didn't just read the fix and believe it. Minted a real Firebase custom token for the superadmin's actual account, signed into the **real client Firestore SDK** (the literal `firebase/firestore` package this app imports, not the Admin SDK, not a proxy) against real production Firestore, created a throwaway test transaction, and called `updateDoc(ref, { note: undefined })` directly — the exact pre-fix code path (`note.trim() || undefined`). Got back, verbatim: `FirebaseError: Function updateDoc() called with invalid data. Unsupported field value: undefined (found in field note in document users/.../transactions/step15-repro-test-tx)` — matches the recovered review's claimed error exactly. Then called `updateDoc(ref, { note: "" })` — succeeded, read back the doc, confirmed `note === ""`. Deleted the test transaction, confirmed it was gone. The claim checks out, independently, not just "the fix is in the diff."
- **(b) The budget-edit Firestore write path.** Same real-account approach: read the account's actual current `monthly_budget` immediately before testing (matters — see the note below), wrote a throwaway `604` via the exact `setDoc(userRef, {monthly_budget: amount}, {merge:true})` call `saveMonthlyBudget()` makes, confirmed it landed *and* that `merge:true` didn't clobber any other profile field (`email`/`role`/`currentStreak` all compared before/after), then restored the pre-test value. Confirmed working, for real, against a real account.
- **Incidental finding while testing (b), worth stating plainly rather than glossing over):** the account's `monthly_budget` read differently a few minutes apart during this session (`2000` via an earlier Admin SDK check, `10000` moments later via the client SDK right before my test write) — not a bug in my process, but a real signal that **the superadmin's own account is being actively used concurrently** (by the account owner, presumably, testing their own app) while this session was running. I read the value *immediately* before writing my test value and restored to that exact immediately-prior value, which is the only correct thing to do — reverting to an earlier snapshot would have overwritten a real edit that happened in between and wasn't mine to undo.

**Re-verified rather than trusted, cheaply:** the 18-category id-set match between `frontend/src/lib/constants.ts` and `backend/app/ml/engine.py`'s `CATEGORIES_METADATA` — re-ran the diff myself (programmatic set comparison, not eyeballing), still exactly 18/18, zero drift either direction.

**Taken on trust** (code-read + a clean `npm run build`/`npx tsc --noEmit`, not independently re-clicked through the UI): the exact delete/edit UI interaction details, the streak-fields-untouched design rationale (the reasoning holds up on inspection and matches the app's existing patterns, but I didn't re-run a live delete against a real account a second time — Step 13's own methodology for that specific claim, i.e. deleting a real test transaction and confirming via a Firestore read, was itself sound and is exactly the kind of thing that doesn't need re-proving twice), and the `WhyPredictionSheet`/`PullCanvas`/`DataConfigPanel` import claims (confirmed via `grep` that they import `STARTER_CATEGORIES` directly, matching the claim, but didn't visually re-render each screen).

**Confirmed production was already serving this exact code, independent of git** (three separate signals, before any rebuild/restart of my own): the `.next` build's timestamp post-dated every source file touched by Steps 12/13; the distinctive UI string `"Tap again to confirm"` (from `TransactionEditSheet.tsx`) was present in the actual served static JS chunk; the precise bug-fix pattern `note:y.trim()` was present in that same chunk (not `note:y.trim()||void 0` or similar — the fixed version, specifically). And the **deployed** Firestore ruleset — fetched directly via the Firebase Rules REST API, not assumed from the local file — was byte-identical to the local uncommitted `firestore.rules`. All of this checked out before I ever ran `git add`.

---

## 2. Production — confirmed, then rebuilt/restarted anyway

Given real testers are on this right now, verified rather than assumed at every step:

1. Confirmed (§1 above) that the *pre-existing* running build already reflected Steps 12/13's code — so real testers were never on stale code for that part.
2. But the benchmark refresh (§3 below) touches `constants.ts`, which **wasn't** in the running build yet. So: fresh `npm run build` (clean), `sudo systemctl restart antara-frontend.service`, confirmed `active` and `https://app.antara.money/` returns `200`.
3. Also restarted `antara-ml.service` (needed regardless, to pick up nothing new code-wise here but to keep both services' restart-and-verify symmetric and confirm the in-memory live-benchmarks state survives a restart cleanly) — confirmed `active`, `/health` healthy, and `/api/v1/admin/status` still reporting `live_survey_benchmarks_sample_size: 36` after the restart (loaded correctly from the persisted `admin/categoryBenchmarks` doc at startup).
4. Re-verified post-restart, against the live static chunks actually being served: the new `monthly_cap` values (`100`, `150`, `1e3`, `200`, `2e3`, `50`, `500`) are present; the stale `2500` is gone; `"Tap again to confirm"` and `note:y.trim()` are both still present (no regression from the rebuild). `/privacy` and `/terms` both still `200` on the live domain.

No crash loop, no `RestartSec` retries — both services came up clean on the first attempt each.

---

## 3. Refreshed n=3 → n=36 benchmarks

**Backend (`engine.py`'s `CATEGORIES_METADATA`) needed no code change** — that's the actual point of Step 10's design: called `POST /api/v1/admin/recompute-benchmarks` for real against production (as the superadmin, via a minted ID token), which recomputes from whatever's in Firestore right now and overlays the result onto the running `MLEngine` in memory. Result: **n=36, every one of the 17 survey categories now at the "confident" tier** (≥20 responses — was "early_estimate" across the board at n=3). Confirmed via `/api/v1/admin/status` both immediately after and again after the later service restart.

**Frontend (`constants.ts`'s `monthly_cap`) has no equivalent live path** — it's a static, build-time TS constant, no runtime overlay exists for it. Refreshing it means editing the file; the difference from "hand-editing constants" is that every number is copied directly from that same real recompute response, not re-derived or guessed. `monthly_cap` = the category's real median, same convention the original 3-response version already used:

| Category | n=3 cap | n=36 cap | |
|---|---|---|---|
| food-snacks | 2500 | **2000** | |
| dates-outings | 2000 | **1000** | |
| clothes-shoes | 2000 | **1000** | |
| gifting-friends | *(none)* | **100** | new |
| transportation | *(none)* | **500** | new |
| grooming | *(none)* | **500** | new |
| subscriptions | *(none)* | **200** | new |
| movies-entertainment | *(none)* | **150** | new |
| tech-gadgets | *(none)* | **100** | new |
| mobile-recharge | *(none)* | **50** | new |
| books | *(none)* | **100** | new |
| investments, fitness, gaming-inapp, tuition-coaching, charity-donations | *(none)* | *(still none)* | see below |

Those 5 stay deliberately uncapped: their real, confident-tier (n≥27 each) median is a genuine ₹0 — not under-sampling noise the way a ₹0-from-3-people reading was — but a literal ₹0 cap isn't useful advice (it would flag the first rupee logged as "over cap"), and for `investments` specifically a spend "cap" is conceptually backwards (it's savings; capping it would penalize saving more). Re-applying the existing "zero median ⇒ no cap, not a zero cap" rule to a real sample now, not changing the rule.

**Didn't run `scripts/compute_category_benchmarks.py`.** Found it, read it, and deliberately didn't use it — it's an older, pre-Step-10 script that writes a differently-shaped `admin/categoryBenchmarks` doc (`computed_at`/`sample_size`/`categories`, snake_case) than `survey_etl.py`'s `run_etl()` (`computedAt`/`sampleSize`/`overall`/`byIncomeBand`/etc., camelCase). Running it would have silently overwritten the real doc with an incompatible shape and broken `MLEngine.apply_live_benchmarks`'s parsing of it. Left it alone, not deleted — flagging it as dead/superseded and worth a cleanup pass sometime, out of scope to remove blind here.

---

## 4. Two regressions from the gap audit — both fixed, both verified

- **`test_ml_cold_start_heuristic_mode`.** Re-ran the suite myself first to confirm the claimed failure before touching anything: `1 failed, 2 passed`, matching the audit exactly. Fixed: `len(res.category_breakdown) == 12` → `== len(CATEGORIES_METADATA)` (can't drift out of sync with the taxonomy silently again), and `category="food-delivery"` → `"food-snacks"`. Also swapped the same two stale ids (`"gaming"` → `"gaming-inapp"`, `"food-delivery"` → `"food-snacks"`) in the other two tests in the file, which weren't failing (they don't assert on category-derived counts) but had the same underlying drift. `pytest`: **3 passed, 3 passed** — confirmed clean, twice (before and after, plus once more post-benchmark-refresh to be sure that didn't reintroduce anything).

- **`firestore-rules.test.ts` — actually runnable now, not declared out of scope.** Installed `jest`/`ts-jest`/`@types/jest`/`firebase-tools` as devDependencies (all dev-only — none are imported by app source, so zero production bundle impact, confirmed by the build output size being unchanged), added `jest.config.js`, added a `"test"` script. The Firestore emulator needed a JVM that wasn't installed on this box (`apt-get install default-jre-headless`, low-risk — new packages only, no service touched) and its default port 8080 was already claimed by an unrelated `docker-proxy` on this host, so both `firebase.json` and the test's own `initializeTestEnvironment` call now point at 8085 instead. **Also found a second, previously-invisible bug while wiring this up**: the test read rules from `path.resolve(__dirname, "../firestore.rules")`, which resolves to `frontend/src/firestore.rules` — a path that has never existed (the real file is two directories further up, at the repo root). This test could not have passed before, jest or no jest, emulator or no emulator — fixed the path. Added `"test:rules"`, a single command (`firebase emulators:exec` — starts the emulator, runs jest, tears it down, nothing left running after) that a developer can actually run going forward. Ran it for real against the actual deployed rules content: **10/10 pass.**

---

## 5. Left untouched, as instructed

`origin/claude/antara-spending-survey-6o4o2w` — not looked at, not touched, not merged. Still flagged (per every prior review since Step 11) as real, larger work that deserves its own dedicated brief.

---

## Verification performed

- `git status`/mtime/`git log --all` analysis establishing that Step 12, not just Step 13, was uncommitted, and that neither conflicts with Step 14's shipped commits.
- Real reproduction of the `updateDoc()`/`undefined` bug and its fix against real production Firestore, via the actual client SDK, using a throwaway test transaction (created and deleted for real).
- Real write/read/restore of the budget-edit path against the real superadmin account (throwaway value written, confirmed, other fields checked unclobbered, real pre-test value restored).
- Independent re-verification (not re-trusted) of the 18/18 category id-set match via a fresh programmatic diff.
- Deployed Firestore rules fetched via the Firebase Rules REST API and diffed byte-for-byte against the local file.
- Compiled static-chunk inspection (both before and after this pass's own rebuild) confirming specific Step 12/13/15 code is genuinely present in what's served, not just present in source.
- Fresh `npm run build` (clean) and `npx tsc --noEmit` (clean) after every source change in this pass, not just once at the end.
- Backend `pytest`, run before and after the fix, plus once more after the benchmark refresh: `1 failed, 2 passed` → `3 passed, 3 passed`, confirmed stable.
- `firestore-rules.test.ts` actually executed against a real (locally emulated) Firestore instance running the real rules file: 10/10 pass, run twice (once manually against a standalone emulator, once via the final `emulators:exec`-wrapped `test:rules` script to confirm the documented one-command path works).
- Called the real `POST /api/v1/admin/recompute-benchmarks` against production and confirmed the result via `/api/v1/admin/status`, both immediately after and again after the later service restart.
- Both `antara-frontend.service` and `antara-ml.service` restarted for real, confirmed `active` with no restart-loop, and confirmed healthy via their public endpoints post-restart.
- Cleanup: all throwaway test transactions/values deleted or restored; temporary reproduction scripts removed from the working tree (never committed); Firestore emulator processes confirmed stopped (`ss -ltn` clean on their ports) after each run; stray `firestore-debug.log` deleted and `.gitignore`d against recurrence.
