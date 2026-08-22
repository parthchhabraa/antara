# Antara — Step 14 Review

**Status: ALL COMPLETED — new public `GET /api/v1/public/survey-stats` endpoint is live on production (`api.antara.money`), `antaraweb`'s paper now fetches it on load and genuinely re-renders every "n=11" figure from real data, and the failure/fallback path was verified separately. Live sample size at verification time: n=36 (not 11 — the survey has grown since the paper's last hand-edit, which is the whole point of this pass). Both repos are committed and pushed.**

This step spans two repos:
- **`antara`** (this repo, backend) — the new endpoint: [backend/app/ml/survey_etl.py](backend/app/ml/survey_etl.py), [backend/app/main.py](backend/app/main.py). Commit `9f811bc`, pushed to `origin/main`.
- **`antaraweb`** (separate repo, `git@github.com:parthchhabraa/antaraweb.git`, no build step, deployed via GitHub Pages at the `antara.money` apex per its `CNAME`) — the live-fetch script in `index.html`. Commit `be08cfb`, pushed to `origin/main`, confirmed redeployed and live at `https://antara.money`.

---

## 1. New public endpoint — `antara` repo

**`GET /api/v1/public/survey-stats`**, unauthenticated, added in [main.py](backend/app/main.py) right before the `if __name__ == "__main__"` block, deliberately outside the `/api/v1/admin/*` group (no `require_superadmin` dependency) since the brief is explicit this is aggregates-only over an already-anonymous survey.

**Reuses Step 10's `survey_etl.py`, doesn't duplicate it.** Added one new function, `build_public_stats_payload(db)`, which calls the existing `load_data_config()`, `fetch_survey_responses()`, `compute_stats()`, and `generate_population_dot_graph()` directly and reshapes their output into the smaller public schema — it's a view, not a second pipeline. The only new logic is `_archetype_slug()`, a one-line id transform (`"archetype_gamer_foodie"` → `"gamer-foodie"`) so the public payload's archetype keys match the brief's requested shape.

Response shape (verified against real production data, not fabricated):
```json
{
  "sampleSize": 36,
  "lastUpdated": "2026-08-22T11:18:...Z",
  "categories": { "food-snacks": {"median": 2000.0, "q1": 1000.0, "q3": 3000.0, "n": 33, "outliersRemoved": 3, "confidenceTier": "confident"}, "...": "..." },
  "incomeBands": {"low": 14, "mid": 13, "high": 9},
  "archetypeClusters": {
    "gamer-foodie": {"count": 7, "respondents": [{"matchPct": 0.777}, "..."]},
    "exam-grinder": {"count": 13, "respondents": ["..."]},
    "social-trendsetter": {"count": 11, "respondents": ["..."]},
    "commuter-nomad": {"count": 3, "respondents": ["..."]},
    "zen-saver": {"count": 2, "respondents": ["..."]}
  }
}
```
`categories[*].median/q1/q3` are `null` (not fabricated) for any category with zero usable responses — that path exists and is exercised (unit-tested directly, see §3), even though every one of the 5 categories `antaraweb`'s Fig. 2 shows happened to have real data at verification time.

