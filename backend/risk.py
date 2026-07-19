"""
SupplySense Risk Scoring Module
Calculates stockout risk using the P(S) formula from PRD.
P(S) = (1 - fulfillment_rate) + (lead_time_days / 30) + (1 - delivery_performance / 5)
"""

from typing import Dict, Literal
from backend.db import (
    get_supplier_by_id,
    get_component_by_id,
    get_inventory_level
)


def calculate_stockout_risk(
    item_id: str,
    warehouse_id: str,
    supplier_id: str
) -> float:
    """
    Calculate stockout risk for a component at a warehouse from a supplier.

    Formula from PRD §6:
    S_in  = realistic_replenishment × L × F_h
    S_out = D_f × L
    P(S)  = clip((S_out - I_c - S_in) / S_out, 0, 1)

    Where:
    - I_c: current stock
    - D_f: forecasted demand
    - L: lead time (days)
    - F_h: historical fulfillment rate
    - realistic_replenishment: forecasted_demand (assumed replenishment rate)

    Args:
        item_id: Component identifier
        warehouse_id: Warehouse identifier
        supplier_id: Supplier identifier

    Returns:
        Risk score (0.0 to 1.0, where 0 = fully covered, 1 = guaranteed stockout)
    """
    # Get supplier data
    supplier = get_supplier_by_id(supplier_id)
    if not supplier:
        return 0.0

    # Get inventory level
    inventory = get_inventory_level(item_id, warehouse_id)
    if not inventory:
        return 0.0

    # Extract required metrics
    current_stock = inventory.get('current_stock', 0)
    forecasted_demand = inventory.get('forecasted_demand', 1)  # Avoid division by zero
    lead_time_days = supplier.get('lead_time_days', 7)
    fulfillment_rate = supplier.get('historical_fulfillment_rate', 0.9)

    # Avoid division by zero
    if forecasted_demand <= 0:
        forecasted_demand = 1

    # Calculate using PRD formula
    # realistic_replenishment is assumed to be forecasted_demand
    realistic_replenishment = forecasted_demand

    # Expected demand during lead time
    S_out = forecasted_demand * lead_time_days

    # Expected incoming supply during lead time (accounting for fulfillment rate)
    S_in = realistic_replenishment * lead_time_days * fulfillment_rate

    # Stockout probability: (demand - current_stock - incoming) / demand
    # Clamped to [0, 1]
    if S_out <= 0:
        return 0.0

    risk_score = (S_out - current_stock - S_in) / S_out
    return max(0.0, min(1.0, risk_score))


def get_risk_category(risk_score: float) -> Literal["Safe", "Warning", "Critical"]:
    """
    Categorize a risk score into Safe, Warning, or Critical.

    Args:
        risk_score: Calculated risk score (0.0-1.0)

    Returns:
        Risk category string: "Safe", "Warning", or "Critical"
    """
    if risk_score <= 0.2:
        return "Safe"
    elif risk_score <= 0.6:
        return "Warning"
    else:
        return "Critical"


def get_risk_color(risk_score: float) -> str:
    """
    Get the design system color hex code for a risk score.
    
    Design tokens from PRD §8:
    - Safe: #22C55E (green)
    - Warning: #F59E0B (amber/orange)
    - Critical: #EF4444 (red)
    
    Args:
        risk_score: Calculated risk score (0.0-3.0)
        
    Returns:
        Hex color code string
    """
    category = get_risk_category(risk_score)
    
    color_map = {
        "Safe": "#22C55E",
        "Warning": "#F59E0B",
        "Critical": "#EF4444"
    }
    
    return color_map.get(category, "#F5F5F7")


def get_risk_assessment(
    item_id: str,
    warehouse_id: str,
    supplier_id: str
) -> Dict[str, any]:
    """
    Get comprehensive risk assessment for a component at a warehouse.
    
    Args:
        item_id: Component identifier
        warehouse_id: Warehouse identifier
        supplier_id: Supplier identifier
        
    Returns:
        Dictionary with risk_score, category, color, and details
    """
    risk_score = calculate_stockout_risk(item_id, warehouse_id, supplier_id)
    category = get_risk_category(risk_score)
    color = get_risk_color(risk_score)
    
    return {
        "risk_score": round(risk_score, 2),
        "category": category,
        "color": color,
        "item_id": item_id,
        "warehouse_id": warehouse_id,
        "supplier_id": supplier_id
    }
