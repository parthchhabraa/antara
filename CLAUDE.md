# Antara — working rules

## Every session ends with the work actually landed, not just built

This is the top of this file on purpose — it's a standing rule, not a
suggestion buried in context, because it's already been missed twice
(Steps 12 and 13 both sat fully built, live-tested, and even redeployed to
production — but uncommitted — for a full extra session each before anyone
caught it; see `REVIEW.md`'s Step 15 section for the full story). Before
ending a session or writing the final review doc:

1. Run `git status` — in **every** repo touched this session, not just the
   one the brief was mostly about (Step 15 recovered work that spanned
   exactly this gap: the frontend was "done" but nobody ran `git status`
   in `antara`'s root and noticed `firestore.rules` and a dozen `frontend/`
   files sitting modified).
2. Commit everything meaningful. "Meaningful" includes docs/config, not
   just app code — a `REVIEW.md` update or a `firestore.rules` change left
   uncommitted is exactly as much of a gap as an uncommitted component.
3. `git push origin main` (or the relevant branch) — a local-only commit
   has the same "looks done, isn't actually landed" failure mode as no
   commit at all.
4. State the resulting commit hash(es) explicitly in the review doc — not
   "committed and pushed" as a bare claim, the actual short hash(es), so
   the next session (or a human) can verify directly with `git log` rather
   than trusting the write-up. Do this for every repo touched, if the work
   spans more than one (e.g. `antara` + `antaraweb`).

If a step is left intentionally uncommitted or partially done, say so
explicitly in the review's status line (`CONTINUE — ...`) and state why —
silence is what caused this problem twice, not a person deciding not to
commit.

---

## Repo layout

- `backend/` — FastAPI ML service (port 8001, systemd unit
  `antara-ml.service`), served publicly at `api.antara.money` via a named
  Cloudflare tunnel. `backend/app/ml/engine.py` is the cold-start heuristic
  engine; `backend/app/ml/survey_etl.py` is the Stage-1 survey pipeline
  that live-overlays real benchmarks onto it (Step 10) — see
  `POST /api/v1/admin/recompute-benchmarks`, not a script, when the survey
  sample grows and benchmarks need refreshing.
- `frontend/` — Next.js app (systemd unit `antara-frontend.service`,
  `next start -p 3001`), served at `app.antara.money`. No `--reload`/hot
  path in production — a `git`-committed source change still needs
  `npm run build` + a service restart to actually reach users; confirm via
  `/health`-equivalent checks after, not just a clean build.
- `frontend/src/app/survey/` — the anonymous spending survey, ported into
  `main` in Step 16 from a long-unmerged branch. Its actual public
  deployment is a **separate** repo (`antarasurvey`, GitHub Pages,
  `survey.antara.money`), built from this source via
  `scripts/export-survey-static.sh` — this route existing in `main` does
  not by itself mean `survey.antara.money` is up to date; that needs an
  explicit re-export + copy to `antarasurvey`, a separate action.
- `antaraweb/` is **not** in this repo — it's a separate plain-HTML/JS
  GitHub Pages site (`git@github.com:parthchhabraa/antaraweb.git`) serving
  the research paper at `antara.money`. Any brief touching that paper
  needs its own clone/commit/push cycle, distinct from this repo's.
- `firestore.rules` at the repo root is the source of truth Claude Code
  edits — but deploying it live is a separate action (Firebase console /
  `firebase deploy`, not part of a `git push` here). When in doubt whether
  the **live** ruleset matches this file, verify directly (the Firebase
  Rules REST API can fetch the actual deployed ruleset content) rather
  than assuming a committed file is a deployed one.
- No `STEPS.md`/changelog exists — each step's brief lives only in that
  session's chat history. `REVIEW.md` at the repo root is overwritten each
  step with that step's review (previous steps' reviews are recoverable
  from `git log -- REVIEW.md` if needed, not kept as separate files going
  forward except where a review was rescued from being uncommitted, e.g.
  `REVIEW.step13-uncommitted-draft.md`).
