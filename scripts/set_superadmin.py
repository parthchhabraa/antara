#!/usr/bin/env python3
"""
Antara Superadmin Claim Setup Script
Assigns custom claim `role: "superadmin"` to parthchhabra6112@gmail.com
"""

import sys
import os
import argparse
import firebase_admin
from firebase_admin import auth, credentials

SUPERADMIN_EMAIL = "parthchhabra6112@gmail.com"

def init_firebase(cred_path=None):
    if firebase_admin._apps:
        return
    project_id = os.getenv("FIREBASE_PROJECT_ID", "antara-moneycontrol")
    if cred_path and os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred, {"projectId": project_id})
    else:
        # Falls back to GOOGLE_APPLICATION_CREDENTIALS or default auth
        try:
            firebase_admin.initialize_app(options={"projectId": project_id})
        except Exception as e:
            print(f"Error initializing Firebase Admin SDK: {e}")
            print("Please set GOOGLE_APPLICATION_CREDENTIALS or pass --cred <path_to_service_account.json>")
            sys.exit(1)

def assign_superadmin(email: str = SUPERADMIN_EMAIL):
    print(f"[*] Looking up user: {email}...")
    try:
        user = auth.get_user_by_email(email)
        print(f"[+] Found user UID: {user.uid}")
        
        current_claims = user.custom_claims or {}
        print(f"[*] Current claims: {current_claims}")
        
        updated_claims = {**current_claims, "role": "superadmin"}
        auth.set_custom_user_claims(user.uid, updated_claims)
        
        print(f"[SUCCESS] Custom claims updated for {email}: {updated_claims}")
        print("[!] Note: The user may need to re-authenticate or refresh their token (getIdToken(true)) to receive the new claim.")
    except auth.UserNotFoundError:
        print(f"[-] User with email {email} not found in Firebase project 'antara-moneycontrol'.")
        print("Please ensure the user has signed up before running this script.")
        sys.exit(1)
    except Exception as e:
        print(f"[-] Failed to set custom claims: {e}")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Assign superadmin custom claim to Antara user")
    parser.add_argument("--email", default=SUPERADMIN_EMAIL, help="User email to promote")
    parser.add_argument("--cred", help="Path to Firebase Service Account JSON key")
    args = parser.parse_args()

    init_firebase(args.cred)
    assign_superadmin(args.email)
