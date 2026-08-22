# Antara — Step 16 Review

**Status: ALL COMPLETED — the unmerged survey branch was investigated (not assumed dead), turned out to be the actual source of the live survey.antara.money, and was selectively ported into `main` rather than blind-merged or discarded; the branch itself was then deleted from GitHub, now that everything of value from it lives in `main`'s own history. One confirmed-dead script was removed and a broader sweep found no other orphaned code. `CLAUDE.md` now carries a top-of-file git-hygiene rule. Commits this step: `e1c16d3`, `7f2efe1`, `8617d57`, and this review doc itself — see the commit-hashes section below for the exact final `origin/main` HEAD.**

---

## 1. The unmerged survey branch — investigated, then selectively ported, then deleted

**Not a blind merge, not a guess — actually figured out what it was first.** `origin/claude/antara-spending-survey-6o4o2w` diverged from `main` at `16a5608`: 7 commits on the branch, 13 on `main` since. Before touching anything, fetched the live `https://survey.antara.money/` and compared its actual served JS bundle against the branch's source — same `schema_version:2`, same 17 category ids/labels (`"Food, drinks & snacks"`, `"Gifting to friends"`, `fantasy-betting`, `charity-donations`, …), same demographic/habit field names (`age_range`, `family_income_bracket`, `pocket_money_duration`, `tracks_spending`), same `payment_method`/`honeypot` anti-spam mechanism. **This branch (or something byte-identical to it) is genuinely what's running the live survey right now** — not dead work superseded by a separate project, the opposite assumption from what "investigate before merging" was worried about.

Traced the actual deployment chain to be sure, not just inferred it: `scripts/export-survey-static.sh` (on the branch) builds a static export and says to copy it "to the root of your GitHub Pages branch." Found that repo — `github.com/parthchhabraa/antarasurvey` — cloned it, and its `claude/antara-spending-survey-6o4o2w` branch (same name, independent repo) holds `index.html` that is **byte-identical** to what `curl https://survey.antara.money/` actually returns. Its own README confirms the architecture directly: "This repo holds only the *built* static output... it isn't the survey's source code. The survey itself is a Next.js route (`/survey`) that lives in `parthchhabraa/antara`."

**So the actual question wasn't "is this dead," it was "what's still only-on-this-branch, and what's already been independently re-derived (and improved) on `main`."** Checked both files the branch touches that overlap with things `main` also changed:
- `firestore.rules`: diffed directly — `main`'s current version is a **strict superset** of the branch's, including the exact `survey_responses` rule with the exact same provenance comment ("Step 10... ruleset 3bc866e4..."), meaning `main`'s Step 10 author independently found the same live-deployed rule (by reading Firebase directly, not this branch) and then kept extending it (Step 12's `isPublicSignupEnabled`, admin config rules) further than the branch ever did. Nothing to port.
- `frontend/src/tests/firestore-rules.test.ts`: `main`'s version, fixed and made runnable in Step 15, tests more scenarios (allowlisted / non-allowlisted / no-doc-at-all) than the branch's older version and doesn't carry the branch's legacy `firebase/compat` import. Nothing to port; `main`'s is strictly better.

**What was genuinely still only on the branch, verified compatible with `main` before porting anything** (same 17 category ids/order as `survey_etl.py`'s `SURVEY_CATEGORY_KEYS`, same `POCKET_MONEY_RANGES` strings as its lookup table, zero new npm dependencies required): the actual `/survey` route and its private dependencies — `app/survey/{layout,page}.tsx`, `components/survey/*` (8 files), `lib/surveyApi.ts`, `lib/surveyConstants.ts`, `types/survey.ts`, the `next.config.js` opt-in static-export block (merged with `main`'s own since-added `rewrites()`, which is mutually exclusive with static export in Next.js — handled by omitting the rewrite only under `STATIC_EXPORT=true`), `scripts/export-survey-static.sh`, and `scripts/export_survey_training_data.py` (a raw CSV/JSONL dump tool — not superseded by `survey_etl.py`, which only computes aggregates; still the only way to get per-respondent rows out, useful for the "Stage 2" work `survey_etl.py`'s own docstring says is still pending).

**Fixed one real, verified-stale thing while porting rather than carrying it forward blind** — exactly the kind of regression the brief warned about, just found in a place it didn't name: `lib/brand.ts`'s colors (`#171717`/`#3E7C99`) were the branch's pre-real-logo eyeballed guess. `main`'s own Step 11/12 already traced the real source file and found the actual values (`#0E87B0`/`#1F1E1C` — a documented 34.7% pixel-diff, not anti-aliasing noise). Updated to the real values; left the survey mark's own animated SVG construction alone (a legitimate, separate re-trace-to-match-the-real-geometry task, not attempted blind here).

**Verified, not just built:** `npx tsc --noEmit` clean, full `npm run build` clean (11/11 pages including `/survey`), and — the part that actually matters, that the port didn't just compile but still *works* — ran `CUSTOM_DOMAIN=survey.antara.money ./scripts/export-survey-static.sh` for real from this checkout and confirmed the output has the corrected `#0E87B0` (and zero remaining `#3E7C99`), `schema_version:2`, and the full real category list.

**Did NOT redeploy `antarasurvey` / touch the live `survey.antara.money` site.** This port fixes the color mismatch in `main`'s own copy of the source; making that reach the live site is a separate, explicit action in a third repo (re-export + copy into `antarasurvey`), not part of "the unmerged branch in `antara`." Flagging as a real, optional follow-up — the live site currently still shows the old approximate blue, which is a cosmetic, not functional, gap.

**Disposition, stated plainly: merged-selectively, then deleted.** Everything of value is now in `main`'s own history (commit `e1c16d3`). The two files that weren't ported (`firestore.rules`, the old rules test) are confirmed superseded, not overlooked. With nothing left un-absorbed, keeping the branch around would only recreate the exact ambiguity this task exists to resolve — so it's gone: `git push origin --delete claude/antara-spending-survey-6o4o2w`, confirmed removed via `git branch -a` after a `--prune` fetch. (The separate `antarasurvey` repo and its own identically-named branch are untouched — deleting `antara`'s branch has no effect on the live site, which doesn't depend on this repo's branch existing at all.)

