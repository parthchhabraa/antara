"""
Brief 5 (2026-09-05): tests for app/account.py's delete_account and
export_account_data. Uses a small in-memory fake Firestore (a flat dict
keyed by full path tuples) rather than a real emulator — faithful enough
for these two functions' actual usage (collection/document/get/delete/
batch/stream at arbitrary subcollection depth) without the overhead of a
real Firestore connection. Real-account, real-friend verification against
actual production Firestore is covered separately (see REVIEW.md — a
throwaway account with a real friend, confirmed the friend's own list no
longer has a dangling entry after deletion)."""
import pytest

from app import account as account_module
from app.account import delete_account, export_account_data


class _FakeDocSnap:
    def __init__(self, doc_id, data, reference=None):
        self.id = doc_id
        self._data = data
        self.reference = reference

    def to_dict(self):
        return dict(self._data) if self._data is not None else None

    @property
    def exists(self):
        return self._data is not None


class _FakeDocRef:
    def __init__(self, store, path):
        self.store = store
        self.path = path

    def get(self):
        return _FakeDocSnap(self.path[-1], self.store.get(self.path))

    def delete(self):
        self.store.pop(self.path, None)

    def set(self, data, merge=False):
        if merge and self.path in self.store:
            self.store[self.path].update(data)
        else:
            self.store[self.path] = dict(data)

    def collection(self, name):
        return _FakeCollectionRef(self.store, self.path + (name,))


class _FakeCollectionRef:
    def __init__(self, store, path):
        self.store = store
        self.path = path
        self._auto_counter = 0

    def document(self, doc_id=None):
        if doc_id is None:
            self._auto_counter += 1
            doc_id = f"auto_{self._auto_counter}"
        return _FakeDocRef(self.store, self.path + (doc_id,))

    def stream(self):
        prefix = self.path
        out = []
        for path in list(self.store.keys()):
            if len(path) == len(prefix) + 1 and path[:-1] == prefix:
                ref = _FakeDocRef(self.store, path)
                out.append(_FakeDocSnap(path[-1], self.store[path], reference=ref))
        return out


class _FakeBatch:
    def __init__(self):
        self._deletes = []

    def delete(self, ref):
        self._deletes.append(ref)

    def commit(self):
        for ref in self._deletes:
            ref.delete()


class _FakeDb:
    def __init__(self):
        self.store = {}

    def collection(self, name):
        return _FakeCollectionRef(self.store, (name,))

    def batch(self):
        return _FakeBatch()


def _seed_account(db: _FakeDb, uid: str, transactions=0, friends=None):
    db.store[("users", uid)] = {"email": f"{uid}@example.com", "monthly_budget": 5000}
    for i in range(transactions):
        db.store[("users", uid, "transactions", f"tx{i}")] = {"amount": 100 + i, "category": "food-snacks"}
    for friend_uid in (friends or []):
        db.store[("users", uid, "friends", friend_uid)] = {"since": "2026-01-01T00:00:00Z"}


class _FakeAuthModule:
    """Stands in for firebase_admin.auth — only delete_user is exercised."""
    class UserNotFoundError(Exception):
        pass

    def __init__(self):
        self.deleted_uids = []
        self.missing_uids = set()

    def delete_user(self, uid):
        if uid in self.missing_uids:
            raise self.UserNotFoundError(uid)
        self.deleted_uids.append(uid)


@pytest.fixture
def fake_auth(monkeypatch):
    fa = _FakeAuthModule()
    monkeypatch.setattr(account_module, "auth", fa)
    return fa


def test_delete_account_removes_every_owned_subcollection_and_profile(fake_auth):
    db = _FakeDb()
    _seed_account(db, "user_a", transactions=3)
    db.store[("users", "user_a", "wallets", "w1")] = {"name": "Cash", "balance": 100}

    summary = delete_account(db, "user_a")

    assert summary["deleted_counts"]["transactions"] == 3
    assert summary["deleted_counts"]["wallets"] == 1
    assert ("users", "user_a") not in db.store
    assert not any(path[:2] == ("users", "user_a") for path in db.store)
    assert fake_auth.deleted_uids == ["user_a"]
    assert summary["auth_user_deleted"] is True


def test_delete_account_removes_the_reverse_friend_pointer_on_a_real_friend(fake_auth):
    """The actual point of doing this server-side: a real friend's own
    friends subcollection must not be left with a dangling entry pointing
    at the now-deleted account."""
    db = _FakeDb()
    _seed_account(db, "user_a", friends=["user_b"])
    _seed_account(db, "user_b", friends=["user_a"])

    summary = delete_account(db, "user_a")

    assert summary["reverse_friend_pointers_removed"] == 1
    # user_a's own friends subcollection is gone (deleted as an owned collection).
    assert ("users", "user_a", "friends", "user_b") not in db.store
    # THE bug this whole design exists to prevent: user_b's pointer back to
    # the now-deleted user_a must also be gone, not left dangling.
    assert ("users", "user_b", "friends", "user_a") not in db.store
    # user_b's own account is otherwise untouched.
    assert ("users", "user_b") in db.store


def test_delete_account_is_idempotent_when_auth_user_already_gone(fake_auth):
    db = _FakeDb()
    _seed_account(db, "user_a")
    fake_auth.missing_uids.add("user_a")

    summary = delete_account(db, "user_a")  # must not raise

    assert summary["auth_user_deleted"] is False


def test_delete_account_never_touches_a_different_users_data(fake_auth):
    db = _FakeDb()
    _seed_account(db, "user_a", transactions=2)
    _seed_account(db, "user_b", transactions=5)

    delete_account(db, "user_a")

    assert not any(path[:2] == ("users", "user_a") for path in db.store)
    assert ("users", "user_b") in db.store
    assert sum(1 for p in db.store if p[:3] == ("users", "user_b", "transactions")) == 5


def test_export_account_data_includes_profile_and_every_owned_collection():
    db = _FakeDb()
    _seed_account(db, "user_a", transactions=2, friends=["user_b"])
    db.store[("users", "user_a", "wallets", "w1")] = {"name": "Cash", "balance": 200}

    export = export_account_data(db, "user_a")

    assert export["uid"] == "user_a"
    assert export["profile"]["email"] == "user_a@example.com"
    assert len(export["transactions"]) == 2
    assert len(export["wallets"]) == 1
    assert export["wallets"][0]["name"] == "Cash"
    assert len(export["friends"]) == 1
    assert export["friends"][0]["id"] == "user_b"
    assert "exported_at" in export


def test_export_account_data_never_touches_a_different_users_data():
    db = _FakeDb()
    _seed_account(db, "user_a", transactions=1)
    _seed_account(db, "user_b", transactions=9)

    export = export_account_data(db, "user_a")

    assert len(export["transactions"]) == 1
