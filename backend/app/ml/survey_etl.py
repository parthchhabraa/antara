"""
Antara Survey ETL — Step 10 (2026-08-21)

Turns raw `survey_responses` Firestore documents (written by the separate
survey.antara.money project — confirmed by reading that project's own shipped
client bundle, not assumed: it initializes Firebase against the same
`antara-moneycontrol` project and writes directly to Firestore via
`addDoc(collection(db, "survey_responses"), ...)`, no spreadsheet/Forms/other
backend involved) into the per-category, per-income-band statistics that
replace the placeholder cold-start heuristic values in engine.py.

Explicitly Stage 1 only (per the brief): real medians/spreads/sample-sizes
from real survey responses, presented as "based on N survey responses," not
as anything trained. No embedding model is fit here — Stage 2 (real
per-user embedding training) is out of scope until live transaction volume
actually supports it; see the module docstring on MLEngine for where that
would plug in later.

The category ids used below (SURVEY_CATEGORY_KEYS) are read directly from the
survey's own shipped bundle too (its hardcoded category picker list) and
match backend/app/ml/engine.py's CATEGORIES_METADATA keys exactly as of the
Step 9 taxonomy realignment — this ETL does NOT maintain a second parallel
category list; if the two ever drift, category ids present in survey
responses but absent from CATEGORIES_METADATA are collected under
"unmapped_categories" in the stats output instead of silently dropped or
silently forking a new taxonomy entry.
"""

import math
import statistics
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import numpy as np

from app.ml.engine import PEER_ARCHETYPES

SURVEY_CATEGORY_KEYS = [
    "food-snacks", "tech-gadgets", "subscriptions", "grooming", "clothes-shoes",
    "gifting-friends", "dates-outings", "transportation", "investments", "fitness",
    "mobile-recharge", "books", "gaming-inapp", "tuition-coaching",
    "movies-entertainment", "fantasy-betting", "charity-donations",
]

# Self-reported monthly pocket-money range (survey field `pocket_money_range`)
# -> a single representative rupee figure, for income-band classification.
# The survey itself only collects a range, not an exact number, so this is
# necessarily a proxy (band midpoint; the open-ended top band uses a plausible
# single value rather than infinity) — documented here rather than silently
# picked, since which representative value to use is itself a judgment call.
POCKET_MONEY_MIDPOINTS = {
    "₹0 – ₹500": 250,
    "₹500 – ₹1,500": 1000,
    "₹1,500 – ₹3,000": 2250,
    "₹3,000 – ₹5,000": 4000,
    "₹5,000 – ₹10,000": 7500,
    "₹10,000+": 12000,
}

DEFAULT_DATA_CONFIG: Dict[str, Any] = {
    # Rupee cutoffs for income bands, ascending. N cutoffs -> N+1 bands.
    # Default: [<1500 Low, 1500-5000 Mid, >=5000 High].
    "incomeBandCutoffs": [1500, 5000],
    "incomeBandLabels": ["Low", "Mid", "High"],
    # Per-category trust multiplier in [0, 1]. 1.0 = fully trust the survey
    # median for that category. Missing entries default to 1.0. Applied only
    # to the benchmark_pct fed into the ML heuristic (see _blend_benchmark) —
    # never alters the raw displayed median/IQR/n, which stay truthful to
    # what was actually reported regardless of how much the engine trusts it.
    "categoryWeights": {},
    "outlierHandling": {"enabled": True, "thresholdIQR": 1.5},
    # Below this raw sample size (after outlier removal), a category/band
    # stat is labeled "early estimate" instead of "confident" wherever shown.
    "minSampleSizeConfident": 20,
}


def load_data_config(db) -> Dict[str, Any]:
    """Reads admin/dataConfig, filling in any missing keys from defaults
    (never fails on a partially-configured doc, never requires it to exist
    at all — a fresh install with no config doc yet just gets the defaults)."""
    config = dict(DEFAULT_DATA_CONFIG)
    if db is None:
        return config
    try:
        snap = db.collection("admin").document("dataConfig").get()
        if snap.exists:
            stored = snap.to_dict() or {}
            for key, default_val in DEFAULT_DATA_CONFIG.items():
                if key in stored and stored[key] is not None:
                    config[key] = stored[key]
    except Exception as e:
        print(f"[!] Warning: could not load admin/dataConfig, using defaults: {e}")
    return config


