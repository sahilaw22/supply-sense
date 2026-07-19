"""
SupplySense Database Layer
Provides SQLite connection management and query helpers for all supply chain data operations.
"""

import sqlite3
import os
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

DATABASE_PATH = os.getenv('DATABASE_PATH', 'supplysense.db')


@contextmanager
def get_connection():
    """
    Context manager for SQLite database connections.
    Ensures proper connection cleanup and error handling.
    """
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row  # Return rows as dictionaries
    try:
        yield conn
    finally:
        conn.close()


def execute_query(sql_query: str, params: tuple = None) -> List[Dict[str, Any]]:
    """
    Execute a SELECT query and return results as list of dictionaries.
    
    Args:
        sql_query: SQL SELECT query string
        params: Tuple of parameters for parameterized queries (optional)
        
    Returns:
        List of dictionaries containing query results
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        if params:
            cursor.execute(sql_query, params)
        else:
            cursor.execute(sql_query)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


def get_supplier_by_id(supplier_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve a single supplier by ID.
    
    Args:
        supplier_id: Unique supplier identifier
        
    Returns:
        Dictionary containing supplier data or None if not found
    """
    results = execute_query(
        'SELECT * FROM suppliers WHERE supplier_id = ?',
        (supplier_id,)
    )
    return results[0] if results else None


def get_component_by_id(component_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve a single component by ID.
    
    Args:
        component_id: Unique component identifier
        
    Returns:
        Dictionary containing component data or None if not found
    """
    results = execute_query(
        'SELECT * FROM components WHERE item_id = ?',
        (component_id,)
    )
    return results[0] if results else None


def get_inventory_level(component_id: str, warehouse_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve inventory level for a specific component at a specific warehouse.
    
    Args:
        component_id: Unique component identifier
        warehouse_id: Unique warehouse identifier
        
    Returns:
        Dictionary containing inventory data or None if not found
    """
    results = execute_query(
        'SELECT * FROM inventory_levels WHERE item_id = ? AND warehouse_id = ?',
        (component_id, warehouse_id)
    )
    return results[0] if results else None


def get_all_purchase_orders(status: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Retrieve all purchase orders, optionally filtered by status.
    
    Args:
        status: Optional status filter ('In Transit', 'Delivered', 'Pending', etc.)
        
    Returns:
        List of dictionaries containing purchase order data
    """
    if status:
        return execute_query(
            'SELECT * FROM purchase_orders WHERE status = ? ORDER BY order_date DESC',
            (status,)
        )
    else:
        return execute_query(
            'SELECT * FROM purchase_orders ORDER BY order_date DESC'
        )


def get_po_by_id(po_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve a single purchase order by ID.
    
    Args:
        po_id: Unique purchase order identifier
        
    Returns:
        Dictionary containing purchase order data or None if not found
    """
    results = execute_query(
        'SELECT * FROM purchase_orders WHERE po_id = ?',
        (po_id,)
    )
    return results[0] if results else None
