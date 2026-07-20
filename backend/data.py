"""
SupplySense mock data generator — India edition.
Creates a local, self-contained supplysense.db (SQLite) with realistic,
interconnected Indian supplier/warehouse/logistics records for the demo.
No external pip dependencies. Fixed random seed -> reproducible, judge-proof data.
Now includes expanded retail and supply chain tables for Sales & Inventory,
Supply Chain, Performance, and Planning pages.
"""

import random
import sqlite3
from datetime import datetime, timedelta

import os
DB_PATH = os.getenv('DATABASE_PATH', "supplysense.db")
random.seed(42)

# --- Base Data Elements ---
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

# --- Retail Specific Lists ---
STORES = [
    "Reliance Retail - Mumbai", "Trent Star Bazaar - Bengaluru",
    "Tata Croma - Delhi NCR", "D-Mart - Pune", "Spencer's Retail - Kolkata",
    "Reliance Retail - Hyderabad", "D-Mart - Ahmedabad", "Tata Croma - Chennai",
]

ECOMM_CHANNELS = ["Amazon India", "Flipkart", "Blinkit", "Zepto", "Brand D2C Website", "Myntra"]

RETURN_REASONS = ["Defective Item", "Delayed Delivery", "Incorrect Item Sent", "Buyer Remorse", "Damaged in Transit"]

REFUND_STATUSES = ["Refund Issued", "Pending Inspection", "Replacement Sent", "Rejected"]

CARRIERS = ["Delhivery", "Blue Dart", "SafeExpress", "Gati KWE", "TCI Freight"]

PLANOGRAM_CATEGORIES = ["Power & EV Components", "Electronics & Microcontrollers", "Structural Assemblies", "Thermal Systems", "Sensors & Actuators"]

PLAN_STATUSES = ["Active", "Draft", "Approved", "Pending Review"]

STORE_STATUSES = ["Upcoming - Q3", "Upcoming - Q4", "Under Construction", "Permitting Stage"]


def create_schema(cur: sqlite3.Cursor) -> None:
    cur.executescript(
        """
        DROP TABLE IF EXISTS purchase_orders;
        DROP TABLE IF EXISTS inventory_levels;
        DROP TABLE IF EXISTS components;
        DROP TABLE IF EXISTS warehouses;
        DROP TABLE IF EXISTS suppliers;

        -- New Retail & Logistics Tables
        DROP TABLE IF EXISTS store_sales;
        DROP TABLE IF EXISTS ecomm_sales;
        DROP TABLE IF EXISTS ecomm_inventory;
        DROP TABLE IF EXISTS ecomm_instock;
        DROP TABLE IF EXISTS ecomm_returns;
        DROP TABLE IF EXISTS dc_metrics;
        DROP TABLE IF EXISTS order_forecast;
        DROP TABLE IF EXISTS demand_forecast;
        DROP TABLE IF EXISTS vendor_scorecard;
        DROP TABLE IF EXISTS tender_analysis;
        DROP TABLE IF EXISTS store_mumd;
        DROP TABLE IF EXISTS modular_plan;
        DROP TABLE IF EXISTS future_valid_stores;
        DROP TABLE IF EXISTS item_master;

        -- Core Tables
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

        -- New Tables Schema
        CREATE TABLE store_sales (
            store_name TEXT NOT NULL,
            item_name TEXT NOT NULL,
            date TEXT NOT NULL,
            quantity_sold INTEGER NOT NULL,
            revenue_inr REAL NOT NULL
        );

        CREATE TABLE ecomm_sales (
            channel_name TEXT NOT NULL,
            item_name TEXT NOT NULL,
            date TEXT NOT NULL,
            orders_count INTEGER NOT NULL,
            revenue_inr REAL NOT NULL
        );

        CREATE TABLE ecomm_inventory (
            facility_name TEXT NOT NULL,
            item_name TEXT NOT NULL,
            stock_on_hand INTEGER NOT NULL,
            committed_stock INTEGER NOT NULL,
            safety_stock INTEGER NOT NULL
        );

        CREATE TABLE ecomm_instock (
            item_name TEXT NOT NULL,
            date TEXT NOT NULL,
            instock_rate_pct REAL NOT NULL,
            out_of_stock_minutes INTEGER NOT NULL
        );

        CREATE TABLE ecomm_returns (
            return_id TEXT PRIMARY KEY,
            customer_name TEXT NOT NULL,
            item_name TEXT NOT NULL,
            return_reason TEXT NOT NULL,
            refund_status TEXT NOT NULL
        );

        CREATE TABLE dc_metrics (
            dc_name TEXT NOT NULL,
            date TEXT NOT NULL,
            inbound_pallets INTEGER NOT NULL,
            outbound_pallets INTEGER NOT NULL,
            processing_time_hours REAL NOT NULL,
            service_level_pct REAL NOT NULL
        );

        CREATE TABLE order_forecast (
            item_name TEXT NOT NULL,
            date TEXT NOT NULL,
            forecasted_orders INTEGER NOT NULL
        );

        CREATE TABLE demand_forecast (
            item_name TEXT NOT NULL,
            date TEXT NOT NULL,
            forecasted_demand_qty INTEGER NOT NULL
        );

        CREATE TABLE vendor_scorecard (
            supplier_name TEXT PRIMARY KEY,
            on_time_delivery_pct REAL NOT NULL,
            quality_acceptance_pct REAL NOT NULL,
            lead_time_variance_days REAL NOT NULL,
            cost_variance_pct REAL NOT NULL
        );

        CREATE TABLE tender_analysis (
            carrier_name TEXT NOT NULL,
            route_name TEXT NOT NULL,
            lane_rate_inr REAL NOT NULL,
            transit_time_days REAL NOT NULL,
            bid_status TEXT NOT NULL
        );

        CREATE TABLE store_mumd (
            store_name TEXT NOT NULL,
            item_name TEXT NOT NULL,
            original_price_inr REAL NOT NULL,
            markdown_pct REAL NOT NULL,
            promotional_units_sold INTEGER NOT NULL
        );

        CREATE TABLE modular_plan (
            category_name TEXT NOT NULL,
            planogram_id TEXT PRIMARY KEY,
            shelf_share_pct REAL NOT NULL,
            linear_feet INTEGER NOT NULL,
            status TEXT NOT NULL
        );

        CREATE TABLE future_valid_stores (
            store_code TEXT PRIMARY KEY,
            city TEXT NOT NULL,
            projected_opening_date TEXT NOT NULL,
            store_size_sqft INTEGER NOT NULL,
            status TEXT NOT NULL
        );

        CREATE TABLE item_master (
            item_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            unit_cost_inr REAL NOT NULL,
            pack_size INTEGER NOT NULL,
            dimensions TEXT NOT NULL,
            weight_kg REAL NOT NULL
        );
        """
    )


