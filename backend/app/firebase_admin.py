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
    Allows fallback in local development mode if bypass is active.
    """
    if not credentials:
        # Check if running in development mode without token
        if os.getenv("ENVIRONMENT") == "development":
            return {
                "uid": "dev-user-001",
                "email": "parthchhabra6112@gmail.com",
                "role": "superadmin"
            }
        raise HTTPException(status_code=401, detail="Missing authorization header")
        
    token = credentials.credentials
    try:
        initialize_firebase_admin()
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        if os.getenv("ENVIRONMENT") == "development":
            return {
                "uid": "dev-user-001",
                "email": "parthchhabra6112@gmail.com",
                "role": "superadmin"
            }
        raise HTTPException(status_code=401, detail="Invalid authentication token")

def require_superadmin(user: Dict[str, Any] = Depends(verify_firebase_token)) -> Dict[str, Any]:
    if user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Superadmin privilege required")
    return user
