import os
import uvicorn
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from datetime import datetime

from app.schemas import (
    SpendPredictRequest, SpendPredictResponse,
    DotGraphResponse, HealthResponse, TransactionItem
)
from app.ml.engine import MLEngine
from app.firebase_admin import (
    initialize_firebase_admin, verify_firebase_token,
    require_superadmin, get_firestore_client
)

app = FastAPI(
    title="Antara ML Spend Prediction & Personalization API",
    version="1.0.0",
    description="FastAPI service for expense prediction, teen spend embeddings, and Obsidian dot graph physics"
)

# CORS Middleware config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    initialize_firebase_admin()
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

@app.post("/api/v1/predict/spend", response_model=SpendPredictResponse, tags=["ML Prediction"])
async def predict_spending(
    req: SpendPredictRequest,
    current_user: dict = Depends(verify_firebase_token)
):
    """
    Computes forecasted categorical spend, burn rate, risk levels, and smart teen insights.
    Caches the forecast to Firestore `predictions/{uid}/{period}` when Firestore is reachable.
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
    """
    return MLEngine.generate_dot_graph(
        user_id=req.user_id,
        transactions=req.transactions
    )

@app.get("/api/v1/admin/status", tags=["Superadmin"])
async def get_admin_status(admin_user: dict = Depends(require_superadmin)):
    """
    Protected superadmin endpoint to retrieve backend telemetry and model status.
    """
    return {
        "status": "operational",
        "superadmin_email": admin_user.get("email"),
        "port": 8001,
        "ports_guarded": [5000, 8000],
        "systemd_unit": "antara-ml.service",
        "tunnel_configured": True
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8001))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
