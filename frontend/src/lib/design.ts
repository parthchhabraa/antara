/**
 * Antara design system — foundation (Brief 6, 2026-09-05).
 *
 * This file is documentation-as-code: the actual enforcement lives in
 * tailwind.config.ts (type scale, radius scale, colors, fonts) and
 * globals.css (the self-hosted @font-face rules). Nothing here is
 * imported for its runtime values by component code today — it exists so
 * the *reasoning* behind those files has one place to live, and so a
 * future brief has house rules to check new UI against without having to
 * reconstruct them from a chat transcript.
 *
 * ── Why this exists ──────────────────────────────────────────────────
 * Before this brief, the app's type sizes were ~13 distinct arbitrary
 * pixel values (9, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 19, 26,
 * 34, 52, 54px, plus Tailwind's own 8-step default scale layered on top)
 * chosen ad hoc per component. Radii were a 5-step ladder (rounded-md
 * through rounded-3xl) used inconsistently. Violet meant brand,
 * interactive, selected, risk, and the FAB all at once. Depth came from
 * glow shadows, not surface value. None of that was a system — it was
 * defaults, accumulated. This brief replaces it with real tokens; briefs
 * 7-9 spend them as screens get rebuilt.
 *
 * ── Type scale: exactly six steps ───────────────────────────────────
 * 13 / 15 / 18 / 24 / 40 / 64 (px) — tailwind.config.ts's `fontSize`,
 * reachable via text-xs/sm/base(=lg)/xl(=2xl)/3xl(=4xl)/5xl. Nothing
 * smaller than 13 is allowed to exist in this app — it's used one-handed,
 * on a phone, in daylight. Every one of the old arbitrary values below
 * 13.5px collapses onto 13; nothing under that floor should ever be
 * reintroduced via an arbitrary `text-[Npx]` value.
 *
 * ── Typeface ─────────────────────────────────────────────────────────
 * IBM Plex Sans (`font-sans`, the default) for all text. IBM Plex Mono
 * (`font-mono`) for every rupee figure and every digit in a table or a
 * counter — real tabular figures, so digits don't visually jitter width
 * while CountUpNumber animates. Self-hosted under public/fonts/ (see
 * globals.css's @font-face block) — not a Google Fonts <link> — both to
 * drop a third-party request on a phone on Indian mobile data and to keep
 * a font CDN from ever seeing a visitor's IP.
 *
 * ── Color: state and brand never share a token ──────────────────────
 * `primary.*` (violet) is brand + interactive/selected chrome ONLY.
 * `signal.under` / `signal.watch` / `signal.over` (plus each one's
 * `-soft` background tint) are the ONLY colors allowed to represent
 * under-budget / approaching-limit / over-limit state — saturated and
 * flat, closer to printed ink than a gradient; never neon, never pastel.
 * These two ramps must never cross: a risk indicator never borrows brand
 * violet, and brand chrome never borrows a signal color, even when they'd
 * look "fine" together in one spot. `background`/`card`/`card-border` are
 * the neutral ramp on the dark ink base.
 *
 * Defined in tailwind.config.ts this brief; NOT yet wired into any
 * specific screen's state logic — every existing candidate (BurnGauge's
 * ring, the needs/wants split, wallet-negative-balance coloring) is
 * entangled with a design decision that belongs to whichever brief
 * actually rebuilds that screen (7-9), not a blind find-and-replace here.
 * Flagged rather than forced.
 *
 * ── Radius: two steps, plus the `full` shape keyword ────────────────
 * `rounded-sm` (12px) and `rounded-lg` (20px) — tailwind.config.ts's
 * `borderRadius`. `rounded-full` (pills, avatars, dots) is a shape, not a
 * step in this scale, and is untouched.
 *
 * ── Elevation ────────────────────────────────────────────────────────
 * No glow shadows. `shadow-glow-primary`/`glow-cyan`/`glow-pink` are
 * deleted outright (not re-tuned) — depth comes from surface value
 * (`card` vs `background`) and a plain border (`card-border`), never
 * from bloom.
 *
 * ── Motion ───────────────────────────────────────────────────────────
 * Untouched. lib/motion.ts's `springs.default`/`springs.snappy` are the
 * one part of the pre-existing system that was actually decided rather
 * than defaulted — see that file's own comments. Nothing here changes it.
 *
 * ── House rules for all UI work from here on ────────────────────────
 * No em dashes in user-facing copy. No emoji. No rainbow category
 * coloring. No checkmark bullet lists. No three-across feature card rows.
 * No bento grids. No dot-grid or radial-orb backgrounds. No sparkle
 * icons. No hover-only affordances (this is a touch product — anything
 * that only reveals on :hover is unreachable on a phone). No fake
 * testimonials.
 */

export {};
