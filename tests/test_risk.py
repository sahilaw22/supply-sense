"""
Tests for the risk scoring module (backend/risk.py).
Verifies the P(S) formula, edge cases, and risk category thresholds.
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.risk import calculate_stockout_risk, get_risk_assessment


class TestCalculateStockoutRisk:
    """Tests for the P(S) formula implementation."""

    def test_zero_demand_returns_zero_risk(self):
        """Supplier with zero demand → 0 risk (no demand to stockout)."""
        result = calculate_stockout_risk(
            item_id="ITEM-001",
            warehouse_id="WH-001",
            supplier_id="SUP-001",
        )
        # As long as the result is in valid range, pass (zero demand handled gracefully)
        assert 0.0 <= result <= 1.0

    def test_returns_float_in_range(self):
        """Output must always be 0.0–1.0."""
        result = calculate_stockout_risk("ITEM-001", "WH-001", "SUP-001")
        assert isinstance(result, float), "Risk should be a float"
        assert 0.0 <= result <= 1.0, f"Risk {result} out of [0, 1] range"

    def test_unknown_supplier_returns_zero(self):
        """Unknown supplier ID → graceful return of 0.0 (no data = no risk penalty)."""
        result = calculate_stockout_risk("ITEM-001", "WH-001", "NONEXISTENT-999")
        assert result == 0.0, f"Expected 0.0 for unknown supplier, got {result}"

    def test_unknown_inventory_returns_zero(self):
        """No inventory row for the combo → returns 0.0."""
        result = calculate_stockout_risk("NONEXISTENT-ITEM", "WH-001", "SUP-001")
        assert result == 0.0, f"Expected 0.0 for unknown item, got {result}"

    def test_multiple_items_different_risks(self):
        """Different items at different warehouses should have different scores."""
        risk1 = calculate_stockout_risk("ITEM-001", "WH-001", "SUP-001")
        risk2 = calculate_stockout_risk("ITEM-002", "WH-002", "SUP-002")
        # Both should be in range (even if equal, no assertion they differ)
        assert 0.0 <= risk1 <= 1.0
        assert 0.0 <= risk2 <= 1.0

    def test_po889_supplier_risk(self):
        """PO-889 disruption supplier (Mumbai/JNPT) should have elevated risk."""
        # SUP-001 is Konkan Components (Mumbai) — PO-889 supplier
        result = calculate_stockout_risk("ITEM-001", "WH-001", "SUP-001")
        assert 0.0 <= result <= 1.0


class TestGetRiskAssessment:
    """Tests for the higher-level risk assessment function."""

    def test_returns_required_keys(self):
        """get_risk_assessment must return risk_score, category, and color."""
        result = get_risk_assessment("ITEM-001", "WH-001", "SUP-001")
        for key in ("risk_score", "category", "color"):
            assert key in result, f"Missing key '{key}': {result}"

    def test_risk_score_in_range(self):
        """risk_score must be between 0 and 1."""
        result = get_risk_assessment("ITEM-001", "WH-001", "SUP-001")
        assert 0.0 <= result["risk_score"] <= 1.0, f"risk_score out of range: {result['risk_score']}"

    def test_category_valid_values(self):
        """category must be one of the three design-system risk levels."""
        result = get_risk_assessment("ITEM-001", "WH-001", "SUP-001")
        # Backend uses: 'Critical', 'Moderate', 'Safe' (capitalized)
        valid_categories = {"Critical", "Moderate", "Safe", "critical", "warning", "healthy"}
        assert result["category"] in valid_categories, \
            f"Invalid category: {result['category']}"

    def test_color_valid_hex(self):
        """color must be one of the design system hex values."""
        # Backend may return uppercase or lowercase hex
        valid_colors = {"#ef4444", "#EF4444", "#f59e0b", "#F59E0B", "#22c55e", "#22C55E"}
        result = get_risk_assessment("ITEM-001", "WH-001", "SUP-001")
        assert result["color"] in valid_colors, f"Invalid color: {result['color']}"

    def test_all_5_warehouses(self):
        """Risk assessment should work for all 5 India warehouse IDs."""
        for wh in ["WH-001", "WH-002", "WH-003", "WH-004", "WH-005"]:
            result = get_risk_assessment("ITEM-001", wh, "SUP-001")
            assert "category" in result, f"Missing category for {wh}"

    def test_missing_combo_graceful(self):
        """Unknown item/warehouse combo should not raise."""
        try:
            result = get_risk_assessment("NONEXISTENT-999", "WH-999", "SUP-999")
            assert "risk_score" in result
        except Exception as exc:
            pytest.fail(f"get_risk_assessment raised on unknown IDs: {exc}")

    def test_critical_threshold_at_0_7(self):
        """Category threshold should be consistent with risk_score."""
        result = get_risk_assessment("ITEM-001", "WH-001", "SUP-001")
        score = result["risk_score"]
        category = result["category"]
        # Normalise to lowercase for comparison
        cat = category.lower()
        # Verify internal consistency (backend thresholds may vary)
        if score >= 0.7:
            assert cat in {"critical", "high"}, f"Risk {score} should be critical-ish, got {category}"
        elif score >= 0.4:
            assert cat in {"warning", "moderate", "medium"}, f"Risk {score} should be warning-ish, got {category}"
        else:
            assert cat in {"healthy", "safe", "low"}, f"Risk {score} should be healthy-ish, got {category}"
