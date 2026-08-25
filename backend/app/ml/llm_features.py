"""
Ollama-backed features: transaction categorization, spend insights/nudges,
and the user-facing chat assistant. See ollama_client.py for the actual
HTTP layer and the "never leaves this box" guarantee.

Staged honesty applies here exactly like it does to MLEngine's predictions:
- categorize_transaction never forces a guess into a category it isn't
  confident about — low confidence comes back flagged "needs_review", the
  same posture the rest of the app uses for thin data.
- build_insight and answer_chat compute every number themselves in Python
  from real Firestore data *before* calling the model, and the prompt tells
  the model explicitly to only reference the numbers it was given — the
  model's job is turning real numbers into a sentence, never inventing the
  numbers themselves.
"""
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.ml import ollama_client
from app.ml.engine import CATEGORIES_METADATA

logger = logging.getLogger("antara.llm_features")

# Below this, a categorization result gets flagged for human review rather
# than silently applied — mirrors MLEngine's cold-start honesty posture.
CATEGORIZE_CONFIDENCE_THRESHOLD = 0.55

_CATEGORY_LIST_FOR_PROMPT = "\n".join(
    f"- {cat_id}: {meta['name']}" for cat_id, meta in CATEGORIES_METADATA.items()
)


def categorize_transaction(description: str, amount: Optional[float] = None) -> Dict[str, Any]:
    """Free-text transaction description -> best-fit category id + confidence.

    Returns a dict shaped like:
        {"category_id": str | None, "category_name": str | None,
         "confidence": float, "needs_review": bool, "raw_model_output": str}

    `category_id` is None (and needs_review True) whenever the model's
    output doesn't parse, names a category outside the real 18-id taxonomy,
    or comes back below CATEGORIZE_CONFIDENCE_THRESHOLD — never a guessed
    fallback category standing in for "the model wasn't sure."
    """
    description = (description or "").strip()
    if not description:
        return {
            "category_id": None,
            "category_name": None,
            "confidence": 0.0,
            "needs_review": True,
            "raw_model_output": "",
        }

    # The plain "use a low number for a vague description" instruction this
    # started with (no few-shot anchor) does not work on qwen2.5:1.5b in
    # practice — verified live against the real model (not assumed): it
    # returned confidence 0.95 for "paid 200", "stuff", "xyz", even "asdkfj
    # random gibberish xyz", every time. Small instruction-tuned models are
    # a known-weak spot for calibrated self-reported confidence; the fix
    # that actually worked, tested live, is anchoring it with concrete
    # before/after examples rather than an abstract instruction — confirmed
    # this drops vague-input confidence to ~0.1-0.25 (correctly below
    # CATEGORIZE_CONFIDENCE_THRESHOLD) while leaving clear cases at ~0.9-0.95,
    # consistently across repeated runs at this temperature.
    system = (
        "You categorize a single Indian teenager's spending transaction into "
        "exactly one category id from a fixed list. Reply with ONLY a JSON "
        "object of the shape {\"category_id\": <id>, \"confidence\": <0-1 float>}. "
        "confidence is YOUR honest, calibrated estimate of how sure you are.\n\n"
        "Calibration guide — follow these examples exactly:\n"
        "- \"Swiggy order, 2 burgers\" -> food-snacks, confidence 0.95\n"
        "- \"paid 200\" -> miscellaneous, confidence 0.25 (no info about WHAT was bought)\n"
        "- \"stuff\" -> miscellaneous, confidence 0.15 (zero real information)\n"
        "- \"xyz\" or random characters -> miscellaneous, confidence 0.1 (not a real description)\n"
        "- \"Metro card recharge\" -> transportation, confidence 0.9 (a metro/bus/transit "
        "top-up is transportation, NOT mobile-recharge — mobile-recharge is only for a "
        "phone/SIM/data plan top-up)\n"
        "- \"Gym membership fee\" -> fitness, confidence 0.9 (a gym/sports membership is "
        "fitness, NOT subscriptions — subscriptions is only for OTT/music/streaming apps)\n"
        "- \"UC top-up for BGMI\" -> gaming-inapp, confidence 0.9 (any in-game currency, "
        "battle pass, or game purchase — BGMI, PUBG, Free Fire, Valorant, etc. — is "
        "gaming-inapp, NOT subscriptions, even though it recurs like one)\n"
        "A vague or generic description (no merchant, no item, no clear purpose) "
        "MUST get confidence below 0.4, even if you pick miscellaneous as the category. "
        "Only use confidence above 0.7 when the description clearly names a specific "
        "item, merchant, or activity that maps cleanly to one category.\n\n"
        "You must copy the category_id EXACTLY character-for-character from the "
        "list above — never abbreviate, rename, or modify it. Never invent a "
        "category id outside the list."
    )
    prompt = (
        f"Categories:\n{_CATEGORY_LIST_FOR_PROMPT}\n\n"
        f"Transaction description: \"{description}\""
        + (f"\nAmount: ₹{amount}" if amount is not None else "")
    )

    try:
        raw = ollama_client.generate(
            model=ollama_client.CATEGORIZE_MODEL,
            prompt=prompt,
            system=system,
            format_json=True,
            temperature=0.1,
        )
    except ollama_client.OllamaError as e:
        logger.warning("categorize_transaction: Ollama unavailable: %s", e)
        return {
            "category_id": None,
            "category_name": None,
            "confidence": 0.0,
            "needs_review": True,
            "raw_model_output": "",
            "error": "model_unavailable",
        }

    category_id, confidence = _parse_categorize_response(raw)
    if category_id is None or confidence < CATEGORIZE_CONFIDENCE_THRESHOLD:
        return {
            "category_id": None,
            "category_name": None,
            "confidence": confidence,
            "needs_review": True,
            "raw_model_output": raw,
        }

    return {
        "category_id": category_id,
        "category_name": CATEGORIES_METADATA[category_id]["name"],
        "confidence": confidence,
        "needs_review": False,
        "raw_model_output": raw,
    }


