"""
SupplySense Backend API
FastAPI application — all 6 endpoints from PRD §7 wired to real data.

Endpoints:
  GET  /api/dashboard              — full supply-chain snapshot
  POST /api/query                  — NL query → AI orchestrator → JSON contract
  POST /api/simulate/disruption    — scripted JNPT port strike
  POST /api/suppliers/alternate    — ranked alternate suppliers for a component
  POST /api/reroute                — simulated PO rerouting analysis
  POST /api/summary/generate       — markdown executive summary
"""

import logging
import os
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from backend.db import (
    execute_query,
    get_all_purchase_orders,
    get_component_by_id,
    get_supplier_by_id,
)
from backend.risk import get_risk_assessment
from backend.tools import get_alternate_suppliers, simulate_rerouting
from backend.disruptions import trigger_jnpt_disruption, get_active_disruption, clear_disruption

load_dotenv()
backend_env_local = os.path.join(os.path.dirname(__file__), ".env.local")
if os.path.exists(backend_env_local):
    load_dotenv(backend_env_local, override=True)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(
    title="SupplySense API",
    description="AI Supply Chain Risk & Inventory Intelligence — PRD §7 endpoints",
    version="1.0.0",
    docs_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class QueryRequest(BaseModel):
    question: str


class AlternateSupplierRequest(BaseModel):
    item_id: str
    quantity: int = 100


class RerouteRequest(BaseModel):
    po_id: str
    new_supplier_id: str


# ---------------------------------------------------------------------------
# Utility: build JSON contract wrapper
# ---------------------------------------------------------------------------

def _contract(intent: str, frontend_action: str, payload: dict, summary: str) -> dict:
    return {
        "intent": intent,
        "frontend_action": frontend_action,
        "payload": payload,
        "summary": summary,
    }


# ---------------------------------------------------------------------------
# GET /  and  GET /health
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    return {"message": "SupplySense API is running", "status": "healthy", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "SupplySense"}


# ---------------------------------------------------------------------------
# GET /api/dashboard
# ---------------------------------------------------------------------------

@app.get("/api/dashboard")
async def dashboard():
    """
    Full supply-chain snapshot:
    - inventory levels with risk scores
    - warehouse utilization
    - supplier risk metrics
    - purchase orders (with supplier & item names joined)
    - map data (warehouse + supplier nodes + active PO routes)
    """

    # --- Inventory with risk scores ---
    inv_rows = execute_query(
        """
        SELECT
            il.item_id,
            c.name          AS item_name,
            c.category,
            il.warehouse_id,
            w.name          AS warehouse_name,
            w.location      AS warehouse_location,
            il.current_stock,
            il.reorder_point,
            il.forecasted_demand
        FROM inventory_levels il
        JOIN components  c ON il.item_id      = c.item_id
        JOIN warehouses  w ON il.warehouse_id = w.warehouse_id
        ORDER BY il.item_id, il.warehouse_id
        """
    )

    inventory = []
    for row in inv_rows:
        # Find default supplier for this item (first PO supplier for this item)
        po_row = execute_query(
            "SELECT supplier_id FROM purchase_orders WHERE item_id = ? LIMIT 1",
            (row["item_id"],),
        )
        supplier_id = po_row[0]["supplier_id"] if po_row else "SUP-001"
        assessment = get_risk_assessment(row["item_id"], row["warehouse_id"], supplier_id)
        inventory.append(
            {
                **row,
                "risk_score": assessment["risk_score"],
                "risk_category": assessment["category"],
                "risk_color": assessment["color"],
            }
        )

    # --- Warehouses ---
    warehouses = execute_query("SELECT * FROM warehouses ORDER BY warehouse_id")

    # --- Suppliers ---
    suppliers = execute_query("SELECT * FROM suppliers ORDER BY delivery_performance_score DESC")

    # --- Purchase orders (joined) ---
    pos_raw = execute_query(
        """
        SELECT
            po.po_id,
            po.supplier_id,
            s.name          AS supplier_name,
            po.item_id,
            c.name          AS item_name,
            po.quantity,
            po.expected_delivery_date,
            po.status,
            po.transit_route
        FROM purchase_orders po
        JOIN suppliers  s ON po.supplier_id = s.supplier_id
        JOIN components c ON po.item_id     = c.item_id
        ORDER BY po.expected_delivery_date
        """
    )

    # --- Map data ---
    # Warehouse nodes
    wh_nodes = [
        {
            "id": w["warehouse_id"],
            "name": w["name"],
            "location": w["location"],
            "type": "warehouse",
            "utilization": w["current_utilization"],
        }
        for w in warehouses
    ]

    # Supplier nodes
    sup_nodes = [
        {
            "id": s["supplier_id"],
            "name": s["name"],
            "location": s["location"],
            "type": "supplier",
            "delivery_score": s["delivery_performance_score"],
        }
        for s in suppliers
    ]

    # Active routes from in-transit POs
    routes = [
        {
            "po_id": po["po_id"],
            "supplier_id": po["supplier_id"],
            "transit_route": po["transit_route"],
            "status": po["status"],
            "item_name": po["item_name"],
        }
        for po in pos_raw
        if po["status"] in ("In Transit", "Delayed")
    ]

    # Active disruption overlay
    active_disruption = get_active_disruption()

    return {
        "inventory": inventory,
        "warehouses": warehouses,
        "suppliers": suppliers,
        "purchase_orders": pos_raw,
        "map": {
            "warehouse_nodes": wh_nodes,
            "supplier_nodes": sup_nodes,
            "active_routes": routes,
        },
        "active_disruption": active_disruption or None,
    }


# ---------------------------------------------------------------------------
# POST /api/query
# ---------------------------------------------------------------------------

@app.post("/api/query")
async def query(request: QueryRequest):
    """
    Natural-language query → AI orchestrator → JSON contract response.
    """
    # Lazy import to avoid startup overhead when no API key is set
    from backend.orchestrator import orchestrate_query

    if not request.question.strip():
        raise HTTPException(status_code=400, detail="question must not be empty")

    logger.info("NL query: %s", request.question)
    result = await orchestrate_query(request.question)
    return result


# ---------------------------------------------------------------------------
# POST /api/simulate/disruption
# ---------------------------------------------------------------------------

@app.post("/api/simulate/disruption")
async def simulate_disruption():
    """
    Trigger the scripted JNPT Port Strike disruption scenario.
    Marks affected POs as Delayed in-memory, recomputes risk deltas.
    """
    disruption = trigger_jnpt_disruption()
    return _contract(
        intent="ALERT",
        frontend_action="UPDATE_MAP_HIGHLIGHT",
        payload=disruption,
        summary=disruption.get("alert_text", "JNPT disruption triggered."),
    )


# ---------------------------------------------------------------------------
# POST /api/suppliers/alternate
# ---------------------------------------------------------------------------

@app.post("/api/suppliers/alternate")
async def alternate_suppliers(request: AlternateSupplierRequest):
    """
    Return ranked alternate suppliers for a given component.
    """
    result = get_alternate_suppliers(item_id=request.item_id, quantity=request.quantity)

    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])

    summary = (
        f"Found {len(result['alternates'])} alternate supplier(s) for "
        f"{result['item_name']}. "
        f"Top pick: {result['alternates'][0]['name']} "
        f"({result['alternates'][0]['lead_time_days']}d lead, "
        f"{result['alternates'][0]['historical_fulfillment_rate']*100:.0f}% fulfillment)."
        if result["alternates"]
        else f"No alternate suppliers found for {result['item_name']}."
    )

    return _contract(
        intent="DISRUPTION_MITIGATION",
        frontend_action="RENDER_TABLE",
        payload=result,
        summary=summary,
    )