def populate(cur: sqlite3.Cursor) -> None:
    # --- 1. Core tables population ---
    supplier_ids = [f"SUP-{i+1:03d}" for i in range(10)]
    for sid, name, loc in zip(supplier_ids, SUPPLIER_NAMES, SUPPLIER_LOCATIONS):
        cur.execute(
            "INSERT INTO suppliers VALUES (?,?,?,?,?,?)",
            (
                sid, name, loc,
                round(random.uniform(0.78, 0.99), 2),
                round(random.uniform(3.0, 5.0), 1),
                random.randint(2, 15),
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

    mumbai_supplier = supplier_ids[SUPPLIER_LOCATIONS.index("Mumbai, Maharashtra")]
    battery_item = item_ids[0]
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

    # --- 2. New retail tables population ---
    # store_sales
    for store in STORES:
        for name, _, cost in COMPONENTS[:8]:
            for d in range(14):
                date_str = (today - timedelta(days=d)).strftime("%Y-%m-%d")
                qty = random.randint(5, 45)
                rev = round(qty * cost * 83.5, 2)  # Conversion rate to INR approx 83.5
                cur.execute("INSERT INTO store_sales VALUES (?,?,?,?,?)", (store, name, date_str, qty, rev))

    # ecomm_sales
    for channel in ECOMM_CHANNELS:
        for name, _, cost in COMPONENTS[:8]:
            for d in range(14):
                date_str = (today - timedelta(days=d)).strftime("%Y-%m-%d")
                qty = random.randint(15, 120)
                rev = round(qty * cost * 83.5 * 1.05, 2)  # Ecommerce slight markup
                cur.execute("INSERT INTO ecomm_sales VALUES (?,?,?,?,?)", (channel, name, date_str, qty, rev))

    # ecomm_inventory
    for wh_loc, wh_name in WAREHOUSES:
        for name, _, _ in COMPONENTS[:12]:
            soh = random.randint(100, 1500)
            committed = random.randint(20, int(soh * 0.7))
            safety = random.randint(50, 200)
            cur.execute("INSERT INTO ecomm_inventory VALUES (?,?,?,?,?)", (wh_name, name, soh, committed, safety))

    # ecomm_instock
    for name, _, _ in COMPONENTS[:12]:
        for d in range(14):
            date_str = (today - timedelta(days=d)).strftime("%Y-%m-%d")
            rate = round(random.uniform(92.4, 100.0), 2)
            oos_mins = 0 if rate == 100 else random.randint(15, 340)
            cur.execute("INSERT INTO ecomm_instock VALUES (?,?,?,?)", (name, date_str, rate, oos_mins))

    # ecomm_returns
    for i in range(25):
        cust_name = random.choice(["Amit Sharma", "Priya Patel", "Vikram Singh", "Deepa Rao", "Rahul Verma", "Sneha Gupta", "Arjun Nair", "Neha Sharma"])
        item = random.choice(COMPONENTS[:8])[0]
        reason = random.choice(RETURN_REASONS)
        status = random.choice(REFUND_STATUSES)
        cur.execute("INSERT INTO ecomm_returns VALUES (?,?,?,?,?)", (f"RET-{1000 + i}", cust_name, item, reason, status))

    # dc_metrics
    for _, wh_name in WAREHOUSES:
        for d in range(14):
            date_str = (today - timedelta(days=d)).strftime("%Y-%m-%d")
            inbound = random.randint(20, 95)
            outbound = random.randint(15, 85)
            proc_time = round(random.uniform(1.2, 4.8), 1)
            service_lvl = round(random.uniform(94.2, 99.9), 2)
            cur.execute("INSERT INTO dc_metrics VALUES (?,?,?,?,?,?)", (wh_name, date_str, inbound, outbound, proc_time, service_lvl))

    # order_forecast
    for name, _, _ in COMPONENTS[:10]:
        for w in range(6):
            date_str = (today + timedelta(weeks=w)).strftime("%Y-%m-%d")
            qty = random.randint(200, 1500)
            cur.execute("INSERT INTO order_forecast VALUES (?,?,?)", (name, date_str, qty))

    # demand_forecast
    for name, _, _ in COMPONENTS[:10]:
        for w in range(6):
            date_str = (today + timedelta(weeks=w)).strftime("%Y-%m-%d")
            qty = random.randint(250, 1800)
            cur.execute("INSERT INTO demand_forecast VALUES (?,?,?)", (name, date_str, qty))

    # vendor_scorecard
    for name in SUPPLIER_NAMES:
        otd = round(random.uniform(85.0, 99.5), 1)
        quality = round(random.uniform(96.0, 100.0), 1)
        lt_var = round(random.uniform(-1.5, 3.5), 1)
        cost_var = round(random.uniform(-2.5, 5.0), 1)
        cur.execute("INSERT INTO vendor_scorecard VALUES (?,?,?,?,?)", (name, otd, quality, lt_var, cost_var))

    # tender_analysis
    routes_list = [
        "Mumbai to Bengaluru Corridor",
        "Chennai to NCR Corridor",
        "Ahmedabad to Kolkata Corridor",
        "Pune to Chennai Corridor",
        "Ludhiana to Manesar Hub",
    ]
    for carrier in CARRIERS:
        for route in routes_list:
            rate = round(random.uniform(15000, 48000), 2)
            tt = random.randint(2, 6)
            status = random.choice(["Accepted", "Bid Under Review", "Declined", "Negotiating"])
            cur.execute("INSERT INTO tender_analysis VALUES (?,?,?,?,?)", (carrier, route, rate, tt, status))

    # store_mumd
    for store in STORES:
        for item, _, cost in COMPONENTS[:6]:
            orig = round(cost * 83.5 * 1.2, 2)
            md = random.choice([0.0, 0.05, 0.1, 0.15, 0.2])
            promo_sold = random.randint(0, 150) if md > 0 else 0
            cur.execute("INSERT INTO store_mumd VALUES (?,?,?,?,?)", (store, item, orig, md, promo_sold))

    # modular_plan
    for i, cat in enumerate(PLANOGRAM_CATEGORIES):
        pid = f"POG-{100 + i}"
        share = round(random.uniform(12.0, 32.0), 1)
        linear = random.randint(10, 40)
        status = random.choice(PLAN_STATUSES)
        cur.execute("INSERT INTO modular_plan VALUES (?,?,?,?,?)", (cat, pid, share, linear, status))

    # future_valid_stores
    for i, city in enumerate(["Pune", "Noida", "Hyderabad", "Kolkata", "Surat", "Chandigarh"]):
        scode = f"ST-{200 + i}"
        opening = (today + timedelta(days=random.randint(30, 240))).strftime("%Y-%m-%d")
        size = random.choice([8000, 12000, 15000, 20000])
        status = random.choice(STORE_STATUSES)
        cur.execute("INSERT INTO future_valid_stores VALUES (?,?,?,?,?)", (scode, city, opening, size, status))

    # item_master
    for i, (name, cat, cost) in enumerate(COMPONENTS):
        iid = f"ITEM-{i+1:03d}"
        pack = random.choice([6, 12, 24, 48])
        dims = f"{random.randint(10,40)}x{random.randint(10,40)}x{random.randint(10,30)} cm"
        weight = round(random.uniform(0.1, 8.5), 2)
        cur.execute("INSERT INTO item_master VALUES (?,?,?,?,?,?,?)", (iid, name, cat, round(cost * 83.5, 2), pack, dims, weight))


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    create_schema(cur)
    populate(cur)
    conn.commit()
    conn.close()
    print(f"{DB_PATH} successfully rebuilt with core tables & 14 retail datasets.")


if __name__ == "__main__":
    main()