**No PII, by construction.** Every field is either a category aggregate or a single `matchPct` float per anonymous respondent, grouped only by their closest archetype — no respondent index, name, or any other identifying field is ever included (checked directly against `generate_population_dot_graph`'s node output, which does carry more, e.g. `totalReported`/`incomeBand`/`label: "Respondent N"` — none of that crosses into the public payload).

**CORS — verified, not assumed.** The brief specifically asked me to check whether Step 9's `https://antara.money` allowlist entry still covers a brand-new route rather than assume it does. It does: FastAPI's `CORSMiddleware` is registered once, globally (`app.add_middleware(...)` in `main.py`, line ~56) — there is no per-route CORS mechanism in this codebase, so every route including the new one is covered by the same `ALLOWED_ORIGINS` list, which already has `"https://antara.money"` from Step 9. No code change was needed here; confirmed live with a real `OPTIONS` preflight against production:
```
OPTIONS https://api.antara.money/api/v1/public/survey-stats
Origin: https://antara.money
→ 200, access-control-allow-origin: https://antara.money
```

---

## 2. Live-fetch the paper — `antaraweb` repo

Added a single `<script>` block (plain JS, no framework, no bundler — this repo genuinely has neither) right before `</body>` in `index.html`. On load it fetches the endpoint above with a 6s timeout, and on success recomputes every place the paper cited the sample size. Grepped the file for the literal `11` first to find every instance, not just the obvious ones — the full audited list, each now backed by a `js-*`/`fig*-*` id in the markup:

| Location | Before | Mechanism |
|---|---|---|
| Abstract | `(n=11 at time of writing, growing)` | `#js-n-abstract` |
| §4 intro | `n = 11 valid responses` | `#js-n-intro` |
| Fig. 2 rows ×5 (Food&Snacks, Clothes&Shoes, Dates&Outings, Transportation, Grooming) | `n=11` / `n=10 (1 outlier excluded)` | `#fig2-n-<cat>`, plus `.iqr-bar`/`.median-tick` `left`/`width` recomputed from real median/q1/q3 |
| Fig. 2 scale label | `₹2,500` | `#fig2-scale-max` — stays ₹2,500 unless real Q3 exceeds it, then rounds up to the next clean ₹500 |
| Fig. 3 band bars | `6` / `4` / `1`, heights `100%/67%/17%` | `#band-{low,mid,high}-{val,bar}` — heights scaled relative to whichever band is largest |
| Fig. 4 dots | 11 hand-placed `<circle>`s | `#fig4-dots` group cleared and rebuilt, one circle per real respondent |
| Fig. 4 caption | `"Three respondents... two to..."` | `#fig4-caption` — sentence generated from real counts, sorted descending, all non-zero archetypes listed |
| Sticky margin note | `currently n=11` | `#js-n-sticky`, plus `#js-cache-note` (hidden by default) |
| Limitations §7 | `n=11 supports directional description` | `#js-n-limits` |

That's the "abstract, section 4 intro, Fig. 2 sample-size labels, Fig. 3 band bars, sticky margin note, footer/last-line reference" list from the brief — the last two both point at the same sticky gutter-note element, which sits immediately above the `<footer>` and is the last n-reference before it; there's no separate literal `n=11` inside the `<footer>` tag itself (confirmed by grep — the footer only has attribution text).

**Fig. 4 dot placement**, same visual approach as the hand-placed version it replaces: each respondent sits on the line between the diagram's center and their matched archetype's fixed anchor point (the same 5 pentagon positions already in the SVG — those didn't move), pulled toward the anchor in proportion to `matchPct` (clamped to [0.15, 0.85], same bounds `survey_etl.py`'s own population-dot-graph uses), with a small deterministic (index-derived, not random) jitter so equal-strength respondents don't stack exactly on top of each other. Distance from anchor is inversely related to match strength, per the brief.

**Fails gracefully — verified as an actual separate path, not just written and assumed.** Every value is computed into a plan object (`planFig2`/`planFig3`/`planFig4`) *before* any DOM write; if the response is malformed or a category is missing, the plan functions throw and the render is caught before touching a single element. On any failure — network error, timeout, CORS, backend down — the catch handler is a no-op on the existing static markup (nothing to "restore," it was never touched) and only unhides a small `#js-cache-note` reading "(showing cached figures)." No blank page, no thrown error surfaced to the user.

---

## 3. Verification — the actual point of this section

**Not just "the endpoint returns correctly."** Built a headless-DOM test harness (`jsdom`, scratchpad-only, not committed) that loads the real `index.html`, executes the real inline script, and inspects the real resulting DOM:

- **Success path**, fetch pointed at real production Firestore data: sample-size spans all became `36`; Fig. 2's Food & Snacks bar recomputed to `left:28.6%, width:57.1%` against a scale that correctly widened to `₹3,500` (real Q3 of ₹3,000 exceeded the static ₹2,500 scale); Fig. 3 bars became `14/13/9` with proportional heights; Fig. 4 got 36 real `<circle>` dots (not 11); the caption became *"Population-level clustering, n=36. 13 respondents pattern-match closest to "Exam Grinder," 11 to "Social Trendsetter," 7 to "Gamer & Foodie," 3 to "Commuter Nomad," and 2 to "Zen Saver" — a directional signal, not yet a trustworthy classifier."* — a real generated sentence, not the old hardcoded one.
- **Failure path**, fetch made to reject: every span stayed at its original static value (`11`, `40%/55%`, 11 dots, the original caption), and the cache note became visible. Confirms the fallback isn't just written but actually preserves the static content under real failure.
- **Then did it again against the real, live, deployed page** — no mocking at all: fetched `https://antara.money/` for real, ran its real script against the real `https://api.antara.money/api/v1/public/survey-stats` over the real network, and got back `n=36`, bands `14/13/9`, 36 dots, and the generated caption — i.e., confirmed the actual production site, as a real visitor would load it, actually re-renders with live data. This is the "confirm the page actually re-renders with it" check the brief asked for, done against the real deployed artifact, not a local approximation.

**Backend verification**, similarly not just unit-level:
- `TestClient` confirmed the route requires no auth (no 401 without an `Authorization` header) and that a CORS preflight from `https://antara.money` returns `200` with the right `access-control-allow-origin`.
- Ran `build_public_stats_payload()` against fabricated 11-respondent data to confirm the exact shape (income bands sum to sample size, archetype counts sum to sample size, category fields match the brief's schema, `null` medians for a zero-response category) before ever touching production.
- Then verified against **real production Firestore** by running a second, temporary local `uvicorn` instance on a separate port (8099) with the production `.env` credentials — never touched the running `antara-ml.service` for this check, so production stayed on the old code until the deploy below.

## 4. Deployment

- `antara` (backend): committed (`9f811bc`) and pushed to `origin/main`. Production's `antara-ml.service` doesn't run with `--reload`, so the new route needed a restart to actually go live — did that (`sudo systemctl restart antara-ml.service`, non-interactive sudo succeeded), confirmed `active` and `/health` healthy afterward, then confirmed the new route itself over the public domain (`https://api.antara.money/api/v1/public/survey-stats` → real data, `n=36`).
- `antaraweb`: repo didn't exist locally: cloned fresh via SSH (`git@github.com:parthchhabraa/antaraweb.git`), confirmed its `CNAME` is `antara.money` and it's genuinely build-free (just `index.html` + `logo.jpg` + `CNAME` + `README.md`). Committed (`be08cfb`) and pushed to `origin/main`; polled `https://antara.money/` until GitHub Pages served the new content (~30s), then ran the live-page verification in §3.

## 5. Flagging, not fixing: pre-existing uncommitted work in this repo

Found while checking `git status` before committing — **not related to this step, not touched by it.** This repo's working tree already had a large uncommitted change set sitting on disk: a full Step 13 (editable monthly budget, transaction delete/edit, several new components — `BudgetSheet.tsx`, `TransactionEditSheet.tsx`, `ConsentGate.tsx`, the `/privacy`/`/terms` pages, etc.) plus its own finished-looking `REVIEW.md` claiming `ALL COMPLETED` — all of it still unstaged/untracked, never committed by whatever session produced it. The last actual commit on `main` (`2844e0e`) is still Step 11's (brand assets).

I did not touch, verify, or commit any of it — it's a different step's work I have no basis to vouch for blind, and silently sweeping it into a commit alongside this step's changes would misattribute it. What I did do: copied the uncommitted `REVIEW.md` draft to [REVIEW.step13-uncommitted-draft.md](REVIEW.step13-uncommitted-draft.md) before overwriting `REVIEW.md` with this step's review, so that draft isn't lost. The rest of the uncommitted files are untouched on disk exactly as found (`git status` still shows them). Flagging this for prioritization, not fixing it here.

---

## Verification performed

- Real production Firestore, twice: once via a temporary local `uvicorn` on port 8099 to validate the endpoint before any deploy, once again after restarting the real `antara-ml.service` to confirm the actual production route.
- `TestClient`-based checks: no-auth-required, CORS preflight correctness.
- Unit-level payload check against fabricated 11-respondent data (matches the brief's exact example shape).
- `jsdom` headless-DOM harness: both the success and failure render paths, against the real `index.html` file, with real assertions (12/12 passed) — not eyeballed.
- Final end-to-end check with **zero mocking**: fetched the real live `https://antara.money/`, executed its real shipped script against the real live `https://api.antara.money` over the real network, confirmed the resulting DOM actually shows `n=36` and real figures.
- `git status`/`git log` on both repos after each commit to confirm exactly the intended files moved and nothing stray was swept in.
- Temporary verification processes (the two port-8099 `uvicorn` instances) were both confirmed killed; production's `antara-ml.service` was the only thing left running, `active`, and confirmed on the new code via its own public endpoint.
