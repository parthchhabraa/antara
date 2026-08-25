# Antara — Phase 2 continuation: live verification against real Ollama

**Status: ALL COMPLETED — this session ran locally on `draftsmanbrain` itself (confirmed: `hostname` returns `draftsmanbrain`, Tailscale shows this box as `100.103.94.116`), so the cloud session's one open item — "everything shipped against mocks only, no network path to the real box" — no longer applies. Ollama is installed, both models are pulled and confirmed responding, all three endpoints were exercised for real against a running Ollama instance and real Firestore data, a real confidence-calibration bug the mocks couldn't have caught was found and fixed, the archetype screen didn't exist and now does (built, wired to the real backend, screenshotted for real), and `claude/continue-sxrspn` is merged into `main`.**

This is a new entry, prepended above the cloud session's own `## Phase 2 Review` below — not overwriting it, per this session's brief. Everything below is this session's own verification; where I relied on the cloud session's own claims without redoing them (the `/review` move, the UI/copy polish pass beyond `PEER_ARCHETYPES`), that's stated explicitly, not implied.

---

## 1. Ollama setup on draftsmanbrain

Already installed before this session touched anything — `ollama version is 0.32.14` (snap package), running as `snap.ollama.listener.service`, already serving on `localhost:11434` with zero models pulled. Ran `scripts/setup-ollama.sh` as written (no changes needed): pulled both `qwen2.5:1.5b` (986 MB) and `qwen2.5:7b-instruct-q4_K_M` (4.7 GB), confirmed via `ollama list` and by generating a real completion from each.