def fetch_survey_responses(db) -> List[Dict[str, Any]]:
    if db is None:
        return []
    try:
        return [doc.to_dict() for doc in db.collection("survey_responses").stream()]
    except Exception as e:
        print(f"[!] Warning: could not fetch survey_responses: {e}")
        return []


def classify_income_band(pocket_money_range: Optional[str], config: Dict[str, Any]) -> str:
    cutoffs = config["incomeBandCutoffs"]
    labels = config["incomeBandLabels"]
    if not pocket_money_range:
        return "Unknown"
    val = POCKET_MONEY_MIDPOINTS.get(pocket_money_range)
    if val is None:
        return "Unknown"
    for i, cutoff in enumerate(cutoffs):
        if val < cutoff:
            return labels[i] if i < len(labels) else "Unknown"
    return labels[len(cutoffs)] if len(cutoffs) < len(labels) else labels[-1]


def _iqr_fence(values: List[float], threshold: float) -> List[float]:
    """Tukey fence: keeps only values within threshold * IQR of Q1/Q3.
    No-ops (returns values unchanged) below 4 points — a fence computed from
    fewer than 4 points is more likely to discard a real answer than catch a
    genuine outlier, so it's honest to skip it rather than apply a
    statistically meaningless filter."""
    if len(values) < 4:
        return values
    q1, _, q3 = statistics.quantiles(values, n=4, method="inclusive")
    iqr = q3 - q1
    lo, hi = q1 - threshold * iqr, q3 + threshold * iqr
    return [v for v in values if lo <= v <= hi]


def _describe(values_raw: List[float], config: Dict[str, Any]) -> Dict[str, Any]:
    """Median/IQR/sample-size for one category+band bucket, with outlier
    handling applied per config. Returns insufficient_data=True (no median/
    IQR fabricated) when there's literally nothing to describe."""
    n_raw = len(values_raw)
    if n_raw == 0:
        return {"insufficientData": True, "sampleSizeRaw": 0, "sampleSizeUsed": 0}

    outlier_cfg = config["outlierHandling"]
    values = (
        _iqr_fence(values_raw, outlier_cfg["thresholdIQR"])
        if outlier_cfg.get("enabled", True)
        else list(values_raw)
    )
    n_used = len(values)
    if n_used == 0:
        # Shouldn't happen (the fence keeps at least the quartiles' own
        # points) but stay honest if it somehow does rather than divide by zero.
        return {"insufficientData": True, "sampleSizeRaw": n_raw, "sampleSizeUsed": 0}

    median = statistics.median(values)
    if n_used >= 4:
        q1, _, q3 = statistics.quantiles(values, n=4, method="inclusive")
        iqr = round(q3 - q1, 2)
    else:
        q1 = q3 = median
        iqr = 0.0  # not fabricated as "no spread" — see insufficientForIQR below

    return {
        "insufficientData": False,
        "sampleSizeRaw": n_raw,
        "sampleSizeUsed": n_used,
        "outliersRemoved": n_raw - n_used,
        "median": round(median, 2),
        "q1": round(q1, 2),
        "q3": round(q3, 2),
        "iqr": iqr,
        "insufficientForIQR": n_used < 4,  # IQR above is a placeholder (=median) if true
        "min": round(min(values), 2),
        "max": round(max(values), 2),
    }


def _confidence_tier(sample_size_used: int, config: Dict[str, Any]) -> str:
    return "confident" if sample_size_used >= config["minSampleSizeConfident"] else "early_estimate"


def _blend_benchmark(raw_pct: float, weight: float, num_categories: int) -> float:
    """Blends a category's raw survey-derived share of spend toward a neutral
    uniform prior by (1 - weight) — the mechanism behind the superadmin's
    per-category trust multiplier. weight=1.0 -> fully trust raw_pct.
    weight=0.0 -> ignore it entirely, treat as no signal (uniform share).
    Never alters the raw displayed stats, only this derived value."""
    uniform_pct = 1.0 / num_categories if num_categories else 0.0
    w = max(0.0, min(1.0, weight))
    return round(w * raw_pct + (1 - w) * uniform_pct, 4)


