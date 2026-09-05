"""
Brief 5 (2026-09-05): real account deletion and data export.

Both operations only ever act on the CALLING account's own uid (never a
uid supplied in a request body — see main.py's routes, which pass
current_user["uid"] straight from the verified token, with no parameter a
client could substitute another account's id into). Deletion in
particular has to be server-side via the Admin SDK, not a client-side
batch of Firestore deletes: a normal client can only ever write to its
OWN users/{uid}/friends subcollection (see firestore.rules), so removing
the *other* side of every mutual friendship this account has — the exact
same reason app/social.py's add/remove-friend already has to be
server-mediated — is not something a client-side deletion flow could ever
do correctly on its own; it would leave every friend with a dangling
pointer to an account that no longer exists.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

from firebase_admin import auth

logger = logging.getLogger("antara.account")

# Every subcollection a real account can have documents in — kept as one
# list so delete_account and export_account_data both walk the exact same
# set and can't quietly drift apart (a collection added to one but not the
# other would either leak data past a deletion or be missing from an
# export, and both are the kind of bug that wouldn't be noticed for a
# while).
_OWNED_SUBCOLLECTIONS = ["transactions", "wallets", "income", "instances", "friends", "badges"]

# Firestore batched writes cap out at 500 operations; chunk with headroom
# rather than assuming any single account will always stay small.
_BATCH_CHUNK_SIZE = 400


def _chunked(items: List[Any], size: int):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def delete_account(db, uid: str) -> Dict[str, Any]:
    """Deletes everything a real account owns: every doc in every
    subcollection above, the profile doc itself, the reverse `friends`
    pointer on every real friend's own subcollection (the actual point of
    doing this server-side rather than as a client-side batch), and
    finally the Firebase Auth user record. Returns a small summary (counts
    deleted per collection) so a caller/test can confirm what actually
    happened rather than just "no exception was raised."

    Idempotent-ish: if called twice in a row (e.g. a retried request), the
    second call simply finds nothing left to delete in Firestore and
    still deletes the Auth user if it still exists — it doesn't error out
    just because the first call already did most of the work.
    """
    summary: Dict[str, Any] = {"uid": uid, "deleted_counts": {}}

    # Read this account's own friend list BEFORE deleting anything, so we
    # know whose reverse pointer needs cleaning up.
    friend_docs = list(db.collection("users").document(uid).collection("friends").stream())
    friend_uids = [d.id for d in friend_docs]

    # Delete the reverse pointer on every real friend's own friends
    # subcollection — this is the "dangling friend" cleanup the brief
    # calls out by name. A friend whose own account was deleted first (so
    # this doc no longer exists) is simply a no-op delete, not an error.
    for chunk in _chunked(friend_uids, _BATCH_CHUNK_SIZE):
        batch = db.batch()
        for friend_uid in chunk:
            batch.delete(db.collection("users").document(friend_uid).collection("friends").document(uid))
        batch.commit()
    summary["reverse_friend_pointers_removed"] = len(friend_uids)

    # Delete every document in every owned subcollection (including this
    # account's own `friends` subcollection, already read above).
    for coll_name in _OWNED_SUBCOLLECTIONS:
        docs = list(db.collection("users").document(uid).collection(coll_name).stream())
        for chunk in _chunked(docs, _BATCH_CHUNK_SIZE):
            batch = db.batch()
            for doc in chunk:
                batch.delete(doc.reference)
            batch.commit()
        summary["deleted_counts"][coll_name] = len(docs)

    # The profile document itself.
    db.collection("users").document(uid).delete()

    # Finally, the Firebase Auth user — after Firestore cleanup, so a
    # failure partway through Firestore deletion never leaves an orphaned
    # Firestore trail with no Auth record left to retry against.
    try:
        auth.delete_user(uid)
        summary["auth_user_deleted"] = True
    except auth.UserNotFoundError:
        # Already gone (e.g. a retried request) — not an error.
        summary["auth_user_deleted"] = False

    summary["deleted_at"] = datetime.now(timezone.utc).isoformat()
    logger.info("delete_account: uid=%s summary=%s", uid, summary)
    return summary


def export_account_data(db, uid: str) -> Dict[str, Any]:
    """Everything this account owns, as one JSON-serializable dict — the
    actual content behind the "Export my data" button. Walks the exact
    same _OWNED_SUBCOLLECTIONS list delete_account does (see its own
    comment on why that matters), plus the profile document itself.
    Read-only; never mutates anything."""
    profile_snap = db.collection("users").document(uid).get()
    export: Dict[str, Any] = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "uid": uid,
        "profile": profile_snap.to_dict() or {},
    }
    for coll_name in _OWNED_SUBCOLLECTIONS:
        docs = db.collection("users").document(uid).collection(coll_name).stream()
        export[coll_name] = [{"id": d.id, **(d.to_dict() or {})} for d in docs]
    return export
