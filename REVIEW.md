# Antara — Phase 2 Review

**Status: CONTINUE — two of three workstreams (the `/review` survey move, and
the UI/copy polish pass) are built, tested, and committed here. The third
(local Ollama) is code-complete and unit-tested against a mocked Ollama HTTP
layer, but the actual Ollama install/pull step on `draftsmanbrain` was NOT
done — this session had no SSH, Tailscale, or any other network path to that
host (verified: no `~/.ssh/config`, no `tailscale` binary, `draftsmanbrain`
doesn't resolve). `scripts/setup-ollama.sh` has the exact commands to run
there; nothing in this repo talks to a live Ollama runtime yet.**

---

## 0. A correction to this brief's own premises, made before touching anything

The brief said to verify the design language against the repo rather than
prior docs — good instinct, and worth actually doing rather than trusting
the brief's own color claim at face value. Checked `frontend/tailwind.config.ts`
directly: the app's real UI theme genuinely is violet/indigo (`primary`
family, `#8B5CF6`-ish) on a near-black (`#08090C`) background, matching the
brief. (The `#0E87B0` blue mentioned in this repo's own `REVIEW.md` history
is `frontend/src/lib/brand.ts`'s `BRAND_BLUE` — the *logo mark's* traced
color, a separate thing from the app's UI accent palette. No actual
contradiction once checked; flagging only because the brief's instruction to
verify rather than assume was exactly right to follow literally here.)

Two more premises in the brief didn't hold up against the actual repo and
are worth stating plainly rather than silently working around:
- **The anonymous survey had no consent gate or `/privacy`/`/terms` links
  before this session** (confirmed: `grep`ed `frontend/src/app/survey/page.tsx`
  and every file under `components/survey/` for "consent"/"privacy"/"terms"
  — zero matches). The signed-in app's `ConsentGate.tsx` component only
  gates the authenticated dashboard flow post-sign-in; it was never wired
  into the anonymous flow. Rather than assume one existed and skip this,
  added a real one (see §2).
- **There is no user-facing "dot-graph archetype screen" right now.**
  `grep`ed the whole frontend for `archetype_description`/`peer_archetypes`
  — zero matches anywhere in `frontend/src`. The per-user dot-graph endpoint
  (`POST /api/v1/ml/dot-graph`, and its `PEER_ARCHETYPES` data in
  `engine.py`) has been dormant with no UI consumer since Step 8 (see that
  endpoint's own docstring in `main.py`) — the only place archetype data
  currently renders at all is the **admin-only** training-insights
  population dot-graph. Polished the actual copy that exists (§3) rather
  than inventing a screen that isn't there to claim the brief's example was
  addressed literally.

---

## 1. Local Ollama — code complete, NOT installed/tested against a real model

**What's built** (`backend/app/ml/ollama_client.py`, `backend/app/ml/llm_features.py`,
three new routes in `backend/app/main.py`):
- `ollama_client.py` — thin `requests`-based client for `POST /api/generate`
  and `POST /api/chat` against `OLLAMA_BASE_URL` (default
  `http://localhost:11434`, overridable by env var). Every call logs model,
  path, and latency in milliseconds (`logger = logging.getLogger("antara.ollama")`)
  on both success and failure. Deliberately never sets a long/pinned
  `keep_alive` — `OLLAMA_KEEP_ALIVE` is read from the environment and passed
  through only if explicitly set, so Ollama's own default idle-unload (5
  min) is what actually keeps both models from trying to stay VRAM-resident
  at once on the 1660 Super's 6GB, per the brief's instruction not to try to
  pin both.
- `POST /api/v1/ml/categorize` — `qwen2.5:1.5b`. Free-text description in,
  `{category_id, category_name, confidence, needs_review}` out. Staged
  honesty enforced in code, not just prompted for: confidence
  `< 0.55`, an unparseable response, or a hallucinated category id outside
  the real 18-id `CATEGORIES_METADATA` taxonomy all come back
  `category_id: null, needs_review: true` — never a forced guess. Covered
  by 6 tests including the hallucinated-id case and an Ollama-unreachable
  case.
- `POST /api/v1/ml/insights` — `qwen2.5:7b-instruct-q4_K_M`. Computes
  this-week vs. prior-3-week-average per category in plain Python from real
  Firestore transactions *first*; only calls the model to phrase the single
  biggest real mover as one sentence, and only if the move is ≥15% (a
  finding, `computed`, is returned alongside `insight` specifically so a
  test — or a future caller — can check the sentence's numbers actually
  match what was computed, not just that a sentence came back). Falls back
  to a templated (non-LLM) sentence if Ollama is unreachable rather than
  going silent.
- `POST /api/v1/ml/chat` — same model. Fetches the caller's last 30 days of
  transactions, builds a compact per-category totals block, and that block
  — not open Firestore access — is the only spending data the model ever
  sees. A user with zero logged transactions gets a plain "nothing to look
  at yet" message without a model call at all.