def compute_stats(responses: List[Dict[str, Any]], config: Dict[str, Any]) -> Dict[str, Any]:
    """Core Stage 1 computation: per-category-per-income-band (and overall)
    median/IQR/sample size, plus a benchmark_pct/weight-adjusted figure ready
    to feed into engine.py's CATEGORIES_METADATA. See module docstring for
    what this deliberately is NOT (an embedding model)."""
    computed_at = datetime.now(timezone.utc).isoformat()
    n_total = len(responses)

    band_labels = list(config["incomeBandLabels"]) + ["Unknown"]
    weights = config.get("categoryWeights", {}) or {}

    # values[band][category] = [amounts...]; values["__overall__"][category] = [...]
    values: Dict[str, Dict[str, List[float]]] = {"__overall__": {k: [] for k in SURVEY_CATEGORY_KEYS}}
    for label in band_labels:
        values[label] = {k: [] for k in SURVEY_CATEGORY_KEYS}

    unmapped_categories: Dict[str, int] = {}
    band_counts: Dict[str, int] = {label: 0 for label in band_labels}

    for r in responses:
        band = classify_income_band((r.get("demographics") or {}).get("pocket_money_range"), config)
        band_counts[band] = band_counts.get(band, 0) + 1
        spend = r.get("category_spend") or {}
        for cat_id, amount in spend.items():
            try:
                amt = float(amount)
            except (TypeError, ValueError):
                continue
            if cat_id not in SURVEY_CATEGORY_KEYS:
                unmapped_categories[cat_id] = unmapped_categories.get(cat_id, 0) + 1
                continue
            values["__overall__"][cat_id].append(amt)
            values.setdefault(band, {}).setdefault(cat_id, []).append(amt)

    grand_total = sum(sum(vals) for vals in values["__overall__"].values())

    def build_category_block(cat_values: Dict[str, List[float]]) -> Dict[str, Any]:
        block = {}
        for cat_id in SURVEY_CATEGORY_KEYS:
            stats = _describe(cat_values.get(cat_id, []), config)
            weight = float(weights.get(cat_id, 1.0))
            if stats["insufficientData"]:
                raw_pct = 0.0
            else:
                cat_total = sum(cat_values.get(cat_id, []))
                raw_pct = (cat_total / grand_total) if grand_total > 0 else 0.0
            stats["rawBenchmarkPct"] = round(raw_pct, 4)
            stats["categoryWeight"] = weight
            stats["adjustedBenchmarkPct"] = _blend_benchmark(raw_pct, weight, len(SURVEY_CATEGORY_KEYS))
            stats["confidenceTier"] = (
                "early_estimate" if stats["insufficientData"] else _confidence_tier(stats["sampleSizeUsed"], config)
            )
            block[cat_id] = stats
        return block

    overall = build_category_block(values["__overall__"])
    by_income_band = {
        label: {"respondentCount": band_counts.get(label, 0), "categories": build_category_block(values.get(label, {}))}
        for label in band_labels
        if band_counts.get(label, 0) > 0  # don't report a phantom empty band
    }

    return {
        "computedAt": computed_at,
        "sampleSize": n_total,
        "grandTotalReported": round(grand_total, 2),
        "configUsed": config,
        "overall": overall,
        "byIncomeBand": by_income_band,
        "unmappedCategories": unmapped_categories,  # non-empty here is a real signal something needs attention
    }


def save_benchmarks(db, stats: Dict[str, Any]) -> None:
    if db is None:
        return
    db.collection("admin").document("categoryBenchmarks").set(stats)
    # Append a lightweight trend point (computedAt + sampleSize only, not the
    # full stats blob) so the Training Insights view has something real to
    # plot as more survey responses come in, instead of a single static number.
    db.collection("admin").document("categoryBenchmarks").collection("history").add(
        {"computedAt": stats["computedAt"], "sampleSize": stats["sampleSize"]}
    )


def load_benchmarks(db) -> Optional[Dict[str, Any]]:
    if db is None:
        return None
    try:
        snap = db.collection("admin").document("categoryBenchmarks").get()
        return snap.to_dict() if snap.exists else None
    except Exception as e:
        print(f"[!] Warning: could not load admin/categoryBenchmarks: {e}")
        return None


def load_benchmark_history(db, limit: int = 50) -> List[Dict[str, Any]]:
    if db is None:
        return []
    try:
        docs = (
            db.collection("admin")
            .document("categoryBenchmarks")
            .collection("history")
            .order_by("computedAt")
            .limit(limit)
            .stream()
        )
        return [d.to_dict() for d in docs]
    except Exception as e:
        print(f"[!] Warning: could not load benchmark history: {e}")
        return []


