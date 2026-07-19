#!/usr/bin/env python3
"""
SupplySense test runner.
Runs the full test suite and prints a human-readable summary.

Usage:
    python tests/run_tests.py
    python -m pytest tests/ -v --tb=short   (equivalent)
"""

import subprocess
import sys
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    print("=" * 60)
    print("  SupplySense — Test Suite Runner")
    print("  India supply chain risk intelligence platform")
    print("=" * 60)
    print()

    # Ensure DB is seeded
    db_path = os.path.join(PROJECT_ROOT, "supplysense.db")
    if not os.path.exists(db_path):
        print("⚠  supplysense.db not found. Seeding database first…")
        result = subprocess.run(
            [sys.executable, "backend/data.py"],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print("✗  Database seed failed:")
            print(result.stderr)
            sys.exit(1)
        print("✓  Database seeded.\n")

    # Run pytest
    args = [
        sys.executable, "-m", "pytest",
        "tests/",
        "-v",
        "--tb=short",
        "--no-header",
        "-q",
        f"--rootdir={PROJECT_ROOT}",
    ]

    result = subprocess.run(args, cwd=PROJECT_ROOT)
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