- **Access boundary**: `insights`/`chat` both require a verified Firebase
  token *and* a new `_require_self_or_superadmin` check (`main.py`) — the
  token's own `uid` must match the `user_id` being read, or the caller must
  be superadmin. This is the same boundary `firestore.rules` already
  enforces for direct client reads of `users/{uid}/transactions`; since the
  Admin SDK bypasses rules entirely (same as every other server write in
  this file), this check is what actually stands in for that boundary on
  the server side — it's new code, added specifically so these two new
  routes don't introduce a bypass path Firestore itself would have
  blocked. `categorize` needs no such check — it only ever touches the
  description string in the request body, never stored data.
- `GET /api/v1/admin/status` now also reports `ollama_reachable` (a live
  `GET /api/tags` check) so a failed/never-installed Ollama is visible from
  the existing admin telemetry endpoint rather than only surfacing the
  first time a real feature call fails.

**Tested**: `backend/tests/test_llm_features.py`, 14 new tests, all passing
locally (`pytest -q`: 17/17 total including the 3 pre-existing ML-engine
tests) — every Ollama HTTP call is mocked (`unittest.mock.patch` on
`app.ml.ollama_client.requests.post`), since there is no live Ollama
reachable from this sandboxed session. These verify: confident results are
applied, low-confidence/unparseable/hallucinated results all flag
`needs_review` rather than guessing, an unreachable Ollama degrades safely
instead of crashing, `build_insight`'s computed numbers are correct and it
stays quiet with no meaningful mover or no transactions, `answer_chat`'s
model-facing context contains the real computed total (not something the
model could invent), and the new ownership check allows self/superadmin and
rejects cross-user access. **What these tests do NOT verify**: that a real
`qwen2.5:1.5b`/`qwen2.5:7b-instruct-q4_K_M` running in actual Ollama
produces good categorizations or good prose — that needs the real model,
which needs the real box.

**What's NOT done, stated plainly**: `scripts/setup-ollama.sh` (install +
`ollama pull` for both models + a reachability check) exists but has not
been run — this session has no SSH/Tailscale/any path to `draftsmanbrain`.
Someone needs to run that script on the actual box, and then this backend's
existing `OLLAMA_BASE_URL=http://localhost:11434` default should reach it
automatically (no code change needed once Ollama is actually up) — but that
final connection is unverified until someone does that and checks
`GET /api/v1/admin/status`'s new `ollama_reachable` field.

---

## 2. `/survey` → `/review` — moved, same schema, real consent added

`git mv frontend/src/app/survey frontend/src/app/review`. Reuses everything
that already existed rather than duplicating: same `survey_responses`
Firestore collection, same schema (`surveyApi.ts`, `types/survey.ts`
untouched), same components under `components/survey/`. Updated the two
things that referenced the old path mechanically:
`scripts/export-survey-static.sh` (looks for `review.html`/`review/index.html`
now, not `survey.html`) and `next.config.js`'s comments. `CLAUDE.md`'s
repo-layout section updated to point at `frontend/src/app/review/`.
`survey.antara.money` (the actual public domain name) is unchanged — this
was a route rename inside the app, not a domain change.

**Added, not previously present** (see §0): a required consent checkbox on
the intro step — "I'm okay with sharing anonymous answers about my own
spending" plus working links to `/privacy` and `/terms` (both pre-existing
pages, untouched) — gating the `primaryDisabled` prop the "Start survey"
button already supported. Kept it lighter than the signed-in `ConsentGate`
(no guardian-awareness language) since this flow collects no PII and has no
account, but it's a real, required checkbox now, not decorative text.

**Verified**: `npx tsc --noEmit` clean after clearing the stale `.next`
type cache the directory rename left behind. `npm run build` clean, 11/11
pages, `/review` present at 7.93kB. Ran
`CUSTOM_DOMAIN=survey.antara.money ./scripts/export-survey-static.sh` end to
end against the moved route — succeeds, output has the `CNAME` file and the
real category/schema content. **Did not copy this export to the separate
`antarasurvey` repo or touch the live `survey.antara.money` site** — this
brief scoped the work to "a route within the existing Next.js app," not a
redeploy, and a live public-site push for a teen-facing survey is exactly
the kind of outward-facing action that should be asked for explicitly
rather than bundled in — the export is verified and ready whenever that's
wanted. Rebuilt in normal (non-static-export) mode immediately after
verifying the export, so `.next` wasn't left in a `next start`-incompatible
state (the same mistake Step 16 caught and fixed in itself).

---

## 3. UI polish — targeted, not exhaustive

Given the size of this brief's other two workstreams, this pass hit the
brief's own named examples plus what `grep` actually turned up, rather than
attempting a file-by-file sweep of the whole app:

