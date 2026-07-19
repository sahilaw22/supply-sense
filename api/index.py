import sys
import os

_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _project_root)

os.environ.setdefault('DATABASE_PATH', os.path.join(_project_root, 'supplysense.db'))

from backend.main import app
