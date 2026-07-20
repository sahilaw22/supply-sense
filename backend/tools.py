"""
SupplySense Agent Tools
Implements the 3 tools available to the AI orchestrator:
  - query_database: safe read-only SQL execution
  - get_alternate_suppliers: ranked backup vendors for a given item
  - simulate_rerouting: cost/time delta analysis for switching supplier on a PO
"""

import re
from typing import Dict, List, Any, Optional
from backend.db import (
    execute_query,
    get_supplier_by_id,
    get_component_by_id,
    get_po_by_id,
)

# ---------------------------------------------------------------------------
# Safety: only these tables/views may be queried
# ---------------------------------------------------------------------------
ALLOWED_TABLES = {
    "suppliers",
    "warehouses",
    "components",
    "inventory_levels",
    "purchase_orders",
    "store_sales",
    "ecomm_sales",
    "ecomm_inventory",
    "ecomm_instock",
    "ecomm_returns",
    "dc_metrics",
    "order_forecast",
    "demand_forecast",
    "vendor_scorecard",
    "tender_analysis",
    "store_mumd",
    "modular_plan",
    "future_valid_stores",
    "item_master",
}

# Reject any DML or DDL keyword (belt-and-suspenders on top of the whitelist)
_FORBIDDEN_PATTERN = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|ATTACH|DETACH|PRAGMA)\b",
    re.IGNORECASE,
)


def _validate_sql(sql_query: str) -> Optional[str]:
    """
    Returns an error string if the query is unsafe, else None.
    """
    if _FORBIDDEN_PATTERN.search(sql_query):
        return "Query rejected: only SELECT statements are allowed."

    # Check at least one allowed table is referenced
    lowered = sql_query.lower()
    if not any(table in lowered for table in ALLOWED_TABLES):
        return f"Query rejected: must reference one of {sorted(ALLOWED_TABLES)}."

    return None


# ---------------------------------------------------------------------------
# Tool 1: query_database
# ---------------------------------------------------------------------------

def query_database(sql_query: str) -> Dict[str, Any]:
    """
    Execute a read-only SQL SELECT against supplysense.db.

    Args:
        sql_query: A SQL SELECT statement referencing the supply-chain tables.

    Returns:
        {
            "rows": List[Dict],
            "row_count": int,
            "error": str | None
        }
    """
    err = _validate_sql(sql_query)
    if err:
        return {"rows": [], "row_count": 0, "error": err}

    try:
        rows = execute_query(sql_query)
        return {"rows": rows, "row_count": len(rows), "error": None}
    except Exception as exc:  # pragma: no cover
        return {"rows": [], "row_count": 0, "error": str(exc)}


# ---------------------------------------------------------------------------
# Tool 2: get_alternate_suppliers
# ---------------------------------------------------------------------------

def get_alternate_suppliers(item_id: str, quantity: int) -> Dict[str, Any]:
    """
    Return ranked alternate suppliers for a given component.

    Ranking criteria (ascending priority):
      1. lead_time_days (lower is better)
      2. historical_fulfillment_rate (higher is better)
      3. unit_cost (lower is better — from components table)

    Args:
        item_id: Component identifier (e.g. "ITEM-001")
        quantity: Requested quantity (used for estimated total cost)

    Returns:
        {
            "item_id": str,
            "item_name": str,
            "quantity": int,
            "alternates": [
                {
                    "rank": int,
                    "supplier_id": str,
                    "name": str,
                    "location": str,
                    "lead_time_days": int,
                    "historical_fulfillment_rate": float,
                    "delivery_performance_score": float,
                    "unit_cost": float,
                    "estimated_total_cost": float,
                }
            ],
            "error": str | None
        }
    """
    component = get_component_by_id(item_id)
    if not component:
        return {
            "item_id": item_id,
            "item_name": "Unknown",
            "quantity": quantity,
            "alternates": [],
            "error": f"Component '{item_id}' not found.",
        }

    unit_cost: float = component.get("unit_cost", 0.0)
    item_name: str = component.get("name", item_id)

    # Pull all suppliers and rank them
    all_suppliers = execute_query("SELECT * FROM suppliers")

    ranked: List[Dict[str, Any]] = []
    for s in all_suppliers:
        ranked.append(
            {
                "supplier_id": s["supplier_id"],
                "name": s["name"],
                "location": s["location"],
                "lead_time_days": s["lead_time_days"],
                "historical_fulfillment_rate": s["historical_fulfillment_rate"],
                "delivery_performance_score": s["delivery_performance_score"],
                "unit_cost": unit_cost,
                "estimated_total_cost": round(unit_cost * quantity, 2),
            }
        )

    # Sort: lead_time ASC, fulfillment_rate DESC, unit_cost ASC
    ranked.sort(
        key=lambda x: (
            x["lead_time_days"],
            -x["historical_fulfillment_rate"],
            x["unit_cost"],
        )
    )

    # Assign ranks and cap at top 5
    top5 = ranked[:5]
    for i, supplier in enumerate(top5, start=1):
        supplier["rank"] = i

    return {
        "item_id": item_id,
        "item_name": item_name,
        "quantity": quantity,
        "alternates": top5,
        "error": None,
    }


