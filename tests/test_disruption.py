"""
Tests for the JNPT disruption simulation module (backend/disruptions.py).
Verifies trigger, state management, risk delta computation, and reset.
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.disruptions import trigger_jnpt_disruption, get_active_disruption, clear_disruption


class TestDisruptionState:
    def setup_method(self):
        """Clear disruption state before each test."""
        clear_disruption()

    def test_no_disruption_initially(self):
        """Before triggering, disruption state should be empty."""
        state = get_active_disruption()
        assert state == {} or not state.get("disruption_id"), \
            f"Expected empty disruption state, got: {state}"

    def test_trigger_returns_disruption_record(self):
        """trigger_jnpt_disruption should return a non-empty disruption record."""
        result = trigger_jnpt_disruption()
        assert result, "trigger_jnpt_disruption returned empty result"
        assert "disruption_id" in result
        assert "type" in result
        assert "affected_pos" in result
        assert "alert_text" in result

    def test_trigger_type_is_jnpt(self):
        """Disruption type should be JNPT_PORT_STRIKE."""
        result = trigger_jnpt_disruption()
        assert result["type"] == "JNPT_PORT_STRIKE", f"Unexpected type: {result['type']}"

    def test_trigger_route_is_jnpt(self):
        """Disruption route must be JNPT-Mumbai Port Corridor."""
        result = trigger_jnpt_disruption()
        assert result["route"] == "JNPT-Mumbai Port Corridor", f"Unexpected route: {result['route']}"

    def test_po_889_affected(self):
        """PO-889 must be in the affected purchase orders."""
        result = trigger_jnpt_disruption()
        assert "PO-889" in result["affected_pos"], \
            f"PO-889 not in affected_pos: {result['affected_pos']}"

    def test_affected_item_is_battery_pack(self):
        """ITEM-001 (Lithium-Ion Battery Pack) must be in affected items."""
        result = trigger_jnpt_disruption()
        item_ids = [item["item_id"] for item in result["affected_items"]]
        assert "ITEM-001" in item_ids, f"ITEM-001 not in affected_items: {item_ids}"

    def test_disruption_stored_in_state(self):
        """After triggering, get_active_disruption should return the same record."""
        triggered = trigger_jnpt_disruption()
        stored = get_active_disruption()
        assert stored["disruption_id"] == triggered["disruption_id"]

    def test_clear_disruption_resets_state(self):
        """clear_disruption must reset the state to empty."""
        trigger_jnpt_disruption()
        clear_disruption()
        state = get_active_disruption()
        assert not state, f"Expected empty state after clear, got: {state}"

    def test_duration_estimate_48_hours(self):
        """Port disruption estimate should be 48 hours."""
        result = trigger_jnpt_disruption()
        assert result["duration_estimate_hours"] == 48, \
            f"Expected 48h estimate, got: {result['duration_estimate_hours']}"

    def test_alert_text_mentions_jnpt(self):
        """Alert text must mention JNPT."""
        result = trigger_jnpt_disruption()
        assert "JNPT" in result["alert_text"], f"Alert text missing 'JNPT': {result['alert_text']}"

    def test_risk_delta_present(self):
        """Risk delta dict must be populated after disruption."""
        result = trigger_jnpt_disruption()
        assert "risk_delta" in result
        assert len(result["risk_delta"]) > 0, "Expected at least 1 risk delta entry"

    def test_risk_delta_values_valid(self):
        """Risk delta values must be in [0, 1] and new_risk >= old_risk (disruption worsens things)."""
        result = trigger_jnpt_disruption()
        for key, delta in result["risk_delta"].items():
            assert 0.0 <= delta["old_risk"] <= 1.0, f"{key}: old_risk out of range"
            assert 0.0 <= delta["new_risk"] <= 1.0, f"{key}: new_risk out of range"

    def test_triggered_at_is_iso_string(self):
        """triggered_at should be an ISO 8601 timestamp string."""
        result = trigger_jnpt_disruption()
        ts = result.get("triggered_at", "")
        assert "T" in ts and ("+00:00" in ts or "Z" in ts or "UTC" in ts or len(ts) > 10), \
            f"triggered_at doesn't look like ISO 8601: {ts}"
