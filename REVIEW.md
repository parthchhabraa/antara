# Antara Engineering Review — Step 11: Brand Assets

## Status
ALL COMPLETED — Everything's live with the real logo files, committed, and pushed. Short version of how this pass actually went: the files weren't attached to the brief as claimed, so I said so and built a precise reconstruction from a source I could verify (survey.antara.money's own shipped SVG) rather than guess or block. You then pasted the real images into chat; I still couldn't get the literal bytes from that. But setting up git push access (this message's actual ask) surfaced that **the real `logoAntara.png`/`logo-full.jpg` had already been uploaded straight to `origin/main` via GitHub's web UI** — so I pulled those in, regenerated every asset from the *actual* files (the real blue is `#0E87B0`, not the `#3E7C99` I'd traced), merged the two histories, and pushed. Also surfaced a much bigger thing while doing this that deserves its own flag, not a footnote: **the "separate" survey project isn't separate — it's built inside this same repo, on an unmerged branch, and never landed on `main`.** See §0 and §5.

---

## 0. Two corrections to how this pass actually went

**The files, take two.** My first pass (before you pasted the images) built the mark as a precise vector reconstruction from `survey.antara.money`'s own shipped SVG — reasonable, but an approximation, not the source. Once you pasted the real images in chat, I still had no file-system path to their exact bytes (checked again — nothing lands on disk from a pasted chat image in this environment). I said this plainly rather than quietly passing off the approximation as final.

Then, while setting up SSH push access for this message, `git fetch` turned up **`e8f43f6`, "logos upload"** — already on `origin/main`, authored by you today, adding the literal `logoAntara.png` (1170×1044, real alpha transparency — confirmed `srgba(0,0,0,0)` sampled directly from the gap band, not painted white) and `logo-full.jpg` (535×163, JPEG, opaque white background) at the repo root. **These are the actual files.** I pulled them in, saved them properly under `frontend/public/brand/originals/`, and regenerated every derived asset (favicon, apple-touch-icon, PWA icons, the `AntaraMark` component) from them directly instead of my earlier approximation. Removed the now-redundant loose copies you'd uploaded at the bare repo root (byte-identical to the organized copies, verified via `md5sum` before deleting) — the brief was explicit that loose-at-root isn't the right place for these.

**The bigger correction: your survey project isn't a separate repo.** Step 10 concluded "no local repo for this project on this box" and treated `survey.antara.money` as fully external, based on reading its live shipped bundle (correct as far as it went — that inspection method was sound). What I didn't know: it's actually built at `frontend/src/app/survey/` **inside this same repository**, on a remote branch (`claude/antara-spending-survey-6o4o2w`) that a different Claude Code session built and pushed, and that **branch was never merged into `main`**. It has its own `AntaraMark.tsx`/`AntaraWordmark.tsx` (under `components/survey/`, different path from what this pass built), its own static-export script for GitHub Pages, and — notably — its own independent fix for the exact same firestore.rules drift I found and fixed in Step 10 (commit `51dd1cc`, "sync repo firestore.rules with what's actually deployed"). Two sessions independently found and fixed the same gap on two different branches, neither aware of the other.

**I did not merge that branch into `main`.** That's a real product decision (whether the survey app should live in this repo's mainline, how to reconcile the duplicate brand components, whether its independent rules fix still matches what I deployed) — not something to fold in silently as a side effect of "let's set up push access." Flagging it here explicitly so it doesn't stay an invisible fork: `git log origin/claude/antara-spending-survey-6o4o2w` to see it, or ask me to actually review and merge it as its own pass.

---

## 1. Added to the repo

**`frontend/public/brand/`**:
- `originals/logoAntara.png`, `originals/logo-full.jpg` — the real source files, kept for provenance/future regeneration
- `favicon.ico`, `apple-touch-icon.png` (180×180), `icon-192.png`, `icon-512.png`, `logo-mark-1024.png` — all regenerated directly from the real `logoAntara.png` via ImageMagick (trim + resize), not from any reconstruction
- `social-preview.png` (1280×640) — real mark composited with the wordmark text treatment (see §4)

**Wired into `layout.tsx`**: `metadata.icons` + `metadata.manifest` → new `frontend/public/manifest.json`, plus `src/app/favicon.ico` for Next's automatic convention. All regenerated from the real file after §0's correction.

**Wordmark on the sign-in hero**: `AntaraWordmark` (mark + "ANTARA MONEY", live SVG text — not a raster export of `logo-full.jpg`, see §2 for why that's the right call even now that I have the real JPG). Verified live post-correction: real mark, correct vivid blue, correct geometry.

---

## 2. Color decision — unchanged, now on firmer ground

**Decision: kept the violet/indigo in-app theme, logo used purely as a mark.** (Brief describes the theme as "emerald+gold" — that's Step 7's *original* plan; it was corrected to violet/indigo partway through Step 7 itself once you shared the real mockup, which is what's actually been live since. Stating the decision against the real baseline.)

Now that I have the real `logo-full.jpg`: it confirms rather than changes the reasoning. It's a flat JPEG — can't have transparency at all — with **black** "ANTARA" text on white. Simply stripping the white background (even if I could cleanly matte a JPEG's compression-fuzzy edges, which is itself risky) wouldn't fix the actual problem: black text is invisible on the app's near-black background regardless of what's behind it. That's *why* `AntaraWordmark` renders "ANTARA" in white — not a stylistic swap, a legibility requirement once the real wordmark had to sit on a dark surface. The mark alone carries the black/steel-blue brand color; the running text can't.

---

## 3. Whoop-style loader — unchanged from the first pass, now rendering the real mark

`AntaraLoader` (breathing pulse, `repeat: Infinity`, no internal timer) + `AppBootGate` (gates on `AuthContext`'s real `loading` boolean, previously unconsumed) + `app/loading.tsx` (Next's route-loading convention). All confirmed still working after swapping `AntaraMark`'s internals from inline-SVG to the real image — screenshotted the loader mid-pulse on a real page load again post-fix.

---

## 4. "Fix AI logos" audit — unchanged findings, now backed by real assets

| Location | Found | Fixed |
|---|---|---|
| `layout.tsx` metadata | No icons config — Next's default favicon | Real `metadata.icons`/`manifest`, from the real file |
| `manifest.json` | Didn't exist | Created |
| `MobileFrame.tsx` header logo slot | Plain violet `<div>` with text "A" | Real `AntaraMark`, no background chip |
| `README.md` | **Doesn't exist** — nothing to fix | N/A |
| GitHub social-preview image | No public API to read/set it (web-UI-only) | Generated `social-preview.png` with the real mark for manual upload |

**Every place the logo/favicon now actually appears**: browser tab favicon; iOS home-screen icon; PWA/Android install icon; `MobileFrame` header (every screen but the hero); sign-in hero wordmark; `AntaraLoader` (boot + route transitions). All using the real asset as of this pass, verified live in a real browser after the §0 correction.

---

## 5. Push — done, and here's the full trail

**Set up SSH access** (this message's actual ask): generated a dedicated ed25519 keypair on this box, you added the public key to your GitHub account, verified with `ssh -T git@github.com` (`Hi parthchhabraa!`), switched `origin` from HTTPS to `git@github.com:parthchhabraa/antara.git`.

**First push attempt failed** — not on auth, on a real divergence: `origin/main` had moved (your `e8f43f6` upload) since my local branch's base. Did not force-push. Fetched, inspected `e8f43f6` first (found the real logo files — see §0), redid the brand assets from them, committed that fix, then a real (non-fast-forward, `ort`-strategy) merge of `origin/main` into local `main` — clean, no conflicts, since `e8f43f6` only added two files nothing else touched. One cleanup commit after (removing the now-redundant loose root-level copies). **Pushed successfully**: `e8f43f6..2072aa2 main -> main`, confirmed via a fresh `git fetch` that origin matches local exactly.

**Also surfaced, not merged**: `origin/claude/antara-spending-survey-6o4o2w` — see §0. Separate decision, flagged not actioned.

---

## 6. Files Touched This Pass

**Brand assets**
- `frontend/public/brand/originals/` — the real source files
- `frontend/public/brand/{favicon.ico,apple-touch-icon.png,icon-192.png,icon-512.png,logo-mark-1024.png,social-preview.png}` — all regenerated from the real source
- `frontend/public/manifest.json`, `frontend/src/app/favicon.ico`

**Components**
- [frontend/src/components/AntaraMark.tsx](frontend/src/components/AntaraMark.tsx) — renders the real image (was inline-SVG approximation)
- [frontend/src/components/AntaraWordmark.tsx](frontend/src/components/AntaraWordmark.tsx), [AntaraLoader.tsx](frontend/src/components/AntaraLoader.tsx), [AppBootGate.tsx](frontend/src/components/AppBootGate.tsx) — unchanged from first pass

**Wired in**
- [frontend/src/app/layout.tsx](frontend/src/app/layout.tsx), [frontend/src/app/loading.tsx](frontend/src/app/loading.tsx), [frontend/src/app/page.tsx](frontend/src/app/page.tsx), [frontend/src/components/MobileFrame.tsx](frontend/src/components/MobileFrame.tsx)

**Infra**
- `apt-get install librsvg2-bin imagemagick` (still used for the social-preview composite)
- Rebuilt + restarted `antara-frontend.service` twice (once per asset-fidelity pass); all endpoints re-verified `200` after each

**Git**
- New dedicated SSH keypair (`~/.ssh/id_ed25519_github`), `origin` switched to SSH
- 5 commits this pass (redesign/ML/streaks/domain/ETL/brand catch-up, brand asset fix, merge, root-file cleanup, plus the earlier REVIEW.md doc commit) + the merge of `e8f43f6`
- **Pushed**: `origin/main` now at `2072aa2`, confirmed in sync

## 7. Access Summary (unchanged)
- **Public domain**: https://app.antara.money (app), https://api.antara.money (backend API)
- **Tailscale (fallback)**: http://100.103.94.116:3001 (app), http://100.103.94.116:8001 (backend API)
- **Unmerged branch, flagged for your decision**: `origin/claude/antara-spending-survey-6o4o2w` — the actual survey app source, per §0