# ---------------------------------------------------------------------------
# POST /api/reroute
# ---------------------------------------------------------------------------

@app.post("/api/reroute")
async def reroute(request: RerouteRequest):
    """
    Simulate switching a PO to a different supplier.
    Returns lead-time delta, cost delta, and risk reduction.
    """
    result = simulate_rerouting(
        po_id=request.po_id,
        new_supplier_id=request.new_supplier_id,
    )

    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])

    return _contract(
        intent="DISRUPTION_MITIGATION",
        frontend_action="SHOW_MODAL",
        payload=result,
        summary=result.get("recommendation", "Rerouting analysis complete."),
    )


# ---------------------------------------------------------------------------
# POST /api/summary/generate
# ---------------------------------------------------------------------------

@app.post("/api/summary/generate")
async def generate_summary():
    """
    Generate a markdown executive summary of the current supply chain state.
    Highlights critical items, delayed POs, and active disruptions.
    """
    # Gather data
    critical_items = execute_query(
        """
        SELECT c.name, il.warehouse_id, il.current_stock, il.reorder_point
        FROM inventory_levels il
        JOIN components c ON il.item_id = c.item_id
        WHERE il.current_stock < il.reorder_point
        ORDER BY (il.current_stock * 1.0 / il.reorder_point) ASC
        LIMIT 10
        """
    )

    delayed_pos = execute_query(
        """
        SELECT po.po_id, s.name AS supplier, c.name AS item, po.quantity, po.transit_route
        FROM purchase_orders po
        JOIN suppliers s ON po.supplier_id = s.supplier_id
        JOIN components c ON po.item_id = c.item_id
        WHERE po.status IN ('Delayed', 'In Transit')
        ORDER BY po.expected_delivery_date
        """
    )

    top_risk_suppliers = execute_query(
        """
        SELECT name, delivery_performance_score, historical_fulfillment_rate, lead_time_days
        FROM suppliers
        ORDER BY delivery_performance_score ASC
        LIMIT 5
        """
    )

    active_disruption = get_active_disruption()
    disruption_section = ""
    if active_disruption:
        disruption_section = (
            f"\n\n## ⚠️ Active Disruption\n"
            f"**{active_disruption.get('type', 'Unknown')}** — {active_disruption.get('route', '')}\n"
            f"{active_disruption.get('alert_text', '')}\n"
            f"*Triggered at: {active_disruption.get('triggered_at', 'N/A')}*"
        )

    # Build markdown
    lines = ["# SupplySense — Executive Supply Chain Summary\n"]

    lines.append("## 🔴 Items Below Reorder Point")
    if critical_items:
        lines.append("| Item | Warehouse | Stock | Reorder Point |")
        lines.append("|---|---|---|---|")
        for item in critical_items:
            lines.append(
                f"| {item['name']} | {item['warehouse_id']} "
                f"| {item['current_stock']} | {item['reorder_point']} |"
            )
    else:
        lines.append("All inventory levels are above reorder points. ✅")

    lines.append("\n## 📦 In-Transit / Delayed Purchase Orders")
    if delayed_pos:
        lines.append("| PO ID | Supplier | Item | Qty | Route |")
        lines.append("|---|---|---|---|---|")
        for po in delayed_pos:
            lines.append(
                f"| {po['po_id']} | {po['supplier']} | {po['item']} "
                f"| {po['quantity']} | {po['transit_route']} |"
            )
    else:
        lines.append("No delayed purchase orders. ✅")

    lines.append("\n## ⚡ Supplier Risk Overview (Lowest Performing)")
    if top_risk_suppliers:
        lines.append("| Supplier | Delivery Score | Fulfillment Rate | Lead Time |")
        lines.append("|---|---|---|---|")
        for s in top_risk_suppliers:
            lines.append(
                f"| {s['name']} | {s['delivery_performance_score']:.1f}/5 "
                f"| {s['historical_fulfillment_rate']*100:.0f}% | {s['lead_time_days']}d |"
            )

    if disruption_section:
        lines.append(disruption_section)

    markdown_text = "\n".join(lines)

    return _contract(
        intent="DB_QUERY",
        frontend_action="SHOW_MODAL",
        payload={"markdown": markdown_text},
        summary="Executive summary generated. Review critical items and delayed POs.",
    )


