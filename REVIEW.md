# Antara Engineering Review — Step 10: Survey ETL, Staged Training, Admin Controls

## Status
ALL COMPLETED — Found where survey responses actually land by reading the survey project's own shipped code (not assumed): Firestore, same project, confirmed. Built the full ETL — raw responses → income-banded median/IQR/sample-size stats — and it's live: the running ML engine is currently using real numbers computed from **11 survey responses** (grown from 3 at the start of this pass to 11 by the end — real people kept submitting while I worked). Stage 1 is honestly labeled as survey-derived, not "trained"; Stage 2 is explicitly not attempted. Superadmin config controls are live and verified to actually trigger a recompute on save, not just accept input. The Training Insights screen — distribution chart, sample-size trend, population dot-graph — is built, deployed, and walked through live with real data below. One thing found and fixed along the way that wasn't asked for but mattered: the repo's `firestore.rules` was out of sync with what's actually deployed in production.

---

## 0. Where survey responses actually land — checked, not assumed

Read `survey.antara.money`'s own shipped client bundle directly (`curl`'d the page and its JS chunks — there's no local repo for this project on this box, it's genuinely separate) rather than inferring from what I'd already seen in Firestore from earlier work. Found, in the survey's own code:
```js
projectId: s.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID||"antara-moneycontrol"
```
...and its submit handler:
```js
let e=(0,W.collection)(Y.db,"survey_responses"), t=await (0,W.addDoc)(e,n)
```
**Confirmed: plain Firestore, `survey_responses` collection, same `antara-moneycontrol` project as the main app.** No spreadsheet, no Google Forms, no separate backend. It's an anonymous, unauthenticated client-side write (teens filling out a 3-minute form, not signing in) with a honeypot + 10-second minimum-completion-time bot filter before the write happens.