# ---------------------------------------------------------------------------
# Tool 3: simulate_rerouting
# ---------------------------------------------------------------------------

def simulate_rerouting(po_id: str, new_supplier_id: str) -> Dict[str, Any]:
    """
    Simulate switching an in-transit PO to a different supplier.

    Computes:
      - Lead time delta (new vs. original)
      - Estimated cost delta (price difference × quantity)
      - Stockout risk reduction (based on fulfillment rate difference)
      - A plain-language recommendation

    Args:
        po_id: Purchase order ID (e.g. "PO-889")
        new_supplier_id: The proposed new supplier ID (e.g. "SUP-003")

    Returns:
        {
            "po_id": str,
            "original_supplier_id": str,
            "original_supplier_name": str,
            "original_lead_time_days": int,
            "new_supplier_id": str,
            "new_supplier_name": str,
            "new_lead_time_days": int,
            "lead_time_delta_days": int,
            "estimated_cost_delta_usd": float,
            "stockout_risk_reduction": float,
            "recommendation": str,
            "error": str | None
        }
    """
    po = get_po_by_id(po_id)
    if not po:
        return {
            "po_id": po_id,
            "error": f"Purchase order '{po_id}' not found.",
        }

    original_supplier = get_supplier_by_id(po["supplier_id"])
    new_supplier = get_supplier_by_id(new_supplier_id)

    if not original_supplier:
        return {"po_id": po_id, "error": f"Original supplier '{po['supplier_id']}' not found."}
    if not new_supplier:
        return {"po_id": po_id, "error": f"New supplier '{new_supplier_id}' not found."}

    component = get_component_by_id(po["item_id"])
    unit_cost: float = component.get("unit_cost", 0.0) if component else 0.0
    quantity: int = po.get("quantity", 0)

    orig_lead = original_supplier["lead_time_days"]
    new_lead = new_supplier["lead_time_days"]
    lead_delta = new_lead - orig_lead  # positive = slower

    orig_cost = unit_cost * quantity
    # New supplier may have a different implicit rate; use fulfillment rate as a
    # proxy cost modifier (lower fulfillment = cheaper but riskier).
    cost_modifier = 1.0 + (new_supplier["historical_fulfillment_rate"] - original_supplier["historical_fulfillment_rate"]) * 0.05
    new_cost = orig_cost * cost_modifier
    cost_delta = round(new_cost - orig_cost, 2)

    # Stockout risk reduction: difference in fulfillment rates, bounded 0-1
    fulfillment_delta = new_supplier["historical_fulfillment_rate"] - original_supplier["historical_fulfillment_rate"]
    risk_reduction = round(max(-1.0, min(1.0, fulfillment_delta)), 3)

    # Plain-language recommendation
    if risk_reduction > 0 and lead_delta <= 2:
        recommendation = (
            f"Switch recommended — {new_supplier['name']} offers a {fulfillment_delta*100:.1f}% "
            f"higher fulfillment rate with only {abs(lead_delta)} day(s) additional lead time."
        )
    elif risk_reduction > 0 and lead_delta > 2:
        recommendation = (
            f"Switch advisable with caution — {new_supplier['name']} has better reliability "
            f"({new_supplier['historical_fulfillment_rate']*100:.0f}%) but adds {lead_delta} days. "
            "Approve only if current stock covers the delay."
        )
    elif lead_delta < 0:
        recommendation = (
            f"{new_supplier['name']} delivers {abs(lead_delta)} day(s) faster. "
            "Switch recommended if timeline is critical."
        )
    else:
        recommendation = (
            f"No significant advantage identified for switching to {new_supplier['name']}. "
            "Keep original supplier unless disruption forces change."
        )

    return {
        "po_id": po_id,
        "original_supplier_id": original_supplier["supplier_id"],
        "original_supplier_name": original_supplier["name"],
        "original_lead_time_days": orig_lead,
        "new_supplier_id": new_supplier["supplier_id"],
        "new_supplier_name": new_supplier["name"],
        "new_lead_time_days": new_lead,
        "lead_time_delta_days": lead_delta,
        "estimated_cost_delta_usd": cost_delta,
        "stockout_risk_reduction": risk_reduction,
        "recommendation": recommendation,
        "error": None,
    }
