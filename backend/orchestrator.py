"""
SupplySense AI Orchestrator
Translates natural language → tool calls → structured JSON contract response.

Uses Google Gemini REST API (pure httpx, no SDK — compatible with Python 3.9+).
Falls back to Zyloo API (OpenAI-compatible) if Gemini fails.
Falls back to a mock response if neither API key is set (offline demo mode).

Output contract (every response):
{
    "intent": "DB_QUERY" | "DISRUPTION_MITIGATION" | "ALERT",
    "frontend_action": "RENDER_TABLE" | "SHOW_MODAL" | "UPDATE_MAP_HIGHLIGHT",
    "payload": {...},
    "summary": "Executive summary for the UI."
}
"""

import json
import logging
import os
import re
from typing import Any, Dict
import httpx
from dotenv import load_dotenv

# Load standard .env first
load_dotenv()

# Load backend/.env.local if it exists
backend_env_local = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env.local")
if os.path.exists(backend_env_local):
    load_dotenv(backend_env_local, override=True)

from backend.tools import query_database, get_alternate_suppliers, simulate_rerouting

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# LLM configuration — pure REST, no SDK required
# ---------------------------------------------------------------------------
_GEMINI_MODEL = "gemini-1.5-flash"
_GEMINI_REST_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{_GEMINI_MODEL}:generateContent"
)
_ZYLOO_URL = "https://api.zyloo.io/v1/chat/completions"
_ZYLOO_MODEL = "zyloo/gemini-3.5-flash"

# ---------------------------------------------------------------------------
# System prompt (from PRD Appendix A — India edition)
# ---------------------------------------------------------------------------
_SYSTEM_PROMPT = """
You are the core AI Orchestrator Agent for "SupplySense", an enterprise-grade AI decision-support system for supply chain risk mitigation and dynamic inventory reallocation. Your persona is a highly experienced, data-driven Logistics Director who focuses on minimizing lead times, avoiding stockouts, and proactively routing around disruptions.

You have access to the following tools:
1. query_database(sql_query: str) — read-only queries against the SQLite database. Returns rows as JSON.
2. get_alternate_suppliers(item_id: str, quantity: int) — backup vendors with lead times, delivery costs, historical fulfillment rates.
3. simulate_rerouting(po_id: str, new_supplier_id: str) — transit cost changes, delivery time deltas, SLA risk reduction.

DATABASE SCHEMA:
- suppliers(supplier_id, name, location, historical_fulfillment_rate, delivery_performance_score, lead_time_days)
  Suppliers are across Mumbai, Chennai, Pune, Ahmedabad, Surat, Bengaluru, Gurugram, Kolkata, Hyderabad, Ludhiana.
- warehouses(warehouse_id, name, location, current_utilization, capacity)
  Warehouses: Bhiwandi (Mumbai), Chennai, Manesar (Delhi NCR), Kolkata, Bengaluru.
- components(item_id, name, category, unit_cost)
  Key items: Lithium-Ion Battery Pack (ITEM-001), Microcontroller Unit, Chassis Assembly, etc.
- purchase_orders(po_id, supplier_id, item_id, quantity, expected_delivery_date, status, transit_route)
  Routes: JNPT-Mumbai Port Corridor, Chennai Port Corridor, Mundra Port Route, etc.
  PO-889: 500x Lithium-Ion Battery Pack, Mumbai supplier, JNPT-Mumbai Port Corridor — disruption target.
- inventory_levels(item_id, warehouse_id, current_stock, reorder_point, forecasted_demand)

STOCKOUT RISK: The server pre-computes P(S) scores and passes them as tool output — do not compute the formula yourself, interpret and explain the values.

CORE INSTRUCTIONS:
1. Natural language → SQL: translate operator questions into an efficient SQL SELECT query via query_database. Present results clearly.
2. Anomaly detection & rerouting: on a triggered disruption, intercept affected shipment corridors, query active POs, evaluate alternates using P(S), output an executable re-routing action.
3. ALWAYS return ONLY a single valid JSON object (no markdown fences, no extra text) matching:
{
  "intent": "DB_QUERY" | "DISRUPTION_MITIGATION" | "ALERT",
  "frontend_action": "RENDER_TABLE" | "SHOW_MODAL" | "UPDATE_MAP_HIGHLIGHT",
  "payload": { ... },
  "summary": "Executive summary sentence for the UI."
}

When returning DB query results, include the rows in payload.rows as an array of objects.
When returning alternate suppliers, include them in payload.alternates.
For disruption queries, set frontend_action to "UPDATE_MAP_HIGHLIGHT".

If you need to call a tool, return this intermediate JSON:
{
  "tool_calls": [
    { "tool": "query_database", "args": { "sql_query": "SELECT ..." } }
  ]
}
""".strip()

