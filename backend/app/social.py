"""
Friends, badges, and privacy-preserving comparison.

THE ONE HARD RULE THROUGHOUT THIS MODULE: no function here ever returns a
real rupee figure — not a budget, not a spend total, not a wallet balance,
not a category total — to anything other than the account that owns that
number. Every comparison is relative/bucketed (a label, not a number).
Every friendship write touches both directions atomically via the Admin
SDK, which is the ONLY way a client-writable Firestore doc could ever end
up with both sides in sync anyway: a normal client can only write to its
own users/{uid}/friends subcollection (see firestore.rules), never to
another uid's, so mutual add/remove has to be mediated here.
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.ml.engine import CATEGORIES_METADATA, MLEngine

logger = logging.getLogger("antara.social")

# ── Friend tokens ──────────────────────────────────────────────────────

def ensure_friend_token(db, uid: str) -> str:
    """Returns the caller's existing friend_token, generating and
    persisting a new one (server-side, via secrets.token_urlsafe — not
    Math.random or anything client-guessable) if they don't have one yet.
    Never regenerates an existing token — a user's QR code should keep
    working after they've shared it."""
    user_ref = db.collection("users").document(uid)
    snap = user_ref.get()
    data = snap.to_dict() or {}
    existing = data.get("friend_token")
    if existing:
        return existing
    token = secrets.token_urlsafe(24)
    user_ref.set({"friend_token": token}, merge=True)
    return token


def _find_uid_by_friend_token(db, token: str) -> Optional[str]:
    """Server-side only lookup (Admin SDK query, bypasses rules) — a
    friend_token is never queryable by a client directly; this is the only
    place it's ever resolved back to a uid."""
    query = db.collection("users").where("friend_token", "==", token).limit(1)
    docs = list(query.stream())
    return docs[0].id if docs else None


def _are_friends(db, uid: str, other_uid: str) -> bool:
    return db.collection("users").document(uid).collection("friends").document(other_uid).get().exists


# ── Add / remove friend (mutual, atomic) ────────────────────────────────

def add_friend_by_token(db, requester_uid: str, friend_token: str) -> Dict[str, Any]:
    """QR/NFC scan resolves to this. Both directions written in one Admin
    SDK batch — never partially-friended. Idempotent: re-adding an existing
    friend just confirms success rather than erroring, since two people
    might scan each other's codes in the same moment."""
    target_uid = _find_uid_by_friend_token(db, friend_token)
    if not target_uid:
        raise ValueError("No account matches that code — it may have expired or been mistyped.")
    if target_uid == requester_uid:
        raise ValueError("You can't add yourself as a friend.")

    now = datetime.now(timezone.utc).isoformat()
    batch = db.batch()
    batch.set(
        db.collection("users").document(requester_uid).collection("friends").document(target_uid),
        {"since": now},
        merge=True,
    )
    batch.set(
        db.collection("users").document(target_uid).collection("friends").document(requester_uid),
        {"since": now},
        merge=True,
    )
    batch.commit()

    target_doc = db.collection("users").document(target_uid).get().to_dict() or {}
    return {"friend_uid": target_uid, "friend_display_name": target_doc.get("displayName")}


def remove_friend(db, requester_uid: str, friend_uid: str) -> None:
    """Same mutual-write reasoning as add_friend_by_token — a normal client
    can only delete from its own friends subcollection, never the other
    side, so unfriending needs the same server mediation adding it did."""
    batch = db.batch()
    batch.delete(db.collection("users").document(requester_uid).collection("friends").document(friend_uid))
    batch.delete(db.collection("users").document(friend_uid).collection("friends").document(requester_uid))
    batch.commit()


# ── Privacy-preserving category comparison ──────────────────────────────

# Bucket thresholds are percentage-point differences in each person's own
# share of their own total spend (friend_share - my_share) — never a
# difference in rupees, and never rupees at all. E.g. if a category is 30%
# of my spend and 38% of my friend's, that's an 8-point difference -> the
# "more" bucket. Whether either of us spends ₹200 or ₹20,000 in total never
# enters this calculation's output, only enters as the denominator that
# produces each share in the first place, and the share numbers themselves
# never leave this function.
_MUCH_THRESHOLD = 0.08
_SOME_THRESHOLD = 0.02


def _bucket(diff: float) -> str:
    if diff <= -_MUCH_THRESHOLD:
        return "much_less"
    if diff <= -_SOME_THRESHOLD:
        return "less"
    if diff < _SOME_THRESHOLD:
        return "similar"
    if diff < _MUCH_THRESHOLD:
        return "more"
    return "much_more"


def _category_shares(txs: List[Dict[str, Any]]) -> Tuple[Dict[str, float], float]:
    totals: Dict[str, float] = {k: 0.0 for k in CATEGORIES_METADATA.keys()}
    for tx in txs:
        cat = tx.get("category")
        cat = cat if cat in totals else "miscellaneous"
        totals[cat] += tx.get("amount", 0.0)
    total_spend = sum(totals.values())
    if total_spend <= 0:
        return {k: 0.0 for k in totals}, 0.0
    return {k: v / total_spend for k, v in totals.items()}, total_spend


def compare_category_shares(db, requester_uid: str, friend_uid: str) -> Dict[str, Any]:
    """The one function in this file that touches a friend's real
    transactions — verified friendship first, real numbers computed, but
    the return value below contains ONLY bucket labels + a per-side
    cold-start flag. No share value, no total, no rupee figure of any kind
    crosses back out of this function."""
    if not _are_friends(db, requester_uid, friend_uid):
        raise PermissionError("Not friends with that account.")

    my_txs = _fetch_recent_transactions_raw(db, requester_uid, days=30)
    friend_txs = _fetch_recent_transactions_raw(db, friend_uid, days=30)

    my_shares, my_total = _category_shares(my_txs)
    friend_shares, friend_total = _category_shares(friend_txs)

    my_cold_start, _, _ = MLEngine._analyze_data_maturity(_as_transaction_items(my_txs))
    friend_cold_start, _, _ = MLEngine._analyze_data_maturity(_as_transaction_items(friend_txs))

    comparisons = []
    for cat_id, meta in CATEGORIES_METADATA.items():
        my_share = my_shares.get(cat_id, 0.0)
        friend_share = friend_shares.get(cat_id, 0.0)
        # Skip categories neither of us has touched at all — nothing
        # honest to compare, and it would just be noise.
        if my_share == 0.0 and friend_share == 0.0:
            continue
        comparisons.append({
            "category_id": cat_id,
            "category_name": meta["name"],
            "bucket": _bucket(friend_share - my_share),
        })

    return {
        "comparisons": comparisons,
        "requester_is_cold_start": my_cold_start,
        "friend_is_cold_start": friend_cold_start,
    }


def _fetch_recent_transactions_raw(db, uid: str, days: int = 30) -> List[Dict[str, Any]]:
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


def _as_transaction_items(raw_txs: List[Dict[str, Any]]):
    """MLEngine._analyze_data_maturity just needs .amount/.category/.timestamp
    attributes, not a real pydantic TransactionItem — a tiny local shim
    avoids constructing real TransactionItem objects (which validate
    amount > 0, timestamp parsing, etc.) just to read three fields back off
    them a moment later."""
    class _Shim:
        __slots__ = ("amount", "category", "timestamp")

        def __init__(self, amount, category, timestamp):
            self.amount = amount
            self.category = category
            self.timestamp = timestamp

    return [_Shim(t["amount"], t["category"], t["timestamp"]) for t in raw_txs]
