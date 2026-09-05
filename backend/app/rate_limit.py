"""
Brief 4 (2026-09-05): per-uid rate limiting for a single-worker FastAPI
deployment. `antara-ml.service` runs one uvicorn process, no `--workers`
(see CLAUDE.md's repo-layout notes and the actual systemd unit) — so a
plain in-process dict, guarded by one lock, is correct here and avoids
adding a Firestore read/write to every single authenticated request just
to enforce a limit. State resets on a service restart, which only means a
fresh window starts, not that the limit stops applying — an acceptable
tradeoff for a limiter whose job is stopping a hot loop or a `curl` script,
not billing enforcement down to the request.

Two independent layers, matching the brief:
  - `enforce_general_rate_limit` — a per-uid cap on every authenticated
    route (superadmin-only routes are deliberately exempt; see main.py).
  - `enforce_llm_daily_limit` — a much tighter *daily* cap, applied on top
    of the general one, for the two routes that actually hit the 7B model
    on the shared GPU (/api/v1/ml/chat, /api/v1/ml/insights). Its cap is
    read from `admin/launchConfig.llmDailyMessageCap` (short-TTL cached, so
    a superadmin changing it takes effect within a minute with no redeploy
    and no per-request Firestore read either).

Both dependencies wrap `verify_firebase_token` and return the same
`current_user` dict unchanged, so a route can `Depends()` on one of these
in place of `verify_firebase_token` directly and get auth + rate limiting
from a single dependency. FastAPI caches a dependency's result per request
by default, so a route that depends on both `enforce_general_rate_limit`
and `enforce_llm_daily_limit` (both of which depend on
`verify_firebase_token`) still only verifies the token once.
"""
import logging
import os
import threading
import time
from typing import Dict, Tuple

from fastapi import Depends, HTTPException

from app.firebase_admin import get_firestore_client, verify_firebase_token

logger = logging.getLogger("antara.rate_limit")

# ── General per-uid limit, every authenticated (non-superadmin) route ──
GENERAL_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_GENERAL_PER_MINUTE", "60"))
_GENERAL_WINDOW_SECONDS = 60.0

# ── LLM daily cap, /ml/chat and /ml/insights only ──
LLM_DAILY_CAP_DEFAULT = int(os.getenv("RATE_LIMIT_LLM_DAILY_DEFAULT", "30"))
_LLM_CAP_CACHE_TTL_SECONDS = 60.0

_lock = threading.Lock()
_general_buckets: Dict[str, Tuple[int, float]] = {}  # uid -> (count, window_start_monotonic)
_llm_buckets: Dict[str, Tuple[int, str]] = {}  # uid -> (count, "YYYY-MM-DD" in UTC)
_llm_cap_cache: Dict[str, float] = {"value": float(LLM_DAILY_CAP_DEFAULT), "fetched_at": 0.0}


def _fixed_window_check(buckets: Dict[str, Tuple[int, float]], key: str, limit: int, window_seconds: float) -> Tuple[bool, int]:
    """Simple fixed-window counter (not sliding) — fine for this purpose:
    the failure mode of a fixed window (a burst right at a window boundary
    can momentarily allow ~2x the limit) doesn't matter for "stop a hot
    loop," and a fixed window is a few lines instead of a sorted deque per
    uid. Returns (allowed, retry_after_seconds)."""
    now = time.monotonic()
    with _lock:
        count, window_start = buckets.get(key, (0, now))
        if now - window_start >= window_seconds:
            count, window_start = 0, now
        count += 1
        buckets[key] = (count, window_start)
        if count > limit:
            retry_after = max(1, int(window_seconds - (now - window_start)))
            return False, retry_after
        return True, 0


async def enforce_general_rate_limit(current_user: dict = Depends(verify_firebase_token)) -> dict:
    """Every authenticated route (except superadmin-only ones, which stay
    exempt — see main.py's admin/* routes) depends on this instead of
    verify_firebase_token directly. Superadmin is exempt here too, matching
    the bypass posture every other access check in this app already has
    (firestore.rules' isSuperAdmin() bypasses, require_superadmin's own
    routes are separately gated) — a superadmin doing real admin work
    shouldn't be capped by the same limit a single teen's normal usage is."""
    if current_user.get("role") == "superadmin":
        return current_user
    uid = current_user["uid"]
    allowed, retry_after = _fixed_window_check(_general_buckets, uid, GENERAL_LIMIT_PER_MINUTE, _GENERAL_WINDOW_SECONDS)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"You're doing that a bit too fast — try again in {retry_after} second{'s' if retry_after != 1 else ''}.",
        )
    return current_user


def _get_llm_daily_cap() -> int:
    """Reads admin/launchConfig.llmDailyMessageCap, cached for up to a
    minute so a busy chat screen doesn't turn into a Firestore read on
    every single message. Falls back to LLM_DAILY_CAP_DEFAULT if the field
    is missing, non-numeric, or Firestore is unreachable — a config read
    failing should never accidentally make the cap infinite."""
    now = time.monotonic()
    if now - _llm_cap_cache["fetched_at"] < _LLM_CAP_CACHE_TTL_SECONDS:
        return int(_llm_cap_cache["value"])
    cap = LLM_DAILY_CAP_DEFAULT
    try:
        db = get_firestore_client()
        if db is not None:
            snap = db.collection("admin").document("launchConfig").get()
            if snap.exists:
                configured = (snap.to_dict() or {}).get("llmDailyMessageCap")
                if isinstance(configured, (int, float)) and not isinstance(configured, bool) and configured > 0:
                    cap = int(configured)
    except Exception as e:
        logger.warning("Could not read llmDailyMessageCap, using cached/default value: %s", e)
    _llm_cap_cache["value"] = float(cap)
    _llm_cap_cache["fetched_at"] = now
    return cap


async def enforce_llm_daily_limit(current_user: dict = Depends(verify_firebase_token)) -> dict:
    """Applied ON TOP OF enforce_general_rate_limit for /ml/chat and
    /ml/insights specifically — those two routes both hit the 7B model on
    the one GPU this whole box has, so they get a much tighter cap than
    "every authenticated route" gets by default. Daily, UTC calendar day
    (not a rolling 24h window) — simplest to reason about for a user
    reading "resets tomorrow"."""
    if current_user.get("role") == "superadmin":
        return current_user
    uid = current_user["uid"]
    cap = _get_llm_daily_cap()
    today = time.strftime("%Y-%m-%d", time.gmtime())
    with _lock:
        count, day = _llm_buckets.get(uid, (0, today))
        if day != today:
            count, day = 0, today
        count += 1
        _llm_buckets[uid] = (count, day)
        if count > cap:
            raise HTTPException(
                status_code=429,
                detail=f"You've hit today's chat limit ({cap} messages). It resets tomorrow.",
            )
    return current_user
