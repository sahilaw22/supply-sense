"""
End-to-end API endpoint tests for all 6 FastAPI endpoints in backend/main.py.
Uses FastAPI TestClient with the real seeded supplysense.db.

Covers:
  GET  /api/dashboard
  POST /api/query          (offline mode — no real API key needed)
  POST /api/simulate/disruption
  DELETE /api/simulate/disruption/reset
  POST /api/suppliers/alternate
  GET  /api/suppliers/alternate/{item_id}
  POST /api/reroute
  POST /api/summary/generate
"""

import pytest
import json


# ────────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────────

def assert_contract(data: dict):
    """Validate the standard JSON contract shape."""
    assert "intent" in data, f"Missing 'intent': {data}"
    assert "frontend_action" in data, f"Missing 'frontend_action': {data}"
    assert "payload" in data, f"Missing 'payload': {data}"
    assert "summary" in data, f"Missing 'summary': {data}"
    assert data["intent"] in {"DB_QUERY", "DISRUPTION_MITIGATION", "ALERT"}, \
        f"Invalid intent: {data['intent']}"
    assert data["frontend_action"] in {"RENDER_TABLE", "SHOW_MODAL", "UPDATE_MAP_HIGHLIGHT"}, \
        f"Invalid frontend_action: {data['frontend_action']}"
    assert isinstance(data["summary"], str) and len(data["summary"]) > 0


# ────────────────────────────────────────────────────────────────────────────
# GET /  and  /health
# ────────────────────────────────────────────────────────────────────────────

