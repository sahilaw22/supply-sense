"""
Tests for data integrity — verifies the seeded supplysense.db
contains all expected India-specific mock data from backend/data.py.
"""

import sqlite3
import pytest


def get_conn(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


class TestSuppliersTable:
    def test_supplier_count(self, db_path):
        """Should have exactly 10 suppliers."""
        conn = get_conn(db_path)
        count = conn.execute("SELECT COUNT(*) FROM suppliers").fetchone()[0]
        conn.close()
        assert count == 10, f"Expected 10 suppliers, got {count}"

    def test_supplier_india_locations(self, db_path):
        """All suppliers should be in Indian cities."""
        india_cities = {"Mumbai", "Chennai", "Pune", "Ahmedabad", "Surat",
                        "Bengaluru", "Gurugram", "Kolkata", "Hyderabad", "Ludhiana"}
        conn = get_conn(db_path)
        rows = conn.execute("SELECT location FROM suppliers").fetchall()
        conn.close()
        for row in rows:
            city = row["location"].split(",")[0].strip()
            assert city in india_cities, f"Non-India city found: {row['location']}"

    def test_supplier_scores_valid(self, db_path):
        """Delivery performance scores should be 0–5, fulfillment rates 0–1."""
        conn = get_conn(db_path)
        rows = conn.execute(
            "SELECT name, delivery_performance_score, historical_fulfillment_rate FROM suppliers"
        ).fetchall()
        conn.close()
        for row in rows:
            assert 0 <= row["delivery_performance_score"] <= 5, \
                f"Invalid delivery score for {row['name']}: {row['delivery_performance_score']}"
            assert 0 <= row["historical_fulfillment_rate"] <= 1, \
                f"Invalid fulfillment rate for {row['name']}: {row['historical_fulfillment_rate']}"

    def test_supplier_konkan_exists(self, db_path):
        """Konkan Components Pvt Ltd (Mumbai) must exist."""
        conn = get_conn(db_path)
        row = conn.execute(
            "SELECT * FROM suppliers WHERE name = 'Konkan Components Pvt Ltd'"
        ).fetchone()
        conn.close()
        assert row is not None, "Konkan Components Pvt Ltd not found"
        assert "Mumbai" in row["location"]


class TestWarehousesTable:
    def test_warehouse_count(self, db_path):
        """Should have exactly 5 warehouses."""
        conn = get_conn(db_path)
        count = conn.execute("SELECT COUNT(*) FROM warehouses").fetchone()[0]
        conn.close()
        assert count == 5, f"Expected 5 warehouses, got {count}"

    def test_warehouse_utilization_range(self, db_path):
        """Utilization must be between 0.0 and 1.0."""
        conn = get_conn(db_path)
        rows = conn.execute("SELECT name, current_utilization FROM warehouses").fetchall()
        conn.close()
        for row in rows:
            assert 0.0 <= row["current_utilization"] <= 1.0, \
                f"{row['name']}: utilization out of range: {row['current_utilization']}"

    def test_bhiwandi_warehouse_exists(self, db_path):
        """Mumbai Distribution Hub (Bhiwandi) must exist."""
        conn = get_conn(db_path)
        row = conn.execute(
            "SELECT * FROM warehouses WHERE name = 'Mumbai Distribution Hub'"
        ).fetchone()
        conn.close()
        assert row is not None, "Mumbai Distribution Hub not found"


class TestComponentsTable:
    def test_component_count(self, db_path):
        """Should have exactly 20 components."""
        conn = get_conn(db_path)
        count = conn.execute("SELECT COUNT(*) FROM components").fetchone()[0]
        conn.close()
        assert count == 20, f"Expected 20 components, got {count}"

    def test_battery_pack_exists(self, db_path):
        """Lithium-Ion Battery Pack (ITEM-001) must be the first component."""
        conn = get_conn(db_path)
        row = conn.execute(
            "SELECT * FROM components WHERE item_id = 'ITEM-001'"
        ).fetchone()
        conn.close()
        assert row is not None, "ITEM-001 not found"
        assert row["name"] == "Lithium-Ion Battery Pack"
        assert row["category"] == "Power"

    def test_component_costs_positive(self, db_path):
        """All component unit costs should be > 0."""
        conn = get_conn(db_path)
        rows = conn.execute("SELECT name, unit_cost FROM components WHERE unit_cost <= 0").fetchall()
        conn.close()
        assert len(rows) == 0, f"Components with invalid cost: {[r['name'] for r in rows]}"


class TestPurchaseOrdersTable:
    def test_po_count(self, db_path):
        """Should have exactly 15 purchase orders (14 random + PO-889)."""
        conn = get_conn(db_path)
        count = conn.execute("SELECT COUNT(*) FROM purchase_orders").fetchone()[0]
        conn.close()
        assert count == 15, f"Expected 15 POs, got {count}"

    def test_po_889_exists(self, db_path):
        """PO-889 — the scripted disruption target — must exist with correct data."""
        conn = get_conn(db_path)
        row = conn.execute("SELECT * FROM purchase_orders WHERE po_id = 'PO-889'").fetchone()
        conn.close()
        assert row is not None, "PO-889 not found"
        assert row["item_id"] == "ITEM-001", f"PO-889 item_id: expected ITEM-001, got {row['item_id']}"
        assert row["quantity"] == 500, f"PO-889 quantity: expected 500, got {row['quantity']}"
        assert row["transit_route"] == "JNPT-Mumbai Port Corridor", f"PO-889 route: {row['transit_route']}"
        assert row["status"] == "In Transit", f"PO-889 status: expected 'In Transit', got {row['status']}"

    def test_po_statuses_valid(self, db_path):
        """All PO statuses must be In Transit, Pending, or Delayed."""
        valid = {"In Transit", "Pending", "Delayed"}
        conn = get_conn(db_path)
        rows = conn.execute("SELECT po_id, status FROM purchase_orders").fetchall()
        conn.close()
        for row in rows:
            assert row["status"] in valid, f"PO {row['po_id']} has invalid status: {row['status']}"

    def test_po_foreign_keys_valid(self, db_path):
        """All POs must reference valid supplier_id and item_id."""
        conn = get_conn(db_path)
        invalid = conn.execute("""
            SELECT po_id FROM purchase_orders po
            WHERE po.supplier_id NOT IN (SELECT supplier_id FROM suppliers)
               OR po.item_id NOT IN (SELECT item_id FROM components)
        """).fetchall()
        conn.close()
        assert len(invalid) == 0, f"POs with invalid FK: {[r['po_id'] for r in invalid]}"


class TestInventoryTable:
    def test_inventory_rows_exist(self, db_path):
        """Should have at least 30 inventory rows (2–4 warehouses per component)."""
        conn = get_conn(db_path)
        count = conn.execute("SELECT COUNT(*) FROM inventory_levels").fetchone()[0]
        conn.close()
        assert count >= 30, f"Too few inventory rows: {count}"

    def test_some_items_at_risk(self, db_path):
        """At least 30% of rows should be at or below reorder point."""
        conn = get_conn(db_path)
        total = conn.execute("SELECT COUNT(*) FROM inventory_levels").fetchone()[0]
        at_risk = conn.execute(
            "SELECT COUNT(*) FROM inventory_levels WHERE current_stock <= reorder_point"
        ).fetchone()[0]
        conn.close()
        ratio = at_risk / total if total > 0 else 0
        assert ratio >= 0.20, f"Expected >= 20% at-risk rows, got {ratio:.0%} ({at_risk}/{total})"

    def test_inventory_foreign_keys(self, db_path):
        """All inventory rows must reference valid item_id and warehouse_id."""
        conn = get_conn(db_path)
        invalid = conn.execute("""
            SELECT COUNT(*) FROM inventory_levels il
            WHERE il.item_id NOT IN (SELECT item_id FROM components)
               OR il.warehouse_id NOT IN (SELECT warehouse_id FROM warehouses)
        """).fetchone()[0]
        conn.close()
        assert invalid == 0, f"{invalid} inventory rows with invalid foreign keys"