# ---------------------------------------------------------------------------
# Tool dispatcher
# ---------------------------------------------------------------------------
_TOOL_MAP = {
    "query_database": query_database,
    "get_alternate_suppliers": get_alternate_suppliers,
    "simulate_rerouting": simulate_rerouting,
}


def _dispatch_tool(tool_name: str, args: Dict[str, Any]) -> Any:
    fn = _TOOL_MAP.get(tool_name)
    if fn is None:
        return {"error": f"Unknown tool: {tool_name}"}
    try:
        return fn(**args)
    except Exception as exc:
        logger.exception("Tool %s raised an error", tool_name)
        return {"error": str(exc)}


# ---------------------------------------------------------------------------
# JSON extraction helper
# ---------------------------------------------------------------------------
def _extract_json(text: str) -> Dict[str, Any]:
    """Strip markdown code fences and parse the first JSON object found."""
    # Remove ```json ... ``` or ``` ... ```
    text = re.sub(r"```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = text.replace("```", "").strip()
    # Find first { ... } block
    start = text.find("{")
    end = text.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError("No JSON object found in LLM response")
    return json.loads(text[start:end])


# ---------------------------------------------------------------------------
# Fallback (offline / no API key)
# ---------------------------------------------------------------------------
def _offline_response(question: str) -> Dict[str, Any]:
    """Returns a canned mock response when no API key is configured."""
    return {
        "intent": "DB_QUERY",
        "frontend_action": "RENDER_TABLE",
        "payload": {
            "note": "Offline mode — GEMINI_API_KEY and ZYLOO_KEY not set. Using mock response.",
            "question": question,
            "rows": [],
        },
        "summary": (
            "AI orchestrator is running in offline mode. "
            "Set GEMINI_API_KEY or ZYLOO_KEY in backend/.env.local to enable live responses."
        ),
    }


# ---------------------------------------------------------------------------
# Gemini REST API call (pure httpx, no SDK, Python 3.9 compatible)
# ---------------------------------------------------------------------------
async def _call_gemini_rest(conversation_history: list, api_key: str) -> str:
    """Call Gemini via REST API — no google-generativeai SDK required."""
    # Convert history to Gemini REST format
    contents = []
    for msg in conversation_history:
        role = msg["role"]  # "user" or "model"
        text = "\n".join(msg["parts"]) if isinstance(msg["parts"], list) else str(msg["parts"])
        contents.append({"role": role, "parts": [{"text": text}]})

    payload = {
        "system_instruction": {"parts": [{"text": _SYSTEM_PROMPT}]},
        "contents": contents,
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }

    url = f"{_GEMINI_REST_URL}?key={api_key}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, json=payload)
        if response.status_code != 200:
            raise ValueError(
                f"Gemini REST API returned {response.status_code}: {response.text[:500]}"
            )
        result = response.json()
        candidates = result.get("candidates", [])
        if not candidates:
            raise ValueError("Gemini REST API: no candidates in response")
        text = candidates[0]["content"]["parts"][0]["text"]
        if not text:
            raise ValueError("Gemini REST API: empty text in response")
        return text.strip()


# ---------------------------------------------------------------------------
# Zyloo API call (OpenAI-compatible)
# ---------------------------------------------------------------------------
async def _call_zyloo(conversation_history: list, api_key: str) -> str:
    """Call Zyloo API (OpenAI-compatible endpoint)."""
    messages = [{"role": "system", "content": _SYSTEM_PROMPT}]
    for msg in conversation_history:
        role = "assistant" if msg["role"] == "model" else msg["role"]
        content = "\n".join(msg["parts"]) if isinstance(msg["parts"], list) else str(msg["parts"])
        messages.append({"role": role, "content": content})

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": _ZYLOO_MODEL,
        "messages": messages,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(_ZYLOO_URL, json=payload, headers=headers)
        if response.status_code != 200:
            raise ValueError(
                f"Zyloo API returned status {response.status_code}: {response.text[:500]}"
            )
        result_json = response.json()
        content = result_json["choices"][0]["message"]["content"]
        return content.strip()


# ---------------------------------------------------------------------------
# Unified LLM call with fallback chain
# ---------------------------------------------------------------------------
async def _call_llm(conversation_history: list) -> str:
    """
    Try Gemini REST first, then Zyloo, then raise.
    Both keys are loaded from backend/.env.local.
    """
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    zyloo_key = os.getenv("ZYLOO_KEY", "").strip()

    last_error: Exception | None = None

    # 1. Try Gemini REST API
    if gemini_key:
        try:
            logger.info("Attempting Gemini REST API call (model: %s)...", _GEMINI_MODEL)
            text = await _call_gemini_rest(conversation_history, gemini_key)
            logger.info("Gemini REST API call succeeded.")
            return text
        except Exception as exc:
            logger.warning("Gemini REST API failed: %s. Falling back to Zyloo...", exc)
            last_error = exc

    # 2. Try Zyloo
    if zyloo_key:
        try:
            logger.info("Attempting Zyloo API call...")
            text = await _call_zyloo(conversation_history, zyloo_key)
            logger.info("Zyloo API call succeeded.")
            return text
        except Exception as exc:
            logger.warning("Zyloo API failed: %s", exc)
            last_error = exc

    raise last_error or ValueError("No API keys configured (GEMINI_API_KEY or ZYLOO_KEY).")


# ---------------------------------------------------------------------------
# Main orchestration function
# ---------------------------------------------------------------------------
async def orchestrate_query(user_question: str) -> Dict[str, Any]:
    """
    Main entry point: natural language question → tool calls → JSON contract.

    Flow:
      1. Send system prompt + question to LLM.
      2. If LLM returns tool_calls, execute them sequentially.
      3. Feed tool results back to LLM for final answer.
      4. Return structured JSON contract.
    """
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    zyloo_key = os.getenv("ZYLOO_KEY", "").strip()

    if not gemini_key and not zyloo_key:
        logger.warning("Neither GEMINI_API_KEY nor ZYLOO_KEY set — returning offline mock response.")
        return _offline_response(user_question)

    conversation_history = []

    # --- Turn 1: initial question ---
    conversation_history.append({"role": "user", "parts": [user_question]})

    try:
        raw_text = await _call_llm(conversation_history)
        logger.debug("LLM Turn 1 raw: %s", raw_text[:500])
        llm_json = _extract_json(raw_text)
    except Exception as exc:
        logger.exception("LLM Turn 1 failed")
        return _error_contract(f"LLM error: {exc}")

    # --- Check for tool_calls ---
    if "tool_calls" in llm_json:
        tool_results = []
        for call in llm_json["tool_calls"]:
            tool_name = call.get("tool", "")
            args = call.get("args", {})
            logger.info("Calling tool: %s(%s)", tool_name, args)
            result = _dispatch_tool(tool_name, args)
            tool_results.append({"tool": tool_name, "args": args, "result": result})
            logger.debug("Tool result: %s", str(result)[:500])

        # --- Turn 2: feed results back ---
        tool_results_text = json.dumps(tool_results, indent=2)
        conversation_history.append({"role": "model", "parts": [raw_text]})
        conversation_history.append(
            {
                "role": "user",
                "parts": [
                    f"Tool execution results:\n{tool_results_text}\n\n"
                    "Now produce the final JSON contract response. "
                    "Include SQL result rows in payload.rows if applicable. "
                    "Include alternate suppliers in payload.alternates if applicable."
                ],
            }
        )

        try:
            raw_text2 = await _call_llm(conversation_history)
            logger.debug("LLM Turn 2 raw: %s", raw_text2[:500])
            final_json = _extract_json(raw_text2)
        except Exception as exc:
            logger.exception("LLM Turn 2 failed")
            return _error_contract(f"LLM Turn 2 error: {exc}")

        return _validate_contract(final_json)

    # --- No tool calls: direct answer ---
    return _validate_contract(llm_json)


# ---------------------------------------------------------------------------
# Contract helpers
# ---------------------------------------------------------------------------

_VALID_INTENTS = {"DB_QUERY", "DISRUPTION_MITIGATION", "ALERT"}
_VALID_ACTIONS = {"RENDER_TABLE", "SHOW_MODAL", "UPDATE_MAP_HIGHLIGHT"}


def _validate_contract(data: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure the response has all required fields; fill defaults if not."""
    return {
        "intent": data.get("intent", "DB_QUERY") if data.get("intent") in _VALID_INTENTS else "DB_QUERY",
        "frontend_action": (
            data.get("frontend_action", "RENDER_TABLE")
            if data.get("frontend_action") in _VALID_ACTIONS
            else "RENDER_TABLE"
        ),
        "payload": data.get("payload", {}),
        "summary": data.get("summary", "No summary provided."),
    }


def _error_contract(message: str) -> Dict[str, Any]:
    return {
        "intent": "ALERT",
        "frontend_action": "SHOW_MODAL",
        "payload": {"error": message},
        "summary": f"An error occurred: {message}",
    }