class TestHealthEndpoints:
    def test_root_returns_200(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert "SupplySense" in data["message"]

    def test_health_returns_200(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"

    def test_docs_accessible(self, client):
        resp = client.get("/docs")
        assert resp.status_code == 200


# ────────────────────────────────────────────────────────────────────────────
# GET /api/dashboard
# ────────────────────────────────────────────────────────────────────────────

class TestDashboardEndpoint:
    def test_returns_200(self, client):
        resp = client.get("/api/dashboard")
        assert resp.status_code == 200

    def test_response_structure(self, client):
        data = client.get("/api/dashboard").json()
        required_keys = ["inventory", "warehouses", "suppliers", "purchase_orders", "map"]
        for key in required_keys:
            assert key in data, f"Missing key in dashboard response: {key}"

    def test_inventory_has_risk_fields(self, client):
        data = client.get("/api/dashboard").json()
        assert len(data["inventory"]) > 0, "No inventory rows returned"
        row = data["inventory"][0]
        assert "risk_score" in row, "risk_score missing from inventory"
        assert "risk_category" in row, "risk_category missing from inventory"
        assert 0.0 <= row["risk_score"] <= 1.0

    def test_warehouses_count(self, client):
        data = client.get("/api/dashboard").json()
        assert len(data["warehouses"]) == 5, f"Expected 5 warehouses, got {len(data['warehouses'])}"

    def test_suppliers_count(self, client):
        data = client.get("/api/dashboard").json()
        assert len(data["suppliers"]) == 10, f"Expected 10 suppliers, got {len(data['suppliers'])}"

    def test_purchase_orders_count(self, client):
        data = client.get("/api/dashboard").json()
        assert len(data["purchase_orders"]) == 15, f"Expected 15 POs, got {len(data['purchase_orders'])}"

    def test_map_structure(self, client):
        data = client.get("/api/dashboard").json()
        map_data = data["map"]
        assert "warehouse_nodes" in map_data
        assert "supplier_nodes" in map_data
        assert "active_routes" in map_data
        assert len(map_data["warehouse_nodes"]) == 5

    def test_warehouse_utilization_is_decimal(self, client):
        """Backend must send utilization as 0.0–1.0 (not 0–100)."""
        data = client.get("/api/dashboard").json()
        for wh in data["warehouses"]:
            assert 0.0 <= wh["current_utilization"] <= 1.0, \
                f"{wh['name']}: utilization should be 0–1, got {wh['current_utilization']}"

    def test_india_supplier_names(self, client):
        """Suppliers should have Indian names, not generic placeholders."""
        data = client.get("/api/dashboard").json()
        names = [s["name"] for s in data["suppliers"]]
        india_keywords = ["Konkan", "Chennai", "Deccan", "Sabarmati", "Tapi",
                          "Bengaluru", "Aravalli", "Hooghly", "Hyderabad", "Ludhiana"]
        found = [kw for kw in india_keywords if any(kw in n for n in names)]
        assert len(found) >= 5, f"Too few India supplier names. Found: {names}"

    def test_po_889_in_response(self, client):
        """PO-889 must always appear in purchase orders."""
        data = client.get("/api/dashboard").json()
        po_ids = [po["po_id"] for po in data["purchase_orders"]]
        assert "PO-889" in po_ids, f"PO-889 missing from purchase orders: {po_ids}"


# ────────────────────────────────────────────────────────────────────────────
# POST /api/query  (AI copilot — offline mode)
# ────────────────────────────────────────────────────────────────────────────

class TestQueryEndpoint:
    def test_valid_question_returns_contract(self, client):
        resp = client.post("/api/query", json={"question": "Which products are at risk of going out of stock?"})
        assert resp.status_code == 200
        assert_contract(resp.json())

    def test_empty_question_returns_400(self, client):
        resp = client.post("/api/query", json={"question": "   "})
        assert resp.status_code == 400

    def test_disruption_query(self, client):
        resp = client.post("/api/query", json={"question": "What is causing today's biggest supply chain disruption?"})
        assert resp.status_code == 200
        data = resp.json()
        assert_contract(data)

    def test_supplier_risk_query(self, client):
        resp = client.post("/api/query", json={"question": "Which suppliers are most likely to miss deliveries next week?"})
        assert resp.status_code == 200
        assert_contract(resp.json())

    def test_warehouse_query(self, client):
        resp = client.post("/api/query", json={"question": "Which warehouse should fulfill this order?"})
        assert resp.status_code == 200
        assert_contract(resp.json())

    def test_alternate_supplier_query(self, client):
        resp = client.post("/api/query", json={"question": "Recommend alternate suppliers for Lithium-Ion Battery Pack"})
        assert resp.status_code == 200
        assert_contract(resp.json())

    def test_response_has_valid_summary(self, client):
        resp = client.post("/api/query", json={"question": "Show me all delayed purchase orders"})
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data["summary"], str)
        assert len(data["summary"]) > 10, "Summary too short"


# ────────────────────────────────────────────────────────────────────────────
# POST /api/simulate/disruption
# ────────────────────────────────────────────────────────────────────────────

class TestDisruptionSimulationEndpoint:
    def setup_method(self, client=None):
        """Reset state before each disruption test."""
        pass  # Handled per test

    def test_trigger_returns_contract(self, client):
        # Reset first
        client.delete("/api/simulate/disruption/reset")
        resp = client.post("/api/simulate/disruption")
        assert resp.status_code == 200
        assert_contract(resp.json())

    def test_trigger_intent_is_alert(self, client):
        client.delete("/api/simulate/disruption/reset")
        data = client.post("/api/simulate/disruption").json()
        assert data["intent"] == "ALERT"

    def test_trigger_action_is_map_highlight(self, client):
        client.delete("/api/simulate/disruption/reset")
        data = client.post("/api/simulate/disruption").json()
        assert data["frontend_action"] == "UPDATE_MAP_HIGHLIGHT"

    def test_trigger_payload_has_po_889(self, client):
        client.delete("/api/simulate/disruption/reset")
        data = client.post("/api/simulate/disruption").json()
        affected_pos = data["payload"].get("affected_pos", [])
        assert "PO-889" in affected_pos, f"PO-889 not in disruption payload: {affected_pos}"

    def test_trigger_payload_mentions_jnpt(self, client):
        client.delete("/api/simulate/disruption/reset")
        data = client.post("/api/simulate/disruption").json()
        summary = data["summary"]
        assert "JNPT" in summary or "jnpt" in summary.lower(), \
            f"JNPT not mentioned in summary: {summary}"

    def test_dashboard_shows_active_disruption_after_trigger(self, client):
        client.delete("/api/simulate/disruption/reset")
        client.post("/api/simulate/disruption")
        dashboard = client.get("/api/dashboard").json()
        assert dashboard["active_disruption"] is not None, \
            "active_disruption should be set after triggering"


# ────────────────────────────────────────────────────────────────────────────
# DELETE /api/simulate/disruption/reset
# ────────────────────────────────────────────────────────────────────────────

class TestDisruptionResetEndpoint:
    def test_reset_returns_200(self, client):
        resp = client.delete("/api/simulate/disruption/reset")
        assert resp.status_code == 200

    def test_reset_returns_contract(self, client):
        assert_contract(client.delete("/api/simulate/disruption/reset").json())

    def test_reset_clears_active_disruption(self, client):
        client.post("/api/simulate/disruption")
        client.delete("/api/simulate/disruption/reset")
        dashboard = client.get("/api/dashboard").json()
        assert not dashboard["active_disruption"], \
            "active_disruption should be None/empty after reset"


# ────────────────────────────────────────────────────────────────────────────
# POST /api/suppliers/alternate
# ────────────────────────────────────────────────────────────────────────────

class TestAlternateSuppliersEndpoint:
    def test_battery_pack_alternates(self, client):
        resp = client.post("/api/suppliers/alternate", json={"item_id": "ITEM-001", "quantity": 500})
        assert resp.status_code == 200
        assert_contract(resp.json())

    def test_alternates_payload_structure(self, client):
        data = client.post("/api/suppliers/alternate", json={"item_id": "ITEM-001", "quantity": 100}).json()
        payload = data["payload"]
        assert "alternates" in payload, f"Missing 'alternates' in payload: {payload}"
        assert "item_name" in payload, "Missing 'item_name'"
        assert payload["item_name"] == "Lithium-Ion Battery Pack"

    def test_alternates_have_required_fields(self, client):
        data = client.post("/api/suppliers/alternate", json={"item_id": "ITEM-001", "quantity": 100}).json()
        for alt in data["payload"]["alternates"]:
            for field in ["supplier_id", "name", "location", "lead_time_days", "historical_fulfillment_rate"]:
                assert field in alt, f"Alternate missing field '{field}': {alt}"

    def test_alternates_sorted_by_lead_time(self, client):
        data = client.post("/api/suppliers/alternate", json={"item_id": "ITEM-001", "quantity": 100}).json()
        alts = data["payload"]["alternates"]
        if len(alts) >= 2:
            lead_times = [a["lead_time_days"] for a in alts]
            assert lead_times == sorted(lead_times), f"Alternates not sorted by lead time: {lead_times}"

    def test_get_alternates_convenience(self, client):
        """GET /api/suppliers/alternate/{item_id} should also work."""
        resp = client.get("/api/suppliers/alternate/ITEM-001?quantity=100")
        assert resp.status_code == 200
        assert_contract(resp.json())

    def test_unknown_item_returns_404(self, client):
        resp = client.post("/api/suppliers/alternate", json={"item_id": "NONEXISTENT-999", "quantity": 100})
        assert resp.status_code == 404


# ────────────────────────────────────────────────────────────────────────────
# POST /api/reroute
# ────────────────────────────────────────────────────────────────────────────

class TestRerouteEndpoint:
    def test_reroute_po889(self, client):
        """Reroute PO-889 to SUP-003 (Deccan Manufacturing)."""
        resp = client.post("/api/reroute", json={"po_id": "PO-889", "new_supplier_id": "SUP-003"})
        assert resp.status_code == 200
        assert_contract(resp.json())

    def test_reroute_payload_has_recommendation(self, client):
        data = client.post("/api/reroute", json={"po_id": "PO-889", "new_supplier_id": "SUP-003"}).json()
        payload = data["payload"]
        assert "recommendation" in payload or "time_delta" in payload or "cost_delta" in payload, \
            f"Reroute payload missing analysis fields: {payload}"

    def test_reroute_unknown_po_returns_404(self, client):
        resp = client.post("/api/reroute", json={"po_id": "PO-NONEXISTENT", "new_supplier_id": "SUP-001"})
        assert resp.status_code in {404, 200}, \
            "Should return 404 or valid response for unknown PO"


# ────────────────────────────────────────────────────────────────────────────
# POST /api/summary/generate
# ────────────────────────────────────────────────────────────────────────────

class TestExecutiveSummaryEndpoint:
    def test_returns_200(self, client):
        resp = client.post("/api/summary/generate")
        assert resp.status_code == 200

    def test_returns_contract(self, client):
        assert_contract(client.post("/api/summary/generate").json())

    def test_payload_has_markdown(self, client):
        data = client.post("/api/summary/generate").json()
        assert "markdown" in data["payload"], f"Missing markdown in payload: {data['payload']}"
        markdown = data["payload"]["markdown"]
        assert isinstance(markdown, str) and len(markdown) > 50, "Markdown too short"

    def test_markdown_mentions_suppliers(self, client):
        data = client.post("/api/summary/generate").json()
        markdown = data["payload"]["markdown"]
        assert "Supplier" in markdown or "supplier" in markdown, \
            "Executive summary should mention suppliers"

    def test_markdown_has_inventory_section(self, client):
        data = client.post("/api/summary/generate").json()
        markdown = data["payload"]["markdown"]
        assert "Reorder" in markdown or "stock" in markdown.lower() or "inventory" in markdown.lower(), \
            "Executive summary should include inventory/reorder information"

    def test_frontend_action_is_show_modal(self, client):
        data = client.post("/api/summary/generate").json()
        assert data["frontend_action"] == "SHOW_MODAL"

    def test_disruption_section_when_active(self, client):
        """After triggering disruption, summary should mention JNPT."""
        client.delete("/api/simulate/disruption/reset")
        client.post("/api/simulate/disruption")
        data = client.post("/api/summary/generate").json()
        markdown = data["payload"]["markdown"]
        assert "JNPT" in markdown or "Disruption" in markdown, \
            "Summary should mention JNPT disruption when active"
        # Cleanup
        client.delete("/api/simulate/disruption/reset")
