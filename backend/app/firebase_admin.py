import os
import logging
from typing import Optional, Dict, Any
import firebase_admin
from firebase_admin import auth, firestore, credentials
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger("antara.firebase")
security = HTTPBearer(auto_error=False)

def initialize_firebase_admin():
    if not firebase_admin._apps:
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        project_id = os.getenv("FIREBASE_PROJECT_ID", "antara-moneycontrol")
        try:
            if cred_path and os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred, {"projectId": project_id})
                logger.info(f"Firebase Admin initialized with certificate from {cred_path}")
            else:
                firebase_admin.initialize_app(options={"projectId": project_id})
                logger.info(f"Firebase Admin initialized with default credentials for {project_id}")
        except Exception as e:
            logger.warning(f"Firebase Admin initialization warning: {e}. Running in local/mock-safe mode.")

def get_firestore_client():
    try:
        initialize_firebase_admin()
        return firestore.client()
    except Exception as e:
        logger.warning(f"Unable to connect to Firestore: {e}")
        return None

async def verify_firebase_token(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)) -> Dict[str, Any]:
    """
    Verifies Firebase JWT token and extracts claims (including role: 'superadmin').

    Local development convenience: if ENVIRONMENT=development and no Authorization
    header was sent at all, returns an obviously-fake, non-privileged demo user so
    the API can be exercised without a real Firebase project configured. This user
    never has role=superadmin and is never returned for a token that was present
    but failed verification - an invalid/expired token always fails with 401,
    in every environment.
    """
    if not credentials:
        if os.getenv("ENVIRONMENT") == "development":
            return {
                "uid": "local-dev-fake-uid",
                "email": "local-dev-fake-user@example.invalid",
                "role": "demo_dev_only",
            }
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = credentials.credentials
    try:
        initialize_firebase_admin()
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid authentication token")

def require_superadmin(user: Dict[str, Any] = Depends(verify_firebase_token)) -> Dict[str, Any]:
    if user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Superadmin privilege required")
    return user

def set_beta_claim(uid: str, is_beta: bool) -> None:
    """Stamps (or clears) the `beta` custom claim on a real Firebase Auth
    user record. This is the server-side half of closing the beta-allowlist
    leak: firestore.rules used to let any authenticated user read
    admin/betaAllowlist (a flat array of every beta tester's email) just so
    the client could check its own membership; now the client's membership
    is resolved here, server-side, via the Admin SDK, and stamped onto the
    token instead — the rule can then check `request.auth.token.beta`
    (free) rather than reading that document at all.

    Preserves whatever other custom claims already exist on the account
    (e.g. `role: "superadmin"`, set out-of-band today — nothing in this
    codebase calls set_custom_user_claims yet besides this function) rather
    than clobbering them. No-ops if the claim already matches, so a normal
    sign-in that's already synced doesn't cost an extra Admin SDK write
    every time.
    """
    initialize_firebase_admin()
    user_record = auth.get_user(uid)
    existing_claims = dict(user_record.custom_claims or {})
    if existing_claims.get("beta") == is_beta:
        return
    existing_claims["beta"] = is_beta
    auth.set_custom_user_claims(uid, existing_claims)