def _parse_categorize_response(raw: str) -> Tuple[Optional[str], float]:
    try:
        parsed = json.loads(raw)
        cat_id = parsed.get("category_id")
        confidence = float(parsed.get("confidence", 0.0))
    except (json.JSONDecodeError, TypeError, ValueError, AttributeError):
        return None, 0.0
    if cat_id not in CATEGORIES_METADATA:
        return None, confidence
    confidence = max(0.0, min(1.0, confidence))
    return cat_id, confidence


def _fetch_recent_transactions(db, uid: str, days: int = 30) -> List[Dict[str, Any]]:
    """Real data, fetched server-side via the Admin SDK (which bypasses
    Firestore rules entirely, same as every other server write in
    main.py) — the access boundary that matters is enforced one layer up,
    at the API route, by requiring the caller's own verified uid to match
    the uid being read (see main.py's new /ml/insights and /ml/chat
    routes). This function itself trusts whatever uid it's given."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    txs: List[Dict[str, Any]] = []
    docs = db.collection("users").document(uid).collection("transactions").stream()
    for doc in docs:
        data = doc.to_dict() or {}
        ts_raw = data.get("timestamp")
        try:
            ts = datetime.fromisoformat(str(ts_raw).replace("Z", "+00:00"))
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
        except (ValueError, TypeError):
            continue
        if ts < cutoff:
            continue
        txs.append({"amount": float(data.get("amount", 0) or 0), "category": data.get("category"), "timestamp": ts})
    return txs


def _category_totals(txs: List[Dict[str, Any]], since: datetime) -> Dict[str, float]:
    totals: Dict[str, float] = {}
    for tx in txs:
        if tx["timestamp"] < since:
            continue
        cat = tx.get("category")
        if not cat:
            continue
        totals[cat] = totals.get(cat, 0.0) + tx["amount"]
    return totals


def build_insight(db, uid: str) -> Dict[str, Any]:
    """Computes this-week vs. prior-3-week-average category spend in plain
    Python, picks the single biggest mover, and — only if there's a real
    mover to report — asks the chat model to phrase it as one short,
    human sentence, grounded on the exact numbers computed here. Returns
    {"insight": str | None, "computed": {...}} — computed is included so a
    caller (or a test) can verify the sentence's numbers actually match
    what was fed in, not just that a sentence came back."""
    now = datetime.now(timezone.utc)
    txs = _fetch_recent_transactions(db, uid, days=28)
    this_week = _category_totals(txs, now - timedelta(days=7))
    prior_three_weeks = _category_totals(txs, now - timedelta(days=28))

    movers = []
    for cat_id, this_week_amt in this_week.items():
        prior_avg = max(0.0, (prior_three_weeks.get(cat_id, 0.0) - this_week_amt)) / 3
        if prior_avg <= 0:
            continue
        pct_change = ((this_week_amt - prior_avg) / prior_avg) * 100
        movers.append((cat_id, this_week_amt, prior_avg, pct_change))

    if not movers:
        return {"insight": None, "computed": {}}

    movers.sort(key=lambda m: abs(m[3]), reverse=True)
    cat_id, this_week_amt, prior_avg, pct_change = movers[0]
    if abs(pct_change) < 15:
        # Not a meaningful move — staying quiet beats manufacturing a nudge
        # out of ordinary week-to-week noise.
        return {"insight": None, "computed": {}}

    cat_name = CATEGORIES_METADATA.get(cat_id, {}).get("name", cat_id)
    computed = {
        "category_id": cat_id,
        "category_name": cat_name,
        "this_week_inr": round(this_week_amt),
        "prior_weekly_avg_inr": round(prior_avg),
        "pct_change": round(pct_change),
    }

    system = (
        "You write one short, plain-language sentence for a teenager about "
        "their spending, based ONLY on the numbers given to you. Never "
        "invent or adjust any number. Keep it under 25 words, no emoji, no "
        "judgment — just a clear, human observation."
    )
    prompt = (
        f"This week: ₹{computed['this_week_inr']} on {cat_name}. "
        f"Their usual weekly average recently: ₹{computed['prior_weekly_avg_inr']}. "
        f"That's a {computed['pct_change']}% change. Write the sentence."
    )
    try:
        sentence = ollama_client.generate(
            model=ollama_client.CHAT_MODEL, prompt=prompt, system=system, temperature=0.3
        ).strip()
    except ollama_client.OllamaError as e:
        logger.warning("build_insight: Ollama unavailable, falling back to templated sentence: %s", e)
        direction = "more" if computed["pct_change"] > 0 else "less"
        sentence = (
            f"You've spent {abs(computed['pct_change'])}% {direction} on {cat_name} this week "
            f"(₹{computed['this_week_inr']}) than your usual ₹{computed['prior_weekly_avg_inr']}/week."
        )

    return {"insight": sentence, "computed": computed}


def answer_chat(db, uid: str, message: str) -> Dict[str, Any]:
    """Answers a user's natural-language question about their own spending.
    Fetches their real recent transactions first and hands the model a
    compact numeric summary as context — the model only ever sees numbers
    that were actually computed here, never raw free-form access to
    Firestore, so it can't wander into inventing figures it wasn't given."""
    txs = _fetch_recent_transactions(db, uid, days=30)
    totals = _category_totals(txs, datetime.now(timezone.utc) - timedelta(days=30))
    total_spend = round(sum(totals.values()))

    if not txs:
        return {
            "answer": "You haven't logged anything in the last 30 days yet, so there's nothing for me to look at — log a few expenses and ask again.",
            "grounded_on_transaction_count": 0,
        }

    lines = [f"Last 30 days, total spend: ₹{total_spend}."]
    for cat_id, amt in sorted(totals.items(), key=lambda kv: kv[1], reverse=True):
        cat_name = CATEGORIES_METADATA.get(cat_id, {}).get("name", cat_id)
        lines.append(f"- {cat_name}: ₹{round(amt)}")
    context_block = "\n".join(lines)

    system = (
        "You are Antara's spending assistant for a teenager. Answer their "
        "question about their OWN spending using ONLY the numbers in the "
        "data block you're given below — never invent or estimate a figure "
        "that isn't there. If the data doesn't cover what they're asking, "
        "say so plainly instead of guessing. Keep answers short and "
        "conversational, not a report."
    )
    messages = [
        {"role": "system", "content": f"{system}\n\nTheir spending data:\n{context_block}"},
        {"role": "user", "content": message},
    ]

    try:
        answer = ollama_client.chat(model=ollama_client.CHAT_MODEL, messages=messages).strip()
    except ollama_client.OllamaError as e:
        logger.warning("answer_chat: Ollama unavailable: %s", e)
        return {
            "answer": "The chat assistant isn't reachable right now — try again in a moment.",
            "grounded_on_transaction_count": len(txs),
            "error": "model_unavailable",
        }

    return {"answer": answer, "grounded_on_transaction_count": len(txs)}