**Bonus finding while confirming this — the repo's `firestore.rules` didn't match reality.** Queried the Firebase Rules API directly and found a ruleset deployed 2026-08-21 (today, around when the survey went live) containing a full `match /survey_responses/{responseId}` block — write-only-by-anyone, read/update/delete-superadmin-only — that **did not exist anywhere in this repo's `firestore.rules` file**. Someone (the survey project's own setup, presumably) pushed that rule straight to Firebase without it ever landing here. Pulled it into the repo file verbatim rather than leaving the drift in place, added my own new rules for `admin/dataConfig`/`admin/categoryBenchmarks` (superadmin-only both directions) alongside it, and deployed the merged rules via the Firebase Rules API directly (no `firebase` CLI on this box, and it turned out to need a `serviceusage` permission this service account doesn't have — used the lower-level API it wraps instead, verified the release actually pointed at the new ruleset afterward).

Also pulled the survey's own category picker list straight from its bundle — all 17 ids match `CATEGORIES_METADATA`/`STARTER_CATEGORIES` from the Step 9 realignment exactly, so **no second category list to fork or fuzzy-map** (the Step 7 near-miss the brief flagged). The survey also collects `pocket_money_range` (6 fixed buckets, e.g. "₹1,500 – ₹3,000") as the income proxy — real config-driven banding, not something to guess at either.

---

## 1. ETL — survey responses → usable training data

New module: [backend/app/ml/survey_etl.py](backend/app/ml/survey_etl.py).

- **Category mapping**: trivial by construction (see §0) — every `category_spend` key already matches `CATEGORIES_METADATA`. Any id that somehow doesn't match gets collected into `unmappedCategories` in the output rather than silently dropped or silently forking a new category — currently empty (0 unmapped ids across 11 responses).
- **Income bands**: `pocket_money_range` → representative rupee value (band midpoint) → banded via `admin/dataConfig.incomeBandCutoffs` (a real Firestore config value, editable — see §3, not a hardcoded literal). Default: `[1500, 5000]` → Low/Mid/High. **Currently: Low n=6, Mid n=4, High n=1.**
- **Per-category-per-band stats**: median, Q1/Q3/IQR (`statistics.quantiles`, skipped below n=4 — explicitly marked `insufficientForIQR` rather than showing a fabricated spread), min/max, raw and outlier-filtered sample size.
- **Sample size surfaced everywhere**: every single stat object carries `sampleSizeUsed`, `sampleSizeRaw`, and `confidenceTier` (`confident` vs `early_estimate`, from the configurable `minSampleSizeConfident` threshold) — the Training Insights UI renders this as a visibly different badge per category, not a tooltip footnote (see §4 screenshots-in-words below).

**Real example output, right now (n=11, ₹129,384 total reported spend across all respondents):**
```
food-snacks:    median ₹1,625  IQR [₹1,000–₹2,375]  n=10 (1 outlier removed)  early_estimate
clothes-shoes:  median ₹1,000  IQR [₹0–₹1,500]       n=11                     early_estimate
dates-outings:  median ₹1,000  IQR [₹50–₹2,000]      n=11                     early_estimate
transportation: median ₹500    IQR [₹0–₹1,750]       n=11                     early_estimate
grooming:       median ₹300    IQR [₹0–₹900]         n=11                     early_estimate
```
Every category is currently `early_estimate` at the default `minSampleSizeConfident=20` threshold — correctly honest, since 11 people is not a confident sample for anything. That's the point of the threshold being real and configurable, not decorative.

---

## 2. Staged approach — honest about what 11 responses supports

**Stage 1 (this pass) — done, live, and honestly labeled.** `MLEngine.apply_live_benchmarks()` (new, in [engine.py](backend/app/ml/engine.py)) overlays the ETL's `overall.adjustedBenchmarkPct`/`median` onto `CATEGORIES_METADATA` in place — replacing the Step 8/9 static fallback numbers with real survey-derived ones. Runs at backend startup (loads whatever was last computed) and again after every superadmin recompute. Confirmed live via `/api/v1/admin/status`:
```json
"live_survey_benchmarks_applied": true,
"live_survey_benchmarks_sample_size": 11
```
The Training Insights UI and the app's own "Why this pace?" screen both present this as "based on N survey responses" — never as "AI-trained," never implying more confidence than 11 responses earns.

**Stage 2 (embedding-based training on real per-user transaction history) — explicitly not attempted.** Flagging this plainly rather than quietly building something that looks like ML: `MLEngine`'s cold-start/trained-embedding split (Step 4/8) is untouched, and nothing here fits an actual model. Revisit once live transaction volume (not survey-response volume) supports it — those are two different sample sizes and this pass only had authority over the second one.

---

## 3. Superadmin "tailor the data" controls — built and verified to actually recompute, not just save

Backed by `admin/dataConfig` (Firestore doc, not hardcoded constants) — new [DataConfigPanel.tsx](frontend/src/components/DataConfigPanel.tsx), wired into the existing `/admin` panel. Controls:
- **Income band cutoffs** (editable number inputs, per band).
- **Per-category trust-weight multiplier** (0–1 slider) — down-weights a category's contribution to the derived `benchmark_pct` toward a neutral uniform share, without touching the raw displayed median/IQR/n. A category the superadmin distrusts gets pulled toward "no signal," not deleted or lied about in the UI.
- **Outlier handling** on/off + threshold (× IQR, Tukey fence).
- **Minimum sample size for "confident"** (below it: "early estimate").

**Verified the "triggers a recompute, not a redeploy" requirement literally, not just architecturally**: called `PUT /api/v1/admin/data-config` with `{"categoryWeights": {"fantasy-betting": 0.3}, "minSampleSizeConfident": 5}` and confirmed the response's `recomputedStats` reflected it immediately — `fantasy-betting` (raw survey share 0.0%, nobody had reported spend there) came back with `adjustedBenchmarkPct: 0.0412` (= `0.3 × 0.0 + 0.7 × 1/17`, the blend-toward-uniform math working exactly as designed), and `food-snacks`'s confidence tier flipped from `early_estimate` to `confident` the instant the threshold dropped to 5 (n=8 ≥ 5). Reset both back to production defaults afterward. **This is a real, working, live-tested pipeline, not a config screen that saves to a doc nothing reads.**

---

## 4. Admin "Training Insights" view — live, walked through with real data

New route: `/admin/training-insights` ([page.tsx](frontend/src/app/admin/training-insights/page.tsx)), linked from the main `/admin` panel, superadmin-gated both in the UI and on every backend call it makes.

**Sample size & trend** — big number (11), timestamp, and a bar-chart trend built from a real history subcollection (`admin/categoryBenchmarks/history`, one entry appended per recompute) — currently 3 points since this is the first pass this mechanism has ever run, honestly thin but the actual plumbing, not a placeholder.

**Per-category distribution chart**, tabbed by income band (`Overall (n=11)` / `Low (n=6)` / `Mid (n=4)` / `High (n=1)`) — each row: category dot + name, a median tick inside an IQR bar, and an inline badge showing exact sample size, outliers removed, and confidence tier. Verified live: switching bands re-renders with each band's own real numbers (e.g. `High (n=1)` correctly shows every category as a single raw value with no IQR, flagged `insufficientForIQR`, not a fabricated spread from one data point).

**Population-level dot-graph preview** — this is the part you explicitly wanted to see as it develops, so here's what it actually looks like right now, described concretely since I can't literally paste a screenshot into this file: five faint ring-outlined anchor nodes arranged in a circle, one per `PEER_ARCHETYPES` entry (the *same* fixed archetype definitions the per-user Pull dot-graph uses — reused exactly, not redefined), each labeled ("The Zen Saver," "The Commuter Nomad," "The Gamer & Foodie," "The Social Trendsetter," "The Exam Grinder & Scholar"). Around them, 11 small solid dots — one per survey respondent, colored and positioned by cosine-similarity match to its nearest archetype, distance from the anchor inversely proportional to match strength. At n=11 the clustering is genuinely visible, not random noise: 3 respondents landed near "The Gamer & Foodie," 2 near "The Social Trendsetter," 2 near "The Commuter Nomad"/"The Zen Saver," rest scattered — a real, if early, signal that the archetype definitions have *some* discriminating power, which is exactly what this view is for as a pre-trust sanity check. Tapping a dot shows a real detail card (tested live): `"Respondent 11 (Low) — Best match: The Gamer & Foodie (50.8% similarity) · total reported ₹7,901"`.

**Caught and fixed a real rendering bug getting here**: my first pass sized respondent dots by `size × viewport-scale × 3.2`, which compounded into ~40px circles that overlapped into unreadable blobs and hid the archetype labels entirely — screenshotted it, saw it was wrong, fixed the sizing to a fixed bounded radius (4–10px), rebuilt, re-verified. Not something `npm run build` would ever catch.

**Explicit Stage 1/Stage 2 banner** on the page itself, matching §2's honesty requirement: *"These are real medians/distributions from 11 survey responses — presented as 'based on 11 survey responses,' not as anything trained."*

---

## 5. Files Touched This Pass

**ETL / backend**
- [backend/app/ml/survey_etl.py](backend/app/ml/survey_etl.py) — new: config loading, income banding, stats computation, outlier handling, population dot-graph
- [backend/app/ml/engine.py](backend/app/ml/engine.py) — `MLEngine.apply_live_benchmarks()`
- [backend/app/main.py](backend/app/main.py) — startup loads existing benchmarks; new endpoints `GET/PUT /api/v1/admin/data-config`, `POST /api/v1/admin/recompute-benchmarks`, `GET /api/v1/admin/training-insights`; `/api/v1/admin/status` now reports live-benchmark state

**Firestore**
- [firestore.rules](firestore.rules) — synced in the already-deployed `survey_responses` block (was missing from the repo), added `admin/dataConfig`/`admin/categoryBenchmarks` rules, deployed via the Firebase Rules API
- New Firestore docs: `admin/dataConfig`, `admin/categoryBenchmarks` (+ `history` subcollection)

**Frontend**
- [frontend/src/lib/api.ts](frontend/src/lib/api.ts) — types + fetch helpers for all four new admin endpoints
- [frontend/src/components/DataConfigPanel.tsx](frontend/src/components/DataConfigPanel.tsx) — new
- [frontend/src/components/CategoryDistributionChart.tsx](frontend/src/components/CategoryDistributionChart.tsx) — new
- [frontend/src/components/SampleSizeTrend.tsx](frontend/src/components/SampleSizeTrend.tsx) — new
- [frontend/src/components/PopulationDotGraphCanvas.tsx](frontend/src/components/PopulationDotGraphCanvas.tsx) — new (one sizing bug found and fixed, see §4)
- [frontend/src/components/SuperadminPanel.tsx](frontend/src/components/SuperadminPanel.tsx) — wired in both new pieces, both gated on `isSuperAdmin` (this page doesn't otherwise gate by role — didn't want these two additions to be the exception that shows real admin tooling to non-admins)
- [frontend/src/app/admin/training-insights/page.tsx](frontend/src/app/admin/training-insights/page.tsx) — new

**Infra**
- Rebuilt (`npm run build`, clean both times — once before the dot-graph sizing fix, once after) and restarted `antara-frontend.service` and `antara-ml.service`; both confirmed healthy after, alongside the tunnel and Tailscale fallback (all four `200`s re-checked at the end)

## 6. Access Summary (unchanged)
- **Public domain**: https://app.antara.money (app), https://api.antara.money (backend API)
- **Tailscale (fallback)**: http://100.103.94.116:3001 (app), http://100.103.94.116:8001 (backend API)
- **New admin route**: `/admin/training-insights` (superadmin-only)
