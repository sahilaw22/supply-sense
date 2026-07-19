import sys, os, logging, sqlite3

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

sys.path.insert(0, os.getcwd())

_db_path = os.path.join(os.getcwd(), 'supplysense.db')
os.environ.setdefault('DATABASE_PATH', _db_path)

if not os.path.exists(_db_path):
    logger.info("Database not found — generating at %s", _db_path)
    try:
        from backend.data import create_schema, populate
        conn = sqlite3.connect(_db_path)
        cur = conn.cursor()
        create_schema(cur)
        populate(cur)
        conn.commit()
        conn.close()
        logger.info("Database generated successfully")
    except Exception as exc:
        logger.error("Database generation failed: %s", exc)

from backend.main import app