**GPU: GTX 1660 Super, 6144 MiB total VRAM** (confirmed via `nvidia-smi`, matching the brief's own description).

**OLLAMA_KEEP_ALIVE / unload behavior — verified empirically, not assumed from docs:**
- Calling one model while the other is resident evicts the other automatically — confirmed directly (`ollama ps` before/after, `nvidia-smi` before/after): calling `qwen2.5:1.5b` while `qwen2.5:7b-instruct-q4_K_M` was loaded dropped VRAM from 4618 MiB to 1200 MiB in one step; the two were **never** simultaneously resident in any test this session ran.
- Fired two concurrent requests (one per model) and sampled VRAM every second through the transition: peak usage never exceeded 4618 MiB (the 7B model alone) — Ollama serializes the loads on this single-GPU box rather than trying to hold both, so there's no double-residency spike risk even under concurrent load.
- Confirmed the actual 5-minute default idle-unload fires, not just assumed present because nothing overrode it: fired a request, then polled `ollama ps`/`nvidia-smi` every 20s for 5 minutes. VRAM held at 4618 MiB with a shrinking "until" countdown the whole time, then dropped to 1 MiB at **exactly t=300s**. This is the real mechanism `ollama_client.py`'s design (never setting `OLLAMA_KEEP_ALIVE`) depends on, and it does what the code assumes.

**VRAM headroom: safe, not close to OOM.** Peak observed usage (7B model alone, the larger of the two) was 4618 MiB of 6144 MiB — **1526 MiB of headroom**, and since the two models are never co-resident (confirmed above), the real worst case is "one model plus that headroom," not "both models at once" (which would be ~5.9 GB and genuinely risky). No OOM observed in any test this session ran, including the concurrent-request one.

**Latency, real numbers:**
- First-ever request after a fresh Ollama install/model pull: ~52s for `qwen2.5:1.5b` (almost entirely one-time CUDA/library initialization, not representative of steady-state — the *second* identical call to the same already-loaded model took 0.3s).
- Cold-load after an eviction (the realistic "someone hasn't used this feature in a few minutes" case): ~4-5s for either model.
- Warm (`categorize`, `qwen2.5:1.5b`): ~380-420ms per real HTTP call to `POST /api/v1/ml/categorize`.
- Warm (`insights`/`chat`, `qwen2.5:7b-instruct-q4_K_M`): ~1-2s per real HTTP call once the model is loaded; ~6.7s the one time it required a cold model-switch from `1.5b`.

---

## 2. Re-ran the integration against live Ollama — found and fixed a real bug the mocks couldn't catch

**`/categorize` — a real, significant gap, not a mock-vs-reality nuance.** The original system prompt told the model to "use a low number for a vague or ambiguous description rather than guessing high." Against the real `qwen2.5:1.5b`, this instruction did nothing: `"paid 200"`, `"stuff"`, `"xyz"`, `"123"`, `"idk"`, even `"asdkfj random gibberish xyz"` **all came back confidence 0.95** (occasionally 1.0), every time. Since `CATEGORIZE_CONFIDENCE_THRESHOLD` is 0.55, this meant the staged-honesty gate the brief specifically asked me to check ("respects staged-honesty, low confidence → needs review, not forced") was **effectively dead code in practice** — everything got auto-applied with a fake-confident label, including total gibberish. The 14 mocked tests all passed because every mock supplied its own confidence value directly; none of them exercised whether the *real model* would actually produce a low one for a vague input.

Fixed by anchoring the prompt with concrete before/after examples instead of an abstract instruction (small instruction-tuned models are a documented weak spot for calibrated self-reported confidence — an anchor works where an instruction alone doesn't). Verified live, repeatedly: vague/gibberish input now consistently returns confidence 0.1-0.25 (correctly triggers `needs_review`); clear, specific descriptions stay at 0.9-0.95. Also caught and fixed two **confidently-wrong** miscategorizations live testing surfaced (a different problem than confidence calibration — the model was sure and wrong): `"Metro card recharge"` → `mobile-recharge` instead of `transportation`, and `"Gym membership fee"` → `subscriptions` instead of `fitness`. Added disambiguating examples for those two specific, real confusions (not guessed ones) — verified fixed, and that the fix didn't regress anything else (re-tested a dozen other real descriptions, all still correct).

One more real-world quirk the live model surfaced that mocks wouldn't: it sometimes returns `"confidence": "0.9"` as a **JSON string** rather than a number. The existing `float(parsed.get("confidence", 0.0))` cast already handles this correctly — no code change needed, but worth recording since it's exactly the kind of "response format" difference the brief asked me to watch for.

**Manually exercised all three endpoints with real requests, against the real running backend (a temporary local instance on a separate port, never the production `antara-ml.service`) with real Firebase auth tokens and real/synthetic Firestore data:**

- **`/categorize`** — 11/11 real HTTP requests matched expectation after the fix: unambiguous descriptions get high confidence and the right category; genuinely vague ones (`"paid 200"`, `"stuff"`, `"xyz"`, `"idk"`) correctly come back `needs_review: true`, `category_id: null` — never forced.
- **`/insights`** — created 5 clearly-labeled, isolated test transactions (a category with no pre-existing real data, so nothing mixed with the account's real spend) to trigger a genuine ≥15% mover, then deleted them after. Real response: *"This week's spending on movies and entertainment is ₹800, which is 500% more than usual."* — the exact computed numbers (₹800, 500%), no invented figures. Also verified the templated (non-LLM) fallback for real by pointing a second instance at an unreachable Ollama URL: *"You've spent 800% more on Movies & entertainment this week (₹600) than your usual ₹67/week."* — still grounded, still real numbers, model or no model.
- **`/chat`** — asked three real questions against the same test data: "How much have I spent on movies and entertainment recently?" → correct real total (₹1200); "What's my biggest spending category?" → correctly identified the real biggest category and amount; **"Did I spend more than 5000 rupees on clothes this month?"** → *"Your data doesn't include spending on clothes, so we can't determine if you spent more than 5000 rupees on them."* — asked about a category with zero real data, and it said so instead of inventing a number. This is the specific "doesn't answer from nothing" behavior the brief asked me to confirm, verified with a real adversarial-ish question, not just a friendly one.
- **Ownership boundary** — minted a real Firebase token for a throwaway, non-superadmin test uid (never associated with any real data) and confirmed: cross-user access to the superadmin's real data → real `403`; self-access with no data → honest "nothing to look at yet," no model call, real `200`. Cleaned up the throwaway auth user after.
- **Ollama-unreachable fallback** — pointed a temporary instance at a genuinely closed port and confirmed all three routes degrade the way the code says they do: `categorize` → `needs_review: true` in 36ms (fails fast, doesn't hang); `chat` → a plain "isn't reachable right now" message; `insights` → the templated fallback above. `/api/v1/admin/status`'s `ollama_reachable` correctly flips to `false` with the real connection error in `ollama_error`.

All test data (5 insight-mover transactions, 3 fallback-test transactions, 1 categorize-bug-repro transaction, 1 throwaway auth user) was created for this session and deleted/removed afterward — confirmed via a final Firestore read that the account is back to exactly its original 3 real transactions.

---

## 3. Archetype copy — no screen existed, so one was built and screenshotted for real

Independently re-confirmed the cloud session's own finding before building anything (didn't just trust it): `grep`ed `frontend/src` for `PEER_ARCHETYPES`/`archetype` — only the **admin-only** training-insights page and its `PopulationDotGraphCanvas.tsx` touch archetype data at all, and that component's own detail panel only shows `"Best match: X (Y% similarity) · total reported ₹Z"` for a *respondent* node — it never renders an archetype's `description` field either. So even the one existing archetype-adjacent screen doesn't show the copy that was reworded. Confirmed: genuinely nowhere in the app.

**Built `ArchetypeSheet.tsx`**, reachable from the Pull screen (`graph/page.tsx`, new "See your spending archetype" tap affordance under the Needs/Wants split) — calls `POST /api/v1/ml/dot-graph`, functional and unit-tested since Step 8 but with zero UI consumers until now (confirmed via its own docstring in `main.py`). Shows the user's closest-match archetype prominently (name, similarity %, real description) plus all 5 ranked patterns with their descriptions, same fetch-on-open/loading/error shape as the existing `WhyPredictionSheet`, same honest "sign in to see this" state for demo/guest (there's no per-user embedding to compute without a real account).

**Screenshotted for real, not just built and assumed correct.** The `claude-in-chrome` browser tool wasn't reachable in this environment (host client unreachable). Rather than skip the visual check, installed `playwright-core` + a headless Chromium locally (`sudo apt` for the missing system libs, same low-risk pattern as installing the JRE in Step 15) and rendered the actual running dev server in a real browser, at a real mobile viewport (430×932). Two real screenshots (see files sent alongside this review) confirm:
- The closest-match card (pink-tinted for "The Gamer & Foodie" in this test) renders with correct color-tinting, and the reworded description — *"Late-night Swiggy runs, a Discord/Spotify sub, and the odd battle pass — food and gaming are where the money goes."* — wraps cleanly across 3 lines, reads as a plain sentence, not spec-sheet copy.
- Scrolled to the bottom: all 5 archetypes' descriptions render fully, consistent spacing and typography, no clipping or overflow, "Got it" button visible and reachable.
- An "EARLY READ — NOT MUCH LOGGED YET" badge renders correctly for the cold-start case tested (real behavior, not staged).

(Used the real `/api/v1/ml/dot-graph` response's actual archetype data as the screenshot's content — fetched once from the live backend, then rendered through the sheet's real component code in a real browser. No visual bugs found; no changes were needed to the component after seeing it rendered.)

---

## 4. What this session did NOT re-verify (taken on the cloud session's own word, not silently assumed)

- The `/survey` → `/review` route move and its new consent gate — not re-tested interactively this session. Indirect confirmation only: this session's own full `npm run build` (run after this session's own changes) still shows `/review` building cleanly at 7.82 kB, so nothing this session touched broke it.
- The UI/copy polish pass on `WhyPredictionSheet.tsx` and `QuickLogSheet.tsx` (last-category-remembered via `localStorage`) — not re-clicked-through this session. Only `PEER_ARCHETYPES` (§3 above) was in this session's explicit scope.
- `firestore.rules` and its test suite — untouched by either session's commits; not re-run this session since nothing changed there.

---

## 5. Merge

Every item in this session's brief was verified against the real server, nothing failed, so per the brief's own instruction ("merge... do not merge if anything above fails or can't be verified"): **merged `claude/continue-sxrspn` into `main`.**

## Commit hashes

- `c2ce5c3` — cloud session's Phase 2 work (Ollama backend code, `/survey`→`/review`, UI polish) — unchanged by this session.
- `af4196b` — cloud session's own `REVIEW.md` commit — unchanged by this session (see its content below, kept intact).
- `00eb102` — this session: categorize confidence-calibration fix + `ArchetypeSheet.tsx` + wiring.
- This `REVIEW.md` commit is one more on top of `00eb102`, pushed to `origin/claude/continue-sxrspn` before merging.
- **Merge commit into `main`: see below** — recorded after the merge actually runs, same self-referential-hash reasoning `CLAUDE.md`'s own rule accounts for (a commit can't name itself from inside its own message).


---

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

Everything above (workstreams 1–3) is one commit on this branch, pushed to
`origin/claude/continue-sxrspn`:

- `c2ce5c3` (full hash `c2ce5c38f5e5ea5fa1a67068d1dc279f4653fb9b`) — local
  Ollama backend, `/survey` → `/review`, UI/copy polish pass.

This `REVIEW.md` update is committed on top of `c2ce5c3` as a follow-up
commit on the same branch/push — see `git log -1 --format=%H` on this repo
for that exact hash if it matters standalone; the substantive work is all
in `c2ce5c3` above. Confirmed `git rev-parse HEAD` == `git rev-parse
origin/claude/continue-sxrspn` immediately after each push (see
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
