# Antara Engineering Review — Step 11: Brand Assets

## Status
CONTINUE — Everything through §5's *commit* is done, verified live, and deployed. The one thing not done is the actual `git push` — this box has no GitHub credentials at all (no stored token, no SSH key, no `gh auth`), and I don't handle that gap myself: entering an API key/token into a credential store is on the same "don't do this regardless of request" list as passwords, so I'm not asking you to paste one to me either. The commit is real, local, clean, and ready — you (or a session with real push access) just needs to run `git push origin main`. Read §5 before assuming this is a small thing to wave off.

---

## 0. The files — a correction on how I actually got them

The brief says the two logo files were "in this brief's attached context." They weren't — I searched this box's entire filesystem for `logoAntara.png`/`logo-full.jpg` and found nothing, and no image content came through with the brief itself. Said so and asked before doing anything, rather than fabricating a placeholder and calling it your logo.

You then pasted both images directly into the chat. That got me *visual* access to them, but this environment doesn't hand me the actual file bytes for images pasted into a message — I checked (searched for anything landing on disk in the seconds after you sent them; nothing did). So I didn't literally save your PNG/JPG. What I did instead, and want to be upfront about: I found that **`survey.antara.money`'s own boot screen already ships the identical mark as inline SVG** — exact coordinates, exact hex colors (`#171717` black, `#3E7C99` steel blue) — since I'd pulled that page's source in an earlier step. That's the authoritative source I actually built from, not a freehand recreation of what I saw in the chat. Rendered it side-by-side against your pasted image to confirm the match before using it (see the "before generating variants" screenshot description below — same triangular split-A, same colors, same gap position). If you have the original files sitting somewhere I can reach (dropped into the repo, a URL, anywhere with real file access), I'll happily swap in the byte-exact originals — but what's live now is a precise vector reconstruction from your own already-deployed source, not a guess.

The wordmark ("ANTARA MONEY") is built the same way — as live SVG + text, not a rasterized image — using the exact typographic recipe (Georgia/Times New Roman serif, bold "ANTARA," tracked-out "MONEY" beneath) that same survey boot screen already uses. This sidesteps the brief's "check if the JPG's white background looks bad on dark" question entirely: there's no raster background to fight since it's not a raster export.

---

## 1. Added to the repo

**`frontend/public/brand/`** (real directory, not loose files):
- `logo-mark.svg` — the master vector, black/steel-blue, genuinely transparent gap (not painted white — see §2 for why that matters)
- `favicon.ico` — packed from 16/32/48px renders
- `apple-touch-icon.png` — 180×180, opaque near-black background (iOS convention; a transparent one looks broken on a home screen)
- `icon-192.png`, `icon-512.png` — PWA manifest icons, transparent
- `logo-mark-1024.png` — high-res master raster, general use
- `social-preview.png` — 1280×640, see §4

**Wired into `frontend/src/app/layout.tsx`**: `metadata.icons` (favicon, both manifest icon sizes, apple-touch-icon) and `metadata.manifest` pointing at a new `frontend/public/manifest.json`. Also dropped a copy at `frontend/src/app/favicon.ico` for Next.js's automatic App Router convention as a defensive fallback alongside the explicit config.

**Wordmark on the sign-in hero**: new `AntaraWordmark` component (mark + "ANTARA MONEY" lockup), added to the top of the hero in `page.tsx` — that screen previously had zero Antara branding on it at all, just the "Know where your month is heading" copy.

**Verified live** (both via `curl` and a real browser): `favicon.ico`, `manifest.json`, `apple-touch-icon.png`, `icon-512.png` all return `200` from `app.antara.money`; the hero wordmark and header mark both render correctly, confirmed via screenshots described in §4.

---

## 2. Color decision — stated explicitly, and one correction to the brief's own premise

**Decision: kept the in-app theme as-is, used the logo purely as a mark** — header icon, loader, favicon, sign-in hero — exactly the brief's own recommendation. Did not reskin the app around steel-blue.