---

## 2. Dead code

**`scripts/compute_category_benchmarks.py`** — confirmed zero references anywhere except comments/docs (grepped `frontend/src`, `backend/app`, `scripts`, `*.md`) before removing. Updated the two comments that pointed at it (`engine.py`, `constants.ts`) to describe the real live mechanism instead of a script that no longer exists.

**Broader sweep, per the brief's examples:**
- Step 7's deleted-component list (old `predict/page.tsx`, `DotGraphCanvas.tsx`, `PredictiveInsightsCard.tsx`, `QuickLogModal.tsx`, `TransactionList.tsx`) — already properly deleted, in commit `86c8ef5`. Confirmed via `git log --diff-filter=D`. Nothing lingering.
- Checked every file in `frontend/src/components`, `frontend/src/lib`, and `backend/app` for at least one real importer elsewhere (a precise `from "@/..."` grep, not a loose substring match that would false-positive on comments) — everything currently in the tree is genuinely referenced. No other orphaned files found.
- Did find one lower-grade version of the same underlying problem, in a place the brief didn't specifically name: `frontend/src/tests/firestore-rules.test.ts` (the file Step 15 got running) still used the pre-Step-9 `"food-delivery"`/`"gaming"` ids in five test fixtures — the exact same drift Step 15 already fixed in the Python test, just never caught here because Firestore rules don't validate a category *value*, so the stale ids never failed an assertion, they just silently didn't match reality. Fixed for consistency (`food-snacks`/`gaming-inapp`); re-ran `npm run test:rules` after — still 10/10 passing.

---

## 3. `CLAUDE.md` — git-hygiene rule, in place and committed

Created at the repo root (didn't exist before), with the git-hygiene rule as the **first section of the file** per the brief: check `git status` in every repo touched, commit everything meaningful (docs/config included, not just app code), push to `origin/main`, and state the resulting commit hash(es) explicitly in the review doc rather than a bare "committed and pushed" claim. Also carries a short repo-layout section (service names, where `antaraweb`/`antarasurvey` actually live relative to this repo, the committed-vs-deployed distinction for `firestore.rules`) — context more than one session has had to independently rediscover this engagement, now stated once. Committed at `8617d57`.

---

## Commit hashes (this step, `antara` repo, all pushed to `origin/main`)

- `e1c16d3` — selectively port the unmerged survey branch into `main`
- `7f2efe1` — remove dead `compute_category_benchmarks.py`, fix stale category ids in rules tests
- `8617d57` — add `CLAUDE.md` with the git-hygiene rule
- This `REVIEW.md` commit is one more on top of `8617d57` — per `CLAUDE.md`'s own new rule, that means *this* review doc can't state its own final hash from inside itself. After this commits and pushes, `git log -1 --format=%H` (or `git rev-parse origin/main`) on the `antara` repo gives the exact final `origin/main` HEAD for this step — confirmed identical to local `HEAD` immediately before writing this section (see Verification below), same as every other step.

No other repo was touched this step (unlike Step 14, which also spanned `antaraweb`) — this was entirely a `antara`-repo-and-its-GitHub-branches task.

---

## Verification performed

- Fetched the real, live `https://survey.antara.money/` and diffed its actual served JS against the branch's source (schema version, category ids/labels, field names, anti-spam mechanism) before concluding anything about what the branch actually is.
- Cloned the separate `antarasurvey` repo and confirmed its deployed branch's `index.html` is byte-identical to what the live domain serves, and read its README to confirm the deployment architecture rather than assume it.
- Diffed `firestore.rules` and `firestore-rules.test.ts` directly (branch vs. `main`) to confirm `main`'s versions are strict supersets/improvements before deciding not to port them.
- Verified every ported file's compatibility with `main`'s current state *before* porting: category id set/order (`SURVEY_CATEGORY_KEYS`), pocket-money range strings, and a full import scan across every file to be ported confirming zero new npm dependencies needed.
- `npx tsc --noEmit` and a full `npm run build` (11/11 pages) after the port — clean.
- Ran the actual ported `export-survey-static.sh` end-to-end and inspected its real output for the brand-color fix and correct schema/category content — not just "it builds."
- Caught and fixed my own build-hygiene slip mid-verification: a `STATIC_EXPORT=true` test build left `.next` in a mode incompatible with `next start`; rebuilt in normal mode immediately and restarted `antara-frontend.service` to confirm the running production build was never left inconsistent (`app.antara.money` and `app.antara.money/survey` both checked `200` after).
- Precise (not substring) import-reference checks across `frontend/src/components`, `frontend/src/lib`, and `backend/app` for the dead-code sweep.
- Re-ran `npm run test:rules` (10/10) after fixing the stale category ids in that file, and `pytest` (3/3) after the dead-code comment edits — both still clean.
- Final `git status` clean in `antara`; `git fetch` + `git rev-parse HEAD`/`origin/main` confirmed identical before writing this review, per `CLAUDE.md`'s own new rule.
- Confirmed both `antara-frontend.service` and `antara-ml.service` still `active` and healthy at the end of the session (no restart was actually required for this step's final committed state beyond the one already done mid-verification above — nothing in the dead-code/CLAUDE.md commits touches runtime code).
- Confirmed the deleted branch is actually gone: `git branch -a` (after `git fetch --prune`) shows only `main`.
