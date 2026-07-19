import sys
import os

sys.path.insert(0, os.getcwd())
os.environ.setdefault('DATABASE_PATH', os.path.join(os.getcwd(), 'supplysense.db'))

from backend.main import app

