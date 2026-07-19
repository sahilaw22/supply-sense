"""
SupplySense mock data generator — India edition.
Creates a local, self-contained supplysense.db (SQLite) with realistic,
interconnected Indian supplier/warehouse/logistics records for the demo.
No external pip dependencies. Fixed random seed -> reproducible, judge-proof data.
"""

import random
import sqlite3
from datetime import datetime, timedelta

DB_PATH = "supplysense.db"
random.seed(42)

SUPPLIER_LOCATIONS = [
    "Mumbai, Maharashtra", "Chennai, Tamil Nadu", "Pune, Maharashtra",
    "Ahmedabad, Gujarat", "Surat, Gujarat", "Bengaluru, Karnataka",
    "Gurugram, Haryana", "Kolkata, West Bengal", "Hyderabad, Telangana",
    "Ludhiana, Punjab",
]

SUPPLIER_NAMES = [
    "Konkan Components Pvt Ltd", "Chennai Precision Parts", "Deccan Manufacturing Co",
    "Sabarmati Industrial Supply", "Tapi Component Works", "Bengaluru Circuit Systems",
    "Aravalli Freight & Fabrication", "Hooghly Manufacturing Alliance",
    "Hyderabad Precision Electronics", "Ludhiana Steel & Component Works",
]

WAREHOUSES = [
    ("Bhiwandi, Maharashtra", "Mumbai Distribution Hub"),
    ("Chennai, Tamil Nadu", "South India Fulfillment Center"),
    ("Manesar, Haryana", "North India Logistics Hub"),
    ("Kolkata, West Bengal", "East India Regional Warehouse"),
    ("Bengaluru, Karnataka", "Bengaluru Tech Corridor Depot"),
]

COMPONENTS = [
    ("Lithium-Ion Battery Pack", "Power", 84.50),
    ("Microcontroller Unit", "Electronics", 6.20),
    ("Chassis Assembly", "Structural", 142.00),
    ("Brushless DC Motor", "Mechanical", 38.75),
    ("Power Distribution Board", "Electronics", 27.10),
    ("Cooling Fan Module", "Thermal", 9.40),
    ("Wiring Harness", "Electronics", 14.60),
    ("Aluminum Enclosure", "Structural", 22.30),
    ("Touchscreen Display", "Electronics", 61.90),
    ("Pressure Sensor", "Sensors", 11.05),
    ("Hydraulic Pump", "Mechanical", 96.40),
    ("Circuit Breaker", "Electronics", 8.15),
    ("Steel Bracket Set", "Structural", 5.90),
    ("GPS Module", "Sensors", 19.75),
    ("Voltage Regulator", "Electronics", 4.35),
    ("Ball Bearing Set", "Mechanical", 7.60),
    ("Thermal Paste Kit", "Thermal", 3.20),
    ("Fiber Optic Cable Spool", "Electronics", 45.00),
    ("Rubber Gasket Set", "Structural", 2.80),
    ("Solar Charge Controller", "Power", 33.50),
]

ROUTES = [
    "JNPT-Mumbai Port Corridor", "Chennai Port Corridor", "Mundra Port Route",
    "Kolkata Port Corridor (Haldia)", "Golden Quadrilateral Highway Corridor",
    "Nhava Sheva-Colombo Transshipment Route",
]


def create_schema(cur: sqlite3.Cursor) -> None:
    cur.executescript(
        """
        DROP TABLE IF EXISTS purchase_orders;
        DROP TABLE IF EXISTS inventory_levels;
        DROP TABLE IF EXISTS components;
        DROP TABLE IF EXISTS warehouses;
        DROP TABLE IF EXISTS suppliers;

        CREATE TABLE suppliers (
            supplier_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            location TEXT NOT NULL,
            historical_fulfillment_rate REAL NOT NULL,
            delivery_performance_score REAL NOT NULL,
            lead_time_days INTEGER NOT NULL
        );

        CREATE TABLE warehouses (
            warehouse_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            location TEXT NOT NULL,
            capacity INTEGER NOT NULL,
            current_utilization REAL NOT NULL
        );

        CREATE TABLE components (
            item_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            unit_cost REAL NOT NULL
        );

        CREATE TABLE inventory_levels (
            item_id TEXT NOT NULL REFERENCES components(item_id),
            warehouse_id TEXT NOT NULL REFERENCES warehouses(warehouse_id),
            current_stock INTEGER NOT NULL,
            reorder_point INTEGER NOT NULL,
            forecasted_demand INTEGER NOT NULL,
            PRIMARY KEY (item_id, warehouse_id)
        );

        CREATE TABLE purchase_orders (
            po_id TEXT PRIMARY KEY,
            supplier_id TEXT NOT NULL REFERENCES suppliers(supplier_id),
            item_id TEXT NOT NULL REFERENCES components(item_id),
            quantity INTEGER NOT NULL,
            expected_delivery_date TEXT NOT NULL,
            status TEXT NOT NULL,
            transit_route TEXT NOT NULL
        );
        """
    )