**The correction**: the brief describes the current in-app theme as "emerald + gold (Step 7's deliberate Strain redesign)." That's the *original* Step 7 plan, but it's not what's actually live — partway through Step 7 itself, you shared the real mockup reference and the theme was reverted to **violet/indigo**, which is what's been running since (Steps 8-10 all built on violet). So the decision is: keep violet/indigo as the in-app theme, logo mark stays black/steel-blue as its own thing. Not a discrepancy I'm introducing now — just correcting which color the brief's own text was describing before stating the decision against the right baseline.

**Why "mark only" isn't just the safe default here, it's close to necessary**: white text (the wordmark's "ANTARA") has to render in white to be visible on the dark hero at all — the logo's own black half would simply vanish against a near-black background. So the mark's colors can only ever carry through the small icon itself, not through running text or theme-wide surfaces. That's a real constraint, not just a stylistic preference, and it's part of why "reskin everything steel-blue" was never a serious option once the mark had to sit on a dark UI.

---

## 3. Whoop-style loader — real load-state-driven, not a fixed-duration fake

New `AntaraLoader` (mark centered, `scale: [0.95,1.05,0.95]` + opacity pulse, `repeat: Infinity`, on the app's existing `#060709`) has **no internal timer** — it's purely presence-driven:
- `AppBootGate` (new, sits inside `AuthProvider` in `layout.tsx`) reads `AuthContext`'s real `loading` boolean and renders the loader only while it's true. That boolean already existed — nothing consumed it before this pass, meaning the app either blank-flashed or briefly showed the wrong screen (signed-out hero) while auth was still resolving. Now confirmed fixed: screenshotted the loader mid-pulse on a real page load, then confirmed it hands off cleanly to the real Today screen the instant auth resolves.
- `frontend/src/app/loading.tsx` — new, uses the same component via Next.js's own route-loading-UI convention (Suspense boundary during a route segment's server render), covering the "route transition" half of the brief separate from the auth-check half.

---

## 4. "Fix AI logos" audit — what I found, what I fixed, what doesn't exist

Checked every location the brief named, plus a broader grep for any other placeholder:

| Location | Found | Fixed |
|---|---|---|
| `layout.tsx` metadata | No icons config at all — Next.js's default favicon | Real `metadata.icons` + `metadata.manifest` |
| `manifest.json` | Didn't exist | Created, points at real icon files |
| `MobileFrame.tsx` header logo slot | A plain violet `<div>` with the text "A" in it — not an AI-generated image, but exactly the kind of stand-in the brief means | Replaced with the real `AntaraMark` SVG, no background chip needed |
| `README.md` header | **File doesn't exist at all** — this repo has no README, so there's no header/badge to fix. Didn't create one; that's a separate ask from "replace placeholder branding" and wasn't requested | N/A |
| GitHub repo social-preview image | **No public API to read or set this** — it's a GitHub web-UI-only setting (Settings → General → Social preview), confirmed by checking; I can't audit or fix it programmatically | Generated `frontend/public/brand/social-preview.png` (1280×640, real mark + wordmark, matches the hero's own gradient) for you to upload manually — one click at that Settings page |
| Broader grep (`>A<`, generic icon refs, leftover `next.svg`/`vercel.svg` starter assets) | Nothing else found | — |

**Every place the logo/favicon now actually appears**, concretely:
1. Browser tab favicon (`favicon.ico`) — all pages
2. iOS home-screen icon (`apple-touch-icon.png`) if added to home screen
3. PWA/Android install icon (`icon-192.png`/`icon-512.png` via `manifest.json`)
4. `MobileFrame.tsx` header, next to "Antara" — every screen except the immersive sign-in hero
5. Sign-in hero — full `AntaraWordmark` (mark + "ANTARA MONEY")
6. `AntaraLoader` — app boot / auth-check screen, and any route's Suspense loading state
7. `frontend/public/brand/social-preview.png` — ready for you to upload as the GitHub social-preview image (not automatically live anywhere yet — see the table above)

---

## 5. Push — committed, not pushed, and here's exactly why

**Committed**: yes. Set git identity (`user.name`/`user.email`, same as every prior session's own instructions to run this — finally actually done, since this brief explicitly authorized touching git, unlike prior passes where it was out of scope). Staged everything, including all the *previously* uncommitted work from Steps 6 through 10 — nothing had actually landed in git since a commit dated 2026-08-19, despite five full working sessions on top of it since. One commit (`86c8ef5`), honestly representing that history as what it is: work that happened incrementally in reality but never in version control.

**Not pushed**: `git push origin main` failed — `fatal: could not read Username for 'https://github.com': No such device or address`. Checked thoroughly: no `~/.git-credentials`, no `credential.helper` configured, no SSH private key for GitHub in `~/.ssh/`, no `GH_TOKEN`/`GITHUB_TOKEN` env var, `gh` CLI not installed. **There is genuinely no GitHub credential anywhere on this box.** This isn't a "didn't get to it" gap — I looked for every normal way this could work and none exist here.

I'm not asking you to paste a personal access token for me to configure — handling API keys/tokens directly is the same category of thing as handling a password, and I don't do that regardless of how the request is framed. What actually resolves this:
```bash
cd /home/parthchhabra/antara-deploy/antara
git push origin main
```
Run from anywhere that already has real push access to this repo (your own machine, most likely) — or set up a credential on this box yourself (`gh auth login`, or an SSH key added to your GitHub account) if you want future pushes to work directly from here.

---

## 6. Files Touched This Pass

**Brand assets (new)**
- `frontend/public/brand/` — `logo-mark.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `logo-mark-1024.png`, `social-preview.png`
- `frontend/public/manifest.json`
- `frontend/src/app/favicon.ico`

**Components (new)**
- [frontend/src/components/AntaraMark.tsx](frontend/src/components/AntaraMark.tsx) — the mark, inline SVG
- [frontend/src/components/AntaraWordmark.tsx](frontend/src/components/AntaraWordmark.tsx) — mark + "ANTARA MONEY" lockup
- [frontend/src/components/AntaraLoader.tsx](frontend/src/components/AntaraLoader.tsx) — Whoop-style pulse loader
- [frontend/src/components/AppBootGate.tsx](frontend/src/components/AppBootGate.tsx) — gates on real `AuthContext.loading`

**Wired in**
- [frontend/src/app/layout.tsx](frontend/src/app/layout.tsx) — icons/manifest metadata, `AppBootGate` wrapping children
- [frontend/src/app/loading.tsx](frontend/src/app/loading.tsx) — new, Next.js route-loading convention
- [frontend/src/app/page.tsx](frontend/src/app/page.tsx) — `AntaraWordmark` on the hero
- [frontend/src/components/MobileFrame.tsx](frontend/src/components/MobileFrame.tsx) — header logo slot replaced

**Infra**
- Rebuilt (`npm run build`, clean) and restarted `antara-frontend.service`; verified `favicon.ico`/`manifest.json`/`apple-touch-icon.png`/`icon-512.png` all `200` from `app.antara.money`, plus the Tailscale fallback still `200`
- `apt-get install librsvg2-bin imagemagick` on this box, used to generate the PNG/ICO variants from the master SVG

**Git**
- Local `user.name`/`user.email` set (first time — see §5)
- Commit `86c8ef5` — everything from this pass plus every uncommitted change since 2026-08-19 across Steps 6-10
- **Not pushed** — see §5

## 7. Access Summary (unchanged)
- **Public domain**: https://app.antara.money (app), https://api.antara.money (backend API)
- **Tailscale (fallback)**: http://100.103.94.116:3001 (app), http://100.103.94.116:8001 (backend API)