def generate_population_dot_graph(responses: List[Dict[str, Any]], config: Dict[str, Any]) -> Dict[str, Any]:
    """Population-level dot-graph preview (Step 10 item 4) — same visual
    language as the per-user dot graph in engine.py's generate_dot_graph
    (reuses the exact same PEER_ARCHETYPES definitions and node/link shape),
    but every node here is one survey RESPONDENT rather than one category.
    Explicitly a sanity check on the archetype-clustering approach against
    real population data before it's ever trusted on a single live user's
    transaction history — not a trained clustering model. With the current
    tiny sample size this will look sparse; that's honest, not a bug, and
    `sampleSize` is always attached so nothing downstream can present it as
    more than it is.
    """
    cat_keys = SURVEY_CATEGORY_KEYS
    nodes: List[Dict[str, Any]] = []
    links: List[Dict[str, Any]] = []

    # Fixed archetype anchor nodes, same 5 as the per-user dot graph, arranged
    # in an outer ring so respondent nodes have a stable reference frame.
    arc_radius = 260.0
    angle_step = (2 * math.pi) / len(PEER_ARCHETYPES)
    archetype_positions = {}
    for j, arc in enumerate(PEER_ARCHETYPES):
        ax = math.cos(j * angle_step) * arc_radius
        ay = math.sin(j * angle_step) * arc_radius
        archetype_positions[arc["id"]] = (ax, ay)
        nodes.append({
            "id": f"archetype_{arc['id']}",
            "label": arc["name"],
            "type": "archetype_center",
            "size": 22,
            "color": arc["color"],
            "x": round(ax, 2),
            "y": round(ay, 2),
            "metadata": {"description": arc["description"]},
        })

    respondent_count = 0
    for i, r in enumerate(responses):
        spend = r.get("category_spend") or {}
        vec = [float(spend.get(k, 0) or 0) for k in cat_keys]
        total = sum(vec)
        if total <= 0:
            continue  # a response with literally no spend logged has no pattern to place
        respondent_count += 1

        best_arc, best_sim = PEER_ARCHETYPES[0], -1.0
        for arc in PEER_ARCHETYPES:
            arc_vec = [arc["weights"].get(k, 0.01) for k in cat_keys]
            arc_norm, user_norm = np.linalg.norm(arc_vec), np.linalg.norm(vec)
            sim = float(np.dot(vec, arc_vec) / (arc_norm * user_norm)) if (arc_norm > 0 and user_norm > 0) else 0.0
            if sim > best_sim:
                best_sim, best_arc = sim, arc

        ax, ay = archetype_positions[best_arc["id"]]
        # Closer to its matched archetype = stronger match; jittered by
        # respondent index (deterministic, not random) so exact ties don't
        # visually stack on the same point.
        pull = max(0.15, min(0.85, best_sim))
        jitter_angle = (i * 47) % 360 * (math.pi / 180)
        jitter_r = 26.0
        nx = ax * pull + math.cos(jitter_angle) * jitter_r
        ny = ay * pull + math.sin(jitter_angle) * jitter_r

        band = classify_income_band((r.get("demographics") or {}).get("pocket_money_range"), config)
        node_id = f"respondent_{i}"
        nodes.append({
            "id": node_id,
            "label": f"Respondent {i + 1} ({band})",
            "type": "survey_respondent",
            "size": 10 + min(14, math.sqrt(total) / 4),
            "color": best_arc["color"],
            "x": round(nx, 2),
            "y": round(ny, 2),
            "metadata": {
                "totalReported": total,
                "incomeBand": band,
                "bestMatchArchetype": best_arc["name"],
                "similarityPct": round(best_sim * 100, 1),
            },
        })
        links.append({
            "source": node_id,
            "target": f"archetype_{best_arc['id']}",
            "strength": round(max(0.1, best_sim), 3),
            "distance": round(120 * (1 - pull) + 40, 1),
            "type": "similarity",
        })

    return {
        "sampleSize": len(responses),
        "respondentsPlotted": respondent_count,
        "nodes": nodes,
        "links": links,
        "note": (
            "Sanity-check preview only — clusters respondents against the same fixed archetype "
            "definitions the per-user dot graph uses, not a trained model. Treat any apparent "
            "clustering as illustrative until sampleSize is much larger."
        ),
    }


def run_etl(db) -> Dict[str, Any]:
    """End-to-end: load config, fetch responses, compute, persist. Called
    both at backend startup and on-demand from the superadmin recompute
    endpoint — the whole point (per the brief) is that changing dataConfig
    triggers this, not a redeploy."""
    config = load_data_config(db)
    responses = fetch_survey_responses(db)
    stats = compute_stats(responses, config)
    save_benchmarks(db, stats)
    return stats
