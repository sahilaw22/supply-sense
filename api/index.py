import sys
import os

sys.path.insert(0, os.getcwd())

_project_root = os.getcwd()
os.environ.setdefault('DATABASE_PATH', os.path.join(_project_root, 'supplysense.db'))

from backend.main import app
