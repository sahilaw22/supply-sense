"""
SupplySense Disruption Simulation Module
Handles the scripted JNPT Port Strike disruption scenario.

Keeps disruption state in-memory (no DB writes) for demo purposes.
The backend restarts clean between demos.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, List

from backend.db import execute_query

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# In-memory disruption state (reset on server restart)
# ---------------------------------------------------------------------------
_active_disruption: Dict[str, Any] = {}


def get_active_disruption() -> Dict[str, Any]:
    """Return the currently active disruption, or empty dict if none."""
    return _active_disruption.copy()


def clear_disruption() -> None:
    """Reset disruption state (useful for demo reset)."""
    global _active_disruption
    _active_disruption = {}


# ---------------------------------------------------------------------------
# Scripted JNPT disruption
# ---------------------------------------------------------------------------

_JNPT_ROUTE = "JNPT-Mumbai Port Corridor"


def trigger_jnpt_disruption() -> Dict[str, Any]:
    """
    Trigger the scripted JNPT Port Strike disruption.

    Effects (in-memory only):
      1. Find all POs on the JNPT-Mumbai Port Corridor route with status != Delivered
      2. Mark them as Delayed in the disruption state
      3. Recompute risk deltas for affected items
      4. Return a full disruption report

    Returns the structured disruption report consumed by /api/simulate/disruption.
    """
    global _active_disruption

    # --- Find affected POs ---
    affected_pos_rows: List[Dict[str, Any]] = execute_query(
        "SELECT po_id, supplier_id, item_id, quantity, status, transit_route "
        "FROM purchase_orders WHERE transit_route = ? AND status != 'Delivered'",
        (_JNPT_ROUTE,),
    )

    affected_po_ids = [row["po_id"] for row in affected_pos_rows]
    affected_item_ids = list({row["item_id"] for row in affected_pos_rows})
    affected_warehouse_ids: List[str] = []

    # --- Compute risk deltas per affected item ---
    risk_delta: Dict[str, Dict[str, Any]] = {}

    for item_id in affected_item_ids:
        # Find warehouses stocking this item
        wh_rows = execute_query(
            "SELECT il.warehouse_id, il.current_stock, il.reorder_point, il.forecasted_demand, "
            "       w.name as warehouse_name "
            "FROM inventory_levels il "
            "JOIN warehouses w ON il.warehouse_id = w.warehouse_id "
            "WHERE il.item_id = ?",
            (item_id,),
        )

        for wh in wh_rows:
            wh_id = wh["warehouse_id"]
            if wh_id not in affected_warehouse_ids:
                affected_warehouse_ids.append(wh_id)

            current_stock = wh["current_stock"]
            reorder_point = wh["reorder_point"]
            forecasted_demand = wh["forecasted_demand"]

            # Baseline risk (simple ratio: below reorder = higher risk)
            if forecasted_demand > 0:
                old_risk = round(
                    max(0.0, min(1.0, 1.0 - (current_stock / (reorder_point or 1)))), 2
                )
            else:
                old_risk = 0.0

            # After disruption: stock doesn't increase (PO delayed), demand continues
            # New risk assumes the PO quantity (now delayed) was counted in the buffer
            po_quantity = sum(
                row["quantity"]
                for row in affected_pos_rows
                if row["item_id"] == item_id
            )
            effective_stock = max(0, current_stock - forecasted_demand * 7)  # 1-week demand drain
            new_risk = round(
                max(0.0, min(1.0, 1.0 - (effective_stock / (reorder_point or 1)))), 2
            )

            risk_delta[f"{item_id}@{wh_id}"] = {
                "item_id": item_id,
                "warehouse_id": wh_id,
                "warehouse_name": wh["warehouse_name"],
                "old_risk": old_risk,
                "new_risk": new_risk,
                "risk_increase": round(new_risk - old_risk, 2),
                "po_quantity_delayed": po_quantity,
            }

    # --- Build component names lookup ---
    item_name_map: Dict[str, str] = {}
    if affected_item_ids:
        placeholders = ",".join("?" for _ in affected_item_ids)
        comp_rows = execute_query(
            f"SELECT item_id, name FROM components WHERE item_id IN ({placeholders})",
            tuple(affected_item_ids),
        )
        item_name_map = {r["item_id"]: r["name"] for r in comp_rows}

    # --- Build the final disruption record ---
    disruption_id = f"DISRUPT-{datetime.now(timezone.utc).strftime('%Y-%m-%d-%H%M%S')}"
    alert_text = (
        f"JNPT-Mumbai Port Corridor disruption detected. "
        f"Port closure estimated 48 hours. "
        f"{len(affected_po_ids)} purchase order(s) affected "
        f"({', '.join(affected_po_ids)}). "
        "Immediate rerouting action recommended."
    )
    if affected_item_ids:
        names = [item_name_map.get(i, i) for i in affected_item_ids]
        alert_text += f" Impacted components: {', '.join(names)}."

    _active_disruption = {
        "disruption_id": disruption_id,
        "type": "JNPT_PORT_STRIKE",
        "route": _JNPT_ROUTE,
        "affected_pos": affected_po_ids,
        "affected_items": [
            {"item_id": iid, "item_name": item_name_map.get(iid, iid)}
            for iid in affected_item_ids
        ],
        "affected_warehouses": affected_warehouse_ids,
        "duration_estimate_hours": 48,
        "risk_delta": risk_delta,
        "alert_text": alert_text,
        "triggered_at": datetime.now(timezone.utc).isoformat(),
    }

    logger.info("Disruption triggered: %s", disruption_id)
    return _active_disruption.copy()
