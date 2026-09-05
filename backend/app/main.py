import os
import logging
import uvicorn
from fastapi import FastAPI, Depends, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any
from datetime import datetime

logger = logging.getLogger("antara.auth")

from app.schemas import (
    SpendPredictRequest, SpendPredictResponse,
    DotGraphResponse, HealthResponse, TransactionItem,
    CategorizeRequest, CategorizeResponse,
    InsightRequest, InsightResponse,
    ChatRequest, ChatResponse,
    LearningCurveResponse,
    AllocateBudgetRequest, AllocateBudgetResponse,
    AddFriendRequest, AddFriendResponse, UnfriendRequest,
    CompareCategoriesRequest, CompareCategoriesResponse,
)
from app.ml.engine import MLEngine
from app.ml import survey_etl, llm_features, ollama_client
from app import social
from app.firebase_admin import (
    initialize_firebase_admin, verify_firebase_token,
    require_superadmin, get_firestore_client, set_beta_claim
)

app = FastAPI(
    title="Antara ML Spend Prediction & Personalization API",
    version="1.0.0",
    description="FastAPI service for expense prediction, teen spend embeddings, and Obsidian dot graph physics"
)

# CORS Middleware config
#
# Step 9 (2026-08-21): switched from a wildcard ("*") to an explicit allowlist.
# This isn't just tidying — `allow_origins=["*"]` combined with
# `allow_credentials=True` is invalid per the CORS spec (browsers refuse a
# literal "*" origin on credentialed requests) and only ever "worked" because
# every real browser call up to now went through the Next.js rewrite proxy
# (next.config.js), making it same-origin from the browser's point of view —
# CORS was never actually exercised. Step 9 points the frontend at
# https://api.antara.money directly (see frontend/src/lib/api.ts's
# API_BASE_URL), making this a genuine cross-origin call for the first time,
# so the allowlist needs to be real. Keeps every existing access path — the
# Tailscale IP, LAN IP, and local dev — none of that narrows.
ALLOWED_ORIGINS = [
    # Production domain (Step 9) — app.antara.money is the frontend; the bare
    # apex is included too in case anything ever serves directly from it.
    "https://app.antara.money",
    "https://antara.money",
    # Tailscale (stable, private) — unchanged fallback access path.
    "http://100.103.94.116:3001",
    "http://100.103.94.116:8001",
    # LAN — unchanged fallback access path.
    "http://192.168.0.8:3001",
    "http://192.168.0.8:8001",
    # Local dev.
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    initialize_firebase_admin()
    # Step 10: load whatever Stage-1 survey-derived benchmarks were last
    # computed (admin/categoryBenchmarks) and overlay them onto the cold-start
    # heuristic's static fallback numbers. If nothing's been computed yet
    # (fresh deploy, or Firestore unreachable), this safely no-ops and the
    # Step 8 static numbers keep serving — never a startup failure either way.
    try:
        db = get_firestore_client()
        existing = survey_etl.load_benchmarks(db)
        if existing:
            applied = MLEngine.apply_live_benchmarks(existing)
            print(f"[+] Loaded existing survey benchmarks (n={existing.get('sampleSize')}), applied={applied}")
        else:
            print("[i] No admin/categoryBenchmarks doc yet — run POST /api/v1/admin/recompute-benchmarks once survey data exists")
    except Exception as e:
        print(f"[!] Warning: could not load survey benchmarks at startup: {e}")
    print("[+] Antara ML API service initialized on port 8001")

@app.get("/health", response_model=HealthResponse, tags=["System"])
@app.get("/api/v1/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    return HealthResponse(
        status="healthy",
        service="antara-ml-backend",
        port=8001,
        version="1.0.0",
        timestamp=datetime.utcnow()
    )

# Brief 2 (2026-09-04): closes the beta-allowlist email leak. admin/betaAllowlist
# used to be readable by any authenticated user purely so the client could
# check its own membership — which also meant it handed every beta tester's
# email address to every other signed-in account, including the very first
# stranger public signup would let in. Allowlist membership is now resolved
# here instead, server-side via the Admin SDK, and stamped onto the caller's
# own Firebase Auth custom claims (`beta: true/false`) — firestore.rules'
# isBetaAllowlisted() then checks request.auth.token.beta directly, which is
# both unreadable-by-the-client and free (no per-write Firestore get()).
@app.post("/api/v1/auth/sync-claims", tags=["Auth"])
async def sync_claims(current_user: dict = Depends(verify_firebase_token)):
    """
    Called by AuthContext on every sign-in / page load for a real,
    non-superadmin account. Resolves the caller's own beta-allowlist
    membership (by email, case-insensitive) against admin/betaAllowlist and
    writes the result onto their own uid's custom claims — a caller can
    only ever affect their own claims here (verify_firebase_token already
    ties `current_user` to the token's own uid; there's no user_id
    parameter to spoof).

    Fails closed: if Firestore is unreachable or the caller has no email,
    `beta` is stamped `false` rather than left stale/true. The client must
    force a token refresh (getIdTokenResult(true)) after calling this for
    the new claim to actually be visible — this endpoint only changes what
    the *next* minted token will contain.
    """
    uid = current_user["uid"]
    email = (current_user.get("email") or "").strip().lower()
    is_beta = False
    if email:
        db = get_firestore_client()
        if db is None:
            logger.warning("sync_claims: Firestore unavailable, failing closed for %s", uid)
        else:
            try:
                snap = db.collection("admin").document("betaAllowlist").get()
                if snap.exists:
                    emails = (snap.to_dict() or {}).get("emails", []) or []
                    is_beta = any((e or "").strip().lower() == email for e in emails)
            except Exception as e:
                logger.warning("sync_claims: allowlist read failed for %s: %s", uid, e)
    try:
        set_beta_claim(uid, is_beta)
    except Exception as e:
        logger.error("sync_claims: failed to write beta claim for %s: %s", uid, e)
        raise HTTPException(status_code=503, detail="Could not update beta status")
    return {"beta": is_beta}

@app.post("/api/v1/predict/spend", response_model=SpendPredictResponse, tags=["ML Prediction"])
async def predict_spending(
    req: SpendPredictRequest,
    current_user: dict = Depends(verify_firebase_token)
):
    """
    Computes forecasted categorical spend, burn rate, risk levels, and smart teen insights.
    Caches the forecast to Firestore `predictions/{uid}/{period}` when Firestore is reachable.

    Revived in Step 8 (2026-08-21) — this is what powers the "Why" screen reachable from
    BurnGauge's coaching line on the frontend (see frontend/src/components/WhyPredictionSheet.tsx
    and lib/api.ts's fetchSpendPrediction). Cold-start heuristic vs. trained-embedding mode is
    decided by MLEngine based on logged history, not guessed client-side — see `is_cold_start`/
    `model_mode` on the response, which the frontend labels honestly rather than presenting a
    heuristic guess as a confident prediction.
    """
    prediction = MLEngine.calculate_spend_predictions(
        user_id=req.user_id,
        transactions=req.transactions,
        monthly_budget=req.monthly_budget or 5000.0,
        period_days=req.period_days or 30
    )
    
    # Cache prediction in Firestore if available
    db = get_firestore_client()
    if db:
        try:
            period_key = datetime.utcnow().strftime("%Y-%m")
            pred_doc = db.collection("predictions").document(req.user_id).collection("periods").document(period_key)
            pred_doc.set(prediction.dict(), merge=True)
        except Exception as e:
            print(f"[!] Warning: Could not write prediction cache to Firestore: {e}")

    return prediction

@app.post("/api/v1/ml/dot-graph", response_model=DotGraphResponse, tags=["Personalization"])
async def get_dot_graph(
    req: SpendPredictRequest,
    current_user: dict = Depends(verify_firebase_token)
):
    """
    Computes learned spend embedding space and generates Obsidian-style force-directed
    graph nodes (user core, category gravity centers, peer archetypes) and physics springs.

    Not currently called by the frontend — the Pull screen (frontend/src/components/
    PullCanvas.tsx) uses its own pure client-side two-pole need/want layout, and Step 8's
    ML revival scoped the frontend wiring to the "Why" prediction screen only (predict_spending
    above), not this dot-graph. Left fully functional and unretired (no dormant-by-design
    notice) since Step 8 reversed that framing — it just doesn't have a UI consumer yet.
    """
    return MLEngine.generate_dot_graph(
        user_id=req.user_id,
        transactions=req.transactions
    )

@app.post("/api/v1/ml/learning-curve", response_model=LearningCurveResponse, tags=["Personalization"])
async def get_learning_curve(
    req: SpendPredictRequest,
    current_user: dict = Depends(verify_firebase_token)
):
    """
    A real, per-user confidence-over-time curve for the Pull screen — not an
    illustrative chart. Replays MLEngine's own confidence formula against the
    caller's own real logged days (see MLEngine.calculate_learning_curve),
    the same formula predict_spending uses for "right now," just walked
    across their actual history so the curve is genuinely theirs, not a
    generic shape every user would see. Same request/auth shape as
    /predict/spend and /ml/dot-graph — transactions are supplied by the
    caller (already the client's own data), not re-fetched from Firestore.
    """
    points = MLEngine.calculate_learning_curve(transactions=req.transactions)
    return LearningCurveResponse(user_id=req.user_id, points=points)

@app.post("/api/v1/ml/allocate-budget", response_model=AllocateBudgetResponse, tags=["Personalization"])
async def allocate_budget(
    req: AllocateBudgetRequest,
    current_user: dict = Depends(verify_firebase_token)
):
    """
    "Instances" — the user pins exact amounts to whichever categories they
    choose; this computes a real suggested split of whatever's left across
    everything else, proportional to that category's own real historical
    spend (see MLEngine.allocate_budget for the full fallback chain and
    staged-honesty flagging). Same request/auth shape as /predict/spend —
    the caller supplies its own already-fetched transactions.
    """
    result = MLEngine.allocate_budget(
        transactions=req.transactions,
        monthly_budget=req.monthly_budget,
        pinned=req.pinned,
    )
    return AllocateBudgetResponse(user_id=req.user_id, **result)

def _require_self_or_superadmin(current_user: dict, user_id: str) -> None:
    """Same access boundary as everywhere else a request carries a
    `user_id`: a valid token alone isn't enough, it has to be *that* user's
    own token (or a superadmin's). Firestore rules already enforce this for
    direct client reads of `users/{uid}/transactions` (see firestore.rules);
    this backend reads that same collection via the Admin SDK, which
    bypasses rules entirely, so this check is what actually stands in for
    them here — the point being no new bypass path is introduced by the
    Ollama-backed endpoints below just because the SDK could technically
    read anyone's data."""
    if current_user.get("uid") != user_id and current_user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Cannot access another user's data")


# ── Social: friends, badges, privacy-preserving comparison (app/social.py) ──
# Every route below identifies the caller ONLY from their verified token's
# own uid (current_user["uid"]) — never from a client-supplied field in the
# request body — since these routes mediate writes/reads that touch a
# second person's data and a spoofable "who am I" field would defeat the
# whole point of doing this server-side in the first place.

@app.post("/api/v1/social/friend-token", tags=["Social"])
async def get_friend_token(current_user: dict = Depends(verify_firebase_token)):
    """Returns the caller's own stable friend_token, generating one on
    first call. Used to render their "Add me" QR code."""
    db = get_firestore_client()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore unavailable")
    token = social.ensure_friend_token(db, current_user["uid"])
    return {"friend_token": token}

@app.post("/api/v1/social/add-friend", response_model=AddFriendResponse, tags=["Social"])
async def add_friend(req: AddFriendRequest, current_user: dict = Depends(verify_firebase_token)):
    """Completes a friendship from a scanned QR/NFC token — see
    app/social.py's add_friend_by_token for the mutual, atomic write."""
    db = get_firestore_client()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore unavailable")
    try:
        result = social.add_friend_by_token(db, current_user["uid"], req.friend_token)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return AddFriendResponse(**result)

@app.post("/api/v1/social/unfriend", tags=["Social"])
async def unfriend(req: UnfriendRequest, current_user: dict = Depends(verify_firebase_token)):
    """Removes a friendship, both directions, atomically."""
    db = get_firestore_client()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore unavailable")
    social.remove_friend(db, current_user["uid"], req.friend_uid)
    return {"status": "removed"}

@app.post("/api/v1/social/compare-categories", response_model=CompareCategoriesResponse, tags=["Social"])
async def compare_categories(req: CompareCategoriesRequest, current_user: dict = Depends(verify_firebase_token)):
    """Privacy-preserving category comparison against a real friend — see
    app/social.py's compare_category_shares for the full bucketing logic
    and the hard "no rupee figure ever leaves this function" rule. Requires
    a real, currently-existing friendship (checked server-side against
    Firestore, not trusted from the client) — a 403 here is a real privacy
    boundary, not just a UI nicety."""
    db = get_firestore_client()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore unavailable")
    try:
        result = social.compare_category_shares(db, current_user["uid"], req.friend_uid)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return CompareCategoriesResponse(**result)


@app.get("/api/v1/admin/status", tags=["Superadmin"])
async def get_admin_status(admin_user: dict = Depends(require_superadmin)):
    """
    Protected superadmin endpoint to retrieve backend telemetry and model status.
    """
    ollama_reachable, ollama_error = ollama_client.health()
    return {
        "status": "operational",
        "superadmin_email": admin_user.get("email"),
        "port": 8001,
        "ports_guarded": [5000, 8000],
        "systemd_unit": "antara-ml.service",
        "tunnel_configured": True,
        "live_survey_benchmarks_applied": MLEngine.live_benchmarks_applied,
        "live_survey_benchmarks_sample_size": MLEngine.live_benchmarks_sample_size,
        "live_survey_benchmarks_computed_at": MLEngine.live_benchmarks_computed_at,
        "ollama_reachable": ollama_reachable,
        "ollama_error": ollama_error,
        "ollama_categorize_model": ollama_client.CATEGORIZE_MODEL,
        "ollama_chat_model": ollama_client.CHAT_MODEL,
    }

# ── Phase 2: local-Ollama-backed features ──
# Every call here goes to http://localhost:11434 only (app/ml/ollama_client.py)
# — nothing in this block, or anything it calls, is allowed to reach an
# external LLM API. Categorization is open to any authenticated user (it
# doesn't touch anyone's stored data, just a description string handed in
# the request); insights/chat both read the target user's own Firestore
# transactions server-side, so both are gated by _require_self_or_superadmin
# to keep that boundary matching what firestore.rules already enforces for
# direct client reads of the same collection.

@app.post("/api/v1/ml/categorize", response_model=CategorizeResponse, tags=["LLM"])
async def categorize_transaction(
    req: CategorizeRequest,
    current_user: dict = Depends(verify_firebase_token)
):
    """
    Free-text transaction description -> best-fit category id + confidence,
    via the local qwen2.5:1.5b model. Staged honesty: a low-confidence or
    unparseable result comes back with category_id=null, needs_review=true
    — never forced into a category the model wasn't actually sure about.
    """
    result = llm_features.categorize_transaction(req.description, req.amount)
    return CategorizeResponse(
        category_id=result["category_id"],
        category_name=result["category_name"],
        confidence=result["confidence"],
        needs_review=result["needs_review"],
    )

@app.post("/api/v1/ml/insights", response_model=InsightResponse, tags=["LLM"])
async def get_spend_insight(
    req: InsightRequest,
    current_user: dict = Depends(verify_firebase_token)
):
    """
    Short, human-readable nudge about the caller's own recent category-level
    spend (e.g. "You've spent 40% more on snacks this week than usual"),
    generated by the local qwen2.5:7b-instruct model. Every number in the
    sentence is computed here in Python from real Firestore data first —
    the model is only ever asked to phrase numbers it was handed, never to
    produce or adjust them (see llm_features.build_insight).
    """
    _require_self_or_superadmin(current_user, req.user_id)
    db = get_firestore_client()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore unavailable — cannot compute insight")
    result = llm_features.build_insight(db, req.user_id)
    return InsightResponse(user_id=req.user_id, insight=result["insight"])

@app.post("/api/v1/ml/chat", response_model=ChatResponse, tags=["LLM"])
async def chat_with_assistant(
    req: ChatRequest,
    current_user: dict = Depends(verify_firebase_token)
):
    """
    Natural-language Q&A about the caller's own spending. Fetches their real
    recent transactions first and hands the model a computed numeric
    summary as context (see llm_features.answer_chat) — the model answers
    from that summary, never from nothing and never from raw unrestricted
    Firestore access.
    """
    _require_self_or_superadmin(current_user, req.user_id)
    db = get_firestore_client()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore unavailable — cannot fetch spending data")
    result = llm_features.answer_chat(db, req.user_id, req.message)
    return ChatResponse(
        user_id=req.user_id,
        answer=result["answer"],
        grounded_on_transaction_count=result["grounded_on_transaction_count"],
    )

# ── Step 10: Survey ETL / Stage-1 training stats / superadmin data config ──
# All three endpoints below are superadmin-only (require_superadmin) — the
# raw stats and the ability to change what feeds the ML heuristic aren't
# public. See backend/app/ml/survey_etl.py for the actual computation; these
# are thin wrappers that make it callable from the admin panel without a
# redeploy, which was the explicit point of this pass.

@app.get("/api/v1/admin/data-config", tags=["Superadmin", "Training"])
async def get_data_config(admin_user: dict = Depends(require_superadmin)):
    """Current admin/dataConfig (income band cutoffs, per-category weights,
    outlier handling, confidence threshold) — defaults filled in if the doc
    doesn't exist yet, so the admin panel always has something sane to render."""
    db = get_firestore_client()
    return survey_etl.load_data_config(db)

@app.put("/api/v1/admin/data-config", tags=["Superadmin", "Training"])
async def update_data_config(
    config: Dict[str, Any] = Body(...),
    admin_user: dict = Depends(require_superadmin)
):
    """
    Saves a new admin/dataConfig and immediately recomputes Stage-1 stats
    against it — this IS the "changing these values triggers a recompute,
    not a redeploy" mechanism from the brief. Partial updates are fine
    (missing keys keep their existing/default value); unknown keys are
    dropped rather than silently stored, since a typo'd key would otherwise
    just be ignored forever without anyone noticing.
    """
    db = get_firestore_client()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore unavailable — cannot save config or recompute")

    merged = survey_etl.load_data_config(db)
    for key in survey_etl.DEFAULT_DATA_CONFIG:
        if key in config:
            merged[key] = config[key]
    db.collection("admin").document("dataConfig").set(merged)

    stats = survey_etl.run_etl(db)
    MLEngine.apply_live_benchmarks(stats)
    return {"config": merged, "recomputedStats": stats}

@app.post("/api/v1/admin/recompute-benchmarks", tags=["Superadmin", "Training"])
async def recompute_benchmarks(admin_user: dict = Depends(require_superadmin)):
    """Re-runs the Stage-1 ETL against current admin/dataConfig and whatever
    survey_responses exist right now (e.g. to pick up new submissions without
    also changing config), and re-applies the result to the running MLEngine."""
    db = get_firestore_client()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore unavailable — cannot recompute")
    stats = survey_etl.run_etl(db)
    MLEngine.apply_live_benchmarks(stats)
    return stats

@app.get("/api/v1/admin/training-insights", tags=["Superadmin", "Training"])
async def get_training_insights(admin_user: dict = Depends(require_superadmin)):
    """
    Everything the Training Insights admin screen needs in one call: the
    latest computed Stage-1 stats (per-category-per-income-band median/IQR/
    sample size), a sample-size trend history, and the population-level
    dot-graph clustering preview (item 4 in the brief). Computes fresh from
    current Firestore data on every call rather than only ever showing a
    stale cached snapshot — this endpoint is admin-only and low-traffic by
    nature, so the recompute cost isn't a real concern.
    """
    db = get_firestore_client()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore unavailable")

    stats = survey_etl.run_etl(db)
    MLEngine.apply_live_benchmarks(stats)
    history = survey_etl.load_benchmark_history(db)
    config = stats["configUsed"]
    responses = survey_etl.fetch_survey_responses(db)
    dot_graph = survey_etl.generate_population_dot_graph(responses, config)

    return {
        "stats": stats,
        "history": history,
        "populationDotGraph": dot_graph,
    }

# ── Step 14: public, unauthenticated survey stats for antaraweb ──
# Powers the live figures on the antara.money research-paper site (separate
# `antaraweb` repo — plain HTML/JS, fetches this directly from the browser).
# Deliberately outside the /api/v1/admin/* group above: no require_superadmin
# dependency, since this is aggregates-only over an already-anonymous survey
# (see survey_etl.py's module docstring) — nothing here is more sensitive
# than what /api/v1/admin/training-insights already exposes to admins, just
# reshaped into a smaller, public-safe view via build_public_stats_payload.
#
# CORS: no route-level config needed or possible with FastAPI's
# CORSMiddleware — it's applied once, globally, above (line ~56), so every
# route including this one is already covered by ALLOWED_ORIGINS. Verified
# (not assumed) that "https://antara.money" is still in that list from Step
# 9 — it is (see ALLOWED_ORIGINS above) — so no addition was needed here.
@app.get("/api/v1/public/survey-stats", tags=["Public"])
async def get_public_survey_stats():
    """
    Unauthenticated, read-only aggregate view of the Stage-1 survey stats:
    per-category median/Q1/Q3/n/confidence, income-band respondent counts,
    and per-respondent archetype match percentages (no PII — see
    survey_etl.build_public_stats_payload). Reuses Step 10's survey_etl
    computation rather than duplicating it.
    """
    db = get_firestore_client()
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore unavailable")
    return survey_etl.build_public_stats_payload(db)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