# ---------------------------------------------------------------------------
# DELETE /api/simulate/disruption/reset
# ---------------------------------------------------------------------------

@app.delete("/api/simulate/disruption/reset")
async def reset_disruption():
    """
    Clear the active disruption state — wires up the frontend 'Reset' button.
    """
    clear_disruption()
    return _contract(
        intent="ALERT",
        frontend_action="UPDATE_MAP_HIGHLIGHT",
        payload={"reset": True},
        summary="Disruption cleared. Network returned to normal state.",
    )


# ---------------------------------------------------------------------------
# GET /api/suppliers/alternate/{item_id}  (convenience GET variant)
# ---------------------------------------------------------------------------

@app.get("/api/suppliers/alternate/{item_id}")
async def alternate_suppliers_get(item_id: str, quantity: int = 100):
    """
    GET convenience variant — same as POST /api/suppliers/alternate.
    """
    result = get_alternate_suppliers(item_id=item_id, quantity=quantity)
    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])
    summary = (
        f"Found {len(result['alternates'])} alternate supplier(s) for "
        f"{result['item_name']}. "
        f"Top pick: {result['alternates'][0]['name']} "
        f"({result['alternates'][0]['lead_time_days']}d lead, "
        f"{result['alternates'][0]['historical_fulfillment_rate']*100:.0f}% fulfillment)."
        if result["alternates"]
        else f"No alternate suppliers found for {result['item_name']}."
    )
    return _contract(
        intent="DISRUPTION_MITIGATION",
        frontend_action="RENDER_TABLE",
        payload=result,
        summary=summary,
    )


# ---------------------------------------------------------------------------
# Debug catch-all — shows path FastAPI receives
# ---------------------------------------------------------------------------

@app.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def debug_path(full_path: str, request: Request):
    return {
        "full_path": full_path,
        "method": request.method,
        "url": str(request.url),
        "path": request.url.path,
        "root_path": request.scope.get("root_path", ""),
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