def populate(cur: sqlite3.Cursor) -> None:
    supplier_ids = [f"SUP-{i+1:03d}" for i in range(10)]
    for sid, name, loc in zip(supplier_ids, SUPPLIER_NAMES, SUPPLIER_LOCATIONS):
        cur.execute(
            "INSERT INTO suppliers VALUES (?,?,?,?,?,?)",
            (
                sid, name, loc,
                round(random.uniform(0.78, 0.99), 2),
                round(random.uniform(3.0, 5.0), 1),
                random.randint(2, 15),  # domestic India lead times, shorter than cross-continent
            ),
        )

    warehouse_ids = [f"WH-{i+1:03d}" for i in range(5)]
    for wid, (loc, name) in zip(warehouse_ids, WAREHOUSES):
        cur.execute(
            "INSERT INTO warehouses VALUES (?,?,?,?,?)",
            (wid, name, loc, random.randint(8000, 20000), round(random.uniform(0.45, 0.92), 2)),
        )

    item_ids = [f"ITEM-{i+1:03d}" for i in range(20)]
    for iid, (name, cat, cost) in zip(item_ids, COMPONENTS):
        cur.execute("INSERT INTO components VALUES (?,?,?,?)", (iid, name, cat, cost))

    for iid in item_ids:
        stocked_in = random.sample(warehouse_ids, random.randint(2, 4))
        for wid in stocked_in:
            reorder_point = random.randint(50, 300)
            # ~30% of rows intentionally at/below reorder point so risk queries return real hits
            stock = (
                random.randint(0, reorder_point)
                if random.random() < 0.3
                else random.randint(reorder_point, reorder_point * 4)
            )
            cur.execute(
                "INSERT INTO inventory_levels VALUES (?,?,?,?,?)",
                (iid, wid, stock, reorder_point, random.randint(20, 150)),
            )

    today = datetime(2026, 7, 18)
    for i in range(14):
        cur.execute(
            "INSERT INTO purchase_orders VALUES (?,?,?,?,?,?,?)",
            (
                f"PO-{800 + i:03d}",
                random.choice(supplier_ids),
                random.choice(item_ids),
                random.randint(50, 600),
                (today + timedelta(days=random.randint(2, 30))).strftime("%Y-%m-%d"),
                random.choice(["In Transit", "Pending", "Delayed"]),
                random.choice(ROUTES),
            ),
        )

    # Scripted disruption target: Mumbai supplier -> Battery Pack -> JNPT-Mumbai Port Corridor
    # (India-relevant analog to the "Gulf Port Strike" scenario, e.g. a monsoon port shutdown)
    mumbai_supplier = supplier_ids[SUPPLIER_LOCATIONS.index("Mumbai, Maharashtra")]
    battery_item = item_ids[0]  # "Lithium-Ion Battery Pack"
    cur.execute(
        "INSERT INTO purchase_orders VALUES (?,?,?,?,?,?,?)",
        (
            "PO-889",
            mumbai_supplier,
            battery_item,
            500,
            (today + timedelta(days=6)).strftime("%Y-%m-%d"),
            "In Transit",
            "JNPT-Mumbai Port Corridor",
        ),
    )


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    create_schema(cur)
    populate(cur)
    conn.commit()
    conn.close()
    print(f"{DB_PATH} created: 10 suppliers, 5 warehouses, 20 components, 15 POs.")
    print("PO-889: 500x Lithium-Ion Battery Pack, Mumbai supplier, JNPT-Mumbai Port Corridor -> disruption target.")


if __name__ == "__main__":
    main()