- **`WhyPredictionSheet.tsx`** — the literal example in the brief.
  "Early estimate · logged X/14 days" → "Still learning your habits · day X
  of 14"; "Personalized · trained on X days" → "Tuned to you · X days of
  your own logging"; the mode pill "Early estimate"/"Personalized" →
  "Still learning"/"Tuned to you"; the error-state line softened from
  "Personalized insights unavailable right now" to "Couldn't reach your
  personalized read just now." The underlying `is_cold_start` /
  `data_days_logged` distinction driving all of this is completely
  untouched — tone only, per the brief's own constraint.
- **`QuickLogSheet.tsx`** — friction reduction. The category picker
  previously always defaulted to the first category in the list on every
  open; now remembers the last category actually logged
  (`localStorage`, wrapped in try/catch for private-mode/unavailable
  storage) and defaults to that instead — a real tap saved on the common
  case of logging a few similar things in a row, without changing the
  layout or adding a step.
- **`PEER_ARCHETYPES` descriptions (`backend/app/ml/engine.py`)** — the
  brief's named example ("Zen Saver / Commuter Nomad / …"), reworded from
  spec-sheet phrasing ("Spends predominantly on...", "Prioritizes...") to
  plain sentences. As noted in §0, this data currently has no live
  frontend consumer to visually confirm against — the change is verified
  by re-running the backend test suite (unaffected, since no test asserts
  on this exact string) and by reading the diff directly, not by seeing it
  rendered.
- **Did not** rewrite the admin-only `PopulationDotGraphCanvas.tsx` detail
  panel ("Best match: X (Y% similarity)") — that's an internal
  superadmin analytics tool, not the teen-facing surface this pass is
  about, and "spec sheet" precision is arguably correct there.

---

## Commit hashes (`antara` repo, branch `claude/continue-sxrspn`)

Everything above is one commit on this branch, pushed to
`origin/claude/continue-sxrspn`:

- See `git log -1 --format=%H` immediately after this commit for the exact
  hash — per this file's own top-of-file rule, this section can't state its
  own commit's hash from inside itself. Confirmed identical to
  `origin/claude/continue-sxrspn` immediately after pushing (see
  Verification below).

`antarasurvey` — **not touched this session** (no redeploy was done; see §2).

---

## Verification performed

- Confirmed no SSH/Tailscale/network path to `draftsmanbrain` exists in this
  session (`~/.ssh/config` absent, no `tailscale` binary, hostname doesn't
  resolve) before writing `scripts/setup-ollama.sh` as an unrun script
  rather than claiming Ollama was installed.
- Checked `frontend/tailwind.config.ts` directly to confirm the brief's
  violet/near-black design-language claim against the actual repo, not
  prior docs (see §0).
- `grep`ed the actual repo for "consent"/"privacy"/"terms" in the survey
  flow and for `archetype_description`/`peer_archetypes` anywhere in the
  frontend before asserting the two gaps in §0 — not assumed either way.
- Backend: `pytest -q` — 17/17 passing (3 pre-existing MLEngine tests + 14
  new `test_llm_features.py` tests), all new Ollama calls mocked since none
  is reachable here. Verified the FastAPI app itself boots and registers
  the three new routes (`TestClient` smoke check against `/health` and
  route listing).
- Frontend: `npx tsc --noEmit` clean (after clearing the stale `.next` type
  cache the `git mv` left behind), `npm run build` clean (11/11 pages,
  `/review` included), `CUSTOM_DOMAIN=survey.antara.money
  ./scripts/export-survey-static.sh` run end-to-end against the moved
  route and its output inspected directly (CNAME, schema, categories) —
  not left in static-export mode after (rebuilt normal mode and confirmed
  `next build` succeeds hybrid-mode again).
- `npm --prefix frontend run test:rules` — real Firebase emulator run (not
  skipped): 10/10 Firestore rules tests still passing, confirming the
  unmodified `firestore.rules` still behaves as before (no rule changes
  were needed — the Admin SDK bypass + new `_require_self_or_superadmin`
  check in `main.py` is what stands in for rules on the new server-side
  reads, as explained in §1).
- `git status` run in **both** repos (`antara` and `antarasurvey`) before
  writing this section, per this file's own top-of-file rule —
  `antarasurvey` is clean/untouched, confirmed with nothing to commit
  there this session.

## What's unverified / left for a human or a future session

- Whether `qwen2.5:1.5b` and `qwen2.5:7b-instruct-q4_K_M` actually pull and
  run correctly on the real GTX 1660 Super, and whether their real output
  quality is good enough to ship — needs `scripts/setup-ollama.sh` run on
  `draftsmanbrain` itself, then exercising `/api/v1/ml/categorize`,
  `/insights`, `/chat` for real.
- Whether `antara-ml.service`'s existing environment already has
  `OLLAMA_BASE_URL` reachable as `http://localhost:11434` with no
  additional systemd config — likely yes (same box), not confirmed from
  here.
- The `/review` static export is built and verified locally but not copied
  to the `antarasurvey` repo or deployed — flagged in §2 as ready whenever
  that's explicitly wanted.
