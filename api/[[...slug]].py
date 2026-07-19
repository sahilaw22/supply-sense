import sys, os, json, asyncio, logging, sqlite3

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


def handler(event, context):
    path = event.get('path', '/')
    method = event.get('httpMethod', 'GET')
    headers_raw = event.get('headers', {}) or {}
    body_raw = event.get('body', '') or ''
    query_params = event.get('queryStringParameters', {}) or {}

    scope_headers = []
    for k, v in headers_raw.items():
        scope_headers.append((k.lower().encode(), str(v).encode()))

    query_parts = []
    for k, v in query_params.items():
        query_parts.append(f"{k}={v}")
    query_string = '&'.join(query_parts)

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method,
        "scheme": headers_raw.get('x-forwarded-proto', 'https'),
        "path": path,
        "raw_path": path.encode(),
        "query_string": query_string.encode(),
        "root_path": "",
        "headers": scope_headers,
        "client": ("", 0),
        "server": ("", 0),
    }

    body_bytes = body_raw.encode('utf-8') if isinstance(body_raw, str) else (body_raw or b'')

    async def asgi_handler():
        status_code = 200
        response_headers = []
        response_body = bytearray()

        async def receive():
            return {"type": "http.request", "body": body_bytes, "more_body": False}

        async def send(message):
            nonlocal status_code, response_headers, response_body
            if message["type"] == "http.response.start":
                status_code = message["status"]
                response_headers = message.get("headers", [])
            elif message["type"] == "http.response.body":
                response_body.extend(message.get("body", b""))

        try:
            await app(scope, receive, send)
        except Exception as exc:
            logger.exception("ASGI handler error")
            return {
                "statusCode": 500,
                "headers": {"Content-Type": "application/json"},
                "body": json.dumps({"error": str(exc)}),
            }

        resp_headers = {}
        for name, value in response_headers:
            resp_headers[name.decode()] = value.decode()

        return {
            "statusCode": status_code,
            "headers": resp_headers,
            "body": bytes(response_body).decode('utf-8', errors='replace'),
        }

    return asyncio.run(asgi_handler())
