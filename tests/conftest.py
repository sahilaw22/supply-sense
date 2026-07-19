"""
Shared pytest fixtures for SupplySense test suite.
Sets up a fresh test environment using the real supplysense.db and FastAPI test client.
"""

import os
import sys
import pytest

# Ensure the project root is on the path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

# Point the DB at the real seeded database
DB_PATH = os.path.join(PROJECT_ROOT, "supplysense.db")


@pytest.fixture(scope="session")
def db_path():
    """Return path to the seeded SQLite database."""
    assert os.path.exists(DB_PATH), f"supplysense.db not found at {DB_PATH}. Run: python backend/data.py"
    return DB_PATH


@pytest.fixture(scope="session")
def client():
    """FastAPI TestClient for the full app."""
    from fastapi.testclient import TestClient
    from backend.main import app
    with TestClient(app) as c:
        yield c
