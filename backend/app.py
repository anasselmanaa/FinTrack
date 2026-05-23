from flask import Flask, request, jsonify, send_from_directory, Response, stream_with_context, send_file
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, current_user, login_required, login_user, logout_user
import csv
import zipfile
from database import get_connection, init_db
from email_service import (
    BUGS_EMAIL,
    EmailNotConfigured,
    EmailDeliveryError,
    IDEAS_EMAIL,
    SUPPORT_EMAIL,
    email_verification_email,
    email_configured,
    password_reset_email,
    payment_failed_email,
    payment_receipt_email,
    send_email,
    subscription_active_email,
    subscription_canceled_email,
    trial_decision_email,
    trial_ended_email,
    welcome_trial_email,
)
from psycopg2.extras import Json, RealDictCursor
from pathlib import Path
from dotenv import load_dotenv
import anthropic
try:
    import stripe
except ImportError:
    stripe = None
from werkzeug.utils import secure_filename
from functools import wraps
from decimal import Decimal, InvalidOperation
from difflib import SequenceMatcher
from datetime import date, datetime, timedelta
import base64
import bcrypt
import hashlib
import pandas as pd
import io
import json
import os
import re
import secrets
import time
import uuid

load_dotenv(Path(__file__).with_name(".env"))

APP_ENV = os.getenv("APP_ENV", "development").lower()
IS_PRODUCTION = APP_ENV == "production"


def env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default

    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_int(name, default):
    value = os.getenv(name)
    if value is None:
        return default

    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def request_bool(value, default=False):
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}

    return bool(value)


def env_list(*names, default=None):
    for name in names:
        value = os.getenv(name)
        if value:
            return [item.strip().rstrip("/") for item in value.split(",") if item.strip()]

    return default or []


ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ANTHROPIC_BASE_URL = os.getenv("ANTHROPIC_BASE_URL", "https://api.anthropic.com")
anthropic_client = (
    anthropic.Anthropic(
        api_key=ANTHROPIC_API_KEY,
        base_url=ANTHROPIC_BASE_URL,
    )
    if ANTHROPIC_API_KEY
    else None
)
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")
CLAUDE_EFFORT = os.getenv("CLAUDE_EFFORT", "high")
CLAUDE_THINKING = os.getenv("CLAUDE_THINKING", "adaptive").lower()
CLAUDE_INPUT_COST_PER_MTOK = float(os.getenv("CLAUDE_INPUT_COST_PER_MTOK", "3"))
CLAUDE_OUTPUT_COST_PER_MTOK = float(os.getenv("CLAUDE_OUTPUT_COST_PER_MTOK", "15"))
CLAUDE_CACHE_WRITE_COST_PER_MTOK = float(os.getenv("CLAUDE_CACHE_WRITE_COST_PER_MTOK", "3.75"))
CLAUDE_CACHE_READ_COST_PER_MTOK = float(os.getenv("CLAUDE_CACHE_READ_COST_PER_MTOK", "0.30"))
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRICE_USD_ID = os.getenv("STRIPE_PRICE_USD_ID", "")
STRIPE_PRICE_CAD_ID = os.getenv("STRIPE_PRICE_CAD_ID", "")
STRIPE_PRODUCT_NAME = os.getenv("STRIPE_PRODUCT_NAME", "FinTrack Pro")
STRIPE_TRIAL_DAYS = env_int("STRIPE_TRIAL_DAYS", 14)
PASSWORD_RESET_TOKEN_MINUTES = env_int("PASSWORD_RESET_TOKEN_MINUTES", 60)
EMAIL_VERIFICATION_TOKEN_MINUTES = env_int("EMAIL_VERIFICATION_TOKEN_MINUTES", 60 * 24)
EMAIL_VERIFICATION_REQUIRED = env_bool("EMAIL_VERIFICATION_REQUIRED", True)
FRONTEND_APP_URL = os.getenv("FRONTEND_APP_URL", "").rstrip("/")
FRONTEND_BILLING_SUCCESS_URL = os.getenv("FRONTEND_BILLING_SUCCESS_URL", "")
FRONTEND_BILLING_CANCEL_URL = os.getenv("FRONTEND_BILLING_CANCEL_URL", "")

if stripe is not None and STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


def _usage_value(usage, name):
    if usage is None:
        return 0
    if isinstance(usage, dict):
        return int(usage.get(name) or 0)
    return int(getattr(usage, name, 0) or 0)


def _claude_usage_numbers(usage):
    return {
        "input_tokens": _usage_value(usage, "input_tokens"),
        "output_tokens": _usage_value(usage, "output_tokens"),
        "cache_creation_input_tokens": _usage_value(usage, "cache_creation_input_tokens"),
        "cache_read_input_tokens": _usage_value(usage, "cache_read_input_tokens"),
    }


def estimate_claude_cost_usd(usage):
    usage = _claude_usage_numbers(usage)
    billable_input = max(usage["input_tokens"] - usage["cache_creation_input_tokens"] - usage["cache_read_input_tokens"], 0)
    return round((
        billable_input * CLAUDE_INPUT_COST_PER_MTOK +
        usage["output_tokens"] * CLAUDE_OUTPUT_COST_PER_MTOK +
        usage["cache_creation_input_tokens"] * CLAUDE_CACHE_WRITE_COST_PER_MTOK +
        usage["cache_read_input_tokens"] * CLAUDE_CACHE_READ_COST_PER_MTOK
    ) / 1_000_000, 8)


def log_claude_call(user_id, model, usage):
    if not user_id or usage is None:
        return

    usage_numbers = _claude_usage_numbers(usage)
    cost_usd = estimate_claude_cost_usd(usage)
    conn = None
    cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO claude_calls_log
                (user_id, model, input_tokens, output_tokens, cost_usd)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            user_id,
            model,
            usage_numbers["input_tokens"],
            usage_numbers["output_tokens"],
            cost_usd,
        ))
        conn.commit()
    except Exception as exc:
        print("Claude call logging error:", exc)
        if conn:
            conn.rollback()
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def extract_claude_text(response):
    return "".join(
        block.text
        for block in getattr(response, "content", []) or []
        if getattr(block, "type", None) == "text" and getattr(block, "text", None)
    ).strip()


def parse_claude_json_text(text):
    text = (text or "").strip()
    if not text:
        return {}

    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        if start != -1:
            depth = 0
            in_string = False
            escape = False
            for idx in range(start, len(text)):
                char = text[idx]
                if in_string:
                    if escape:
                        escape = False
                    elif char == "\\":
                        escape = True
                    elif char == '"':
                        in_string = False
                    continue

                if char == '"':
                    in_string = True
                elif char == "{":
                    depth += 1
                elif char == "}":
                    depth -= 1
                    if depth == 0:
                        return json.loads(text[start:idx + 1])
        raise


def claude_output_config(json_schema=None):
    output_config = {"effort": CLAUDE_EFFORT}
    if json_schema is not None:
        output_config["format"] = {"type": "json_schema", "schema": json_schema}
    return output_config


def claude_thinking_config():
    return {"type": "adaptive"} if CLAUDE_THINKING == "adaptive" else None


def build_transaction_history_cache_text(user_id):
    if not user_id:
        return "User transaction history:\n[]"

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT name, amount, category, account, date, source
        FROM transactions
        WHERE user_id = %s
        ORDER BY date DESC, id DESC
        LIMIT 250
    """, (user_id,))
    rows = rows_for_prompt(cur.fetchall())
    cur.close()
    conn.close()

    return (
        "User transaction history (cached; most recent first):\n"
        f"{json.dumps(rows, default=str, ensure_ascii=False)}"
    )


def build_claude_cached_messages(user_id, prompt_text, extra_content=None, cache_text=None):
    content = [
        {
            "type": "text",
            "text": cache_text or build_transaction_history_cache_text(user_id),
            "cache_control": {"type": "ephemeral"},
        }
    ]

    if extra_content:
        content.extend(extra_content)

    content.append({"type": "text", "text": prompt_text})
    return [{"role": "user", "content": content}]


def create_claude_message(user_id, system_text, prompt_text, max_tokens=2048, json_schema=None, extra_content=None, model=None, cache_text=None):
    if anthropic_client is None:
        raise RuntimeError("Claude is not configured (set ANTHROPIC_API_KEY)")

    model = model or CLAUDE_MODEL
    kwargs = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system_text,
        "messages": build_claude_cached_messages(user_id, prompt_text, extra_content=extra_content, cache_text=cache_text),
        "output_config": claude_output_config(json_schema),
    }
    thinking = claude_thinking_config()
    if thinking:
        kwargs["thinking"] = thinking

    response = anthropic_client.messages.create(**kwargs)
    log_claude_call(user_id, model, getattr(response, "usage", None))
    return response


def call_money_coach_ai(system_text, user_text, max_tokens=2048, json_schema=None, user_id=None):
    """
    Claude-only LLM helper. The user's transaction history is always the first
    user content block and is marked with Anthropic ephemeral prompt caching.
    """
    response = create_claude_message(
        user_id=user_id,
        system_text=system_text,
        prompt_text=user_text,
        max_tokens=max_tokens,
        json_schema=json_schema,
    )
    text = extract_claude_text(response)

    if json_schema is not None:
        return parse_claude_json_text(text)
    return text

app = Flask(__name__)

FLASK_SECRET_KEY = os.getenv("FLASK_SECRET_KEY")
if IS_PRODUCTION and not FLASK_SECRET_KEY:
    raise RuntimeError("Missing FLASK_SECRET_KEY")

app.secret_key = FLASK_SECRET_KEY or "dev-secret-change-me"
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=env_bool("SESSION_COOKIE_SECURE", IS_PRODUCTION),
    SESSION_COOKIE_SAMESITE=os.getenv("SESSION_COOKIE_SAMESITE", "None" if IS_PRODUCTION else "Lax"),
)

FRONTEND_ORIGINS = env_list(
    "FRONTEND_ORIGINS",
    "FRONTEND_ORIGIN",
    default=["http://127.0.0.1:5500", "http://localhost:5500"]
)
if not FRONTEND_APP_URL:
    FRONTEND_APP_URL = (FRONTEND_ORIGINS[0] if FRONTEND_ORIGINS else "http://127.0.0.1:5500").rstrip("/")
CORS(
    app,
    resources={
        r"/api/*": {"origins": FRONTEND_ORIGINS},
        r"/auth/*": {"origins": FRONTEND_ORIGINS}
    },
    supports_credentials=True
)

DEV_AUTO_LOGIN = env_bool("FINTRACK_DEV_AUTO_LOGIN", False)
LOCAL_DEV_AUTO_LOGIN = env_bool("FINTRACK_LOCAL_AUTO_LOGIN", True)
DEV_USER_EMAIL = os.getenv("FINTRACK_DEV_USER_EMAIL", "dev@fintrack.local")
SHOW_DEMO_DATA = env_bool("FINTRACK_SHOW_DEMO_DATA", False)
DEFAULT_CURRENCY = os.getenv("FINTRACK_DEFAULT_CURRENCY", "USD")
MONEY_COACH_RATE_LIMIT_COUNT = env_int("MONEY_COACH_RATE_LIMIT_COUNT", 30)
MONEY_COACH_RATE_LIMIT_WINDOW = env_int("MONEY_COACH_RATE_LIMIT_WINDOW", 60 * 60)
MONEY_COACH_DAILY_SCAN_COOLDOWN_HOURS = env_int("MONEY_COACH_DAILY_SCAN_COOLDOWN_HOURS", 20)
money_coach_rate_bucket = {}
PROFILE_UPLOAD_DIR = Path(__file__).resolve().parent / "uploads" / "profile-pictures"
PROFILE_IMAGE_MAX_BYTES = env_int("PROFILE_IMAGE_MAX_BYTES", 2 * 1024 * 1024)
PROFILE_IMAGE_ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
PROJECT_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_FRONTEND_PAGES = {
    "index.html",
    "landing.html",
    "features.html",
    "different.html",
    "trial.html",
    "guide.html",
    "help.html",
    "about.html",
    "accessibility.html",
    "login.html",
    "forgot-password.html",
    "reset-password.html",
    "verify-email.html",
    "terms.html",
    "privacy.html",
    "refund.html",
}

login_manager = LoginManager()
login_manager.init_app(app)


@app.before_request
def force_https_in_production():
    if not IS_PRODUCTION:
        return
    forwarded_proto = request.headers.get("X-Forwarded-Proto", "")
    if forwarded_proto == "http":
        return Response(status=301, headers={"Location": request.url.replace("http://", "https://", 1)})


@app.after_request
def add_security_headers(response):
    if IS_PRODUCTION:
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    return response


@app.route('/')
def serve_landing_page():
    return send_from_directory(FRONTEND_DIR, "landing.html")


@app.route('/frontend/<path:filename>')
def serve_frontend_asset(filename):
    return send_from_directory(FRONTEND_DIR, filename)


@app.route('/assets/<path:filename>')
def serve_marketing_asset(filename):
    return send_from_directory(ASSETS_DIR, filename)


@app.route('/robots.txt')
def serve_robots_txt():
    return send_from_directory(PROJECT_ROOT, "robots.txt", mimetype="text/plain")


@app.route('/sitemap.xml')
def serve_sitemap_xml():
    return send_from_directory(PROJECT_ROOT, "sitemap.xml", mimetype="application/xml")


@app.route('/<path:filename>')
def serve_public_frontend_page(filename):
    if filename in PUBLIC_FRONTEND_PAGES or filename.endswith((".css", ".js")):
        return send_from_directory(FRONTEND_DIR, filename)
    return jsonify({"error": "Not found"}), 404


@app.route('/api/support/mailboxes', methods=['GET'])
def support_mailboxes():
    return jsonify({
        "help": SUPPORT_EMAIL,
        "bugs": BUGS_EMAIL,
        "ideas": IDEAS_EMAIL,
        "reply_to": os.getenv("EMAIL_REPLY_TO", SUPPORT_EMAIL).strip(),
    }), 200


class User(UserMixin):
    def __init__(self, row):
        self.id = str(row["id"])
        self.email = row["email"]
        self.name = row["name"]
        self.subscription_status = row.get("subscription_status", "trial")
        self.trial_started_at = row.get("trial_started_at")
        self.trial_ends_at = row.get("trial_ends_at")
        self.stripe_customer_id = row.get("stripe_customer_id")
        self.stripe_subscription_id = row.get("stripe_subscription_id")
        self.subscription_cancel_at_period_end = row.get("subscription_cancel_at_period_end")
        self.subscription_current_period_end = row.get("subscription_current_period_end")
        self.subscription_canceled_at = row.get("subscription_canceled_at")
        self.created_at = row.get("created_at")
        self.email_verified_at = row.get("email_verified_at")
        self.profile_image_url = row.get("profile_image_url")
        self.preferred_currency = row.get("preferred_currency")
        self.preferred_language = row.get("preferred_language")


@login_manager.user_loader
def load_user(user_id):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, email, name, subscription_status, trial_started_at, trial_ends_at,
               stripe_customer_id, stripe_subscription_id, subscription_cancel_at_period_end,
               subscription_current_period_end, subscription_canceled_at, created_at, email_verified_at,
               profile_image_url, preferred_currency, preferred_language
        FROM users
        WHERE id = %s
    """, (user_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return User(row) if row else None


@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({"error": "Please log in"}), 401


def current_user_id():
    return int(current_user.id)


def serialize_for_prompt(value):
    if isinstance(value, Decimal):
        return float(value)

    if hasattr(value, "isoformat"):
        return value.isoformat()

    if isinstance(value, list):
        return [serialize_for_prompt(item) for item in value]

    if isinstance(value, tuple):
        return [serialize_for_prompt(item) for item in value]

    if isinstance(value, dict):
        return {key: serialize_for_prompt(item) for key, item in value.items()}

    return value


def rows_for_prompt(rows):
    return [serialize_for_prompt(dict(row)) for row in rows]


def check_money_coach_rate_limit(user_id):
    if MONEY_COACH_RATE_LIMIT_COUNT <= 0 or MONEY_COACH_RATE_LIMIT_WINDOW <= 0:
        return None

    now = time.time()
    window_start = now - MONEY_COACH_RATE_LIMIT_WINDOW
    user_key = str(user_id)
    recent_requests = [
        timestamp
        for timestamp in money_coach_rate_bucket.get(user_key, [])
        if timestamp >= window_start
    ]

    if len(recent_requests) >= MONEY_COACH_RATE_LIMIT_COUNT:
        retry_after = max(1, int(MONEY_COACH_RATE_LIMIT_WINDOW - (now - recent_requests[0])))
        money_coach_rate_bucket[user_key] = recent_requests
        return retry_after

    recent_requests.append(now)
    money_coach_rate_bucket[user_key] = recent_requests
    return None


def public_user_payload(row):
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "first_name": row.get("first_name"),
        "last_name": row.get("last_name"),
        "phone": row.get("phone"),
        "preferred_currency": row.get("preferred_currency"),
        "preferred_language": row.get("preferred_language"),
        "subscription_status": row.get("subscription_status", "trial"),
        "trial_started_at": row.get("trial_started_at"),
        "trial_ends_at": row.get("trial_ends_at"),
        "stripe_customer_id": row.get("stripe_customer_id"),
        "stripe_subscription_id": row.get("stripe_subscription_id"),
        "subscription_cancel_at_period_end": bool(row.get("subscription_cancel_at_period_end")),
        "subscription_current_period_end": row.get("subscription_current_period_end"),
        "subscription_canceled_at": row.get("subscription_canceled_at"),
        "created_at": row.get("created_at"),
        "email_verified_at": row.get("email_verified_at"),
        "email_verified": bool(row.get("email_verified_at")),
        "profile_image_url": row.get("profile_image_url"),
        "onboarding_completed_at": row.get("onboarding_completed_at"),
        "onboarding_goal": row.get("onboarding_goal"),
    }


def get_public_user_by_id(user_id):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, email, name, first_name, last_name, phone, preferred_currency, preferred_language,
               subscription_status, trial_started_at, trial_ends_at,
               stripe_customer_id, stripe_subscription_id, subscription_cancel_at_period_end,
               subscription_current_period_end, subscription_canceled_at, created_at,
               email_verified_at, profile_image_url, onboarding_completed_at, onboarding_goal
        FROM users
        WHERE id = %s
    """, (user_id,))
    user = cur.fetchone()
    cur.close()
    conn.close()
    return user


def parse_db_datetime(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return None
    return None


def user_trial_ends_at(row):
    trial_ends_at = parse_db_datetime(row.get("trial_ends_at"))
    if trial_ends_at:
        return trial_ends_at

    started = parse_db_datetime(row.get("trial_started_at")) or parse_db_datetime(row.get("created_at"))
    return started + timedelta(days=STRIPE_TRIAL_DAYS) if started else None


def has_active_subscription(row):
    status = str(row.get("subscription_status") or "trial").strip().lower()
    if status in {"active", "premium", "subscribed"}:
        cancel_at_period_end = bool(row.get("subscription_cancel_at_period_end"))
        current_period_end = parse_db_datetime(row.get("subscription_current_period_end"))
        if cancel_at_period_end and current_period_end and datetime.utcnow() > current_period_end:
            return False
        return True

    if status == "trial":
        trial_ends_at = user_trial_ends_at(row)
        return trial_ends_at is None or datetime.utcnow() <= trial_ends_at

    return False


def require_active_subscription(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT subscription_status, trial_started_at, trial_ends_at, created_at,
                   subscription_cancel_at_period_end, subscription_current_period_end
            FROM users
            WHERE id = %s
        """, (current_user_id(),))
        row = cur.fetchone()
        cur.close()
        conn.close()

        if row and has_active_subscription(row):
            return fn(*args, **kwargs)

        return jsonify({
            "error": "Your trial has ended. Subscribe to continue using this feature.",
            "code": "subscription_required",
            "subscription_status": row.get("subscription_status") if row else None,
            "trial_ends_at": row.get("trial_ends_at") if row else None,
        }), 402

    return wrapper


def stripe_configured():
    return stripe is not None and bool(STRIPE_SECRET_KEY)


def require_stripe_configured():
    if stripe is None:
        raise RuntimeError("Stripe SDK is not installed")
    if not STRIPE_SECRET_KEY:
        raise RuntimeError("Stripe is not configured (set STRIPE_SECRET_KEY)")


def stripe_amount_for_currency(currency):
    return 699 if currency == "CAD" else 499


def stripe_price_lookup_key(currency):
    return f"fintrack_pro_monthly_{currency.lower()}"


def frontend_billing_url(state):
    configured = FRONTEND_BILLING_SUCCESS_URL if state == "success" else FRONTEND_BILLING_CANCEL_URL
    if configured:
        return configured

    local_frontend = "127.0.0.1" in FRONTEND_APP_URL or "localhost" in FRONTEND_APP_URL
    app_path = "/frontend/index.html" if local_frontend else "/"
    separator = "&" if "?" in app_path else "?"
    return f"{FRONTEND_APP_URL}{app_path}{separator}billing={state}"


def frontend_page_url(page, query=None):
    local_frontend = "127.0.0.1" in FRONTEND_APP_URL or "localhost" in FRONTEND_APP_URL
    clean_page = str(page or "").lstrip("/")
    path = f"/frontend/{clean_page}" if local_frontend else f"/{clean_page}"
    separator = "&" if "?" in path else "?"
    suffix = f"{separator}{query.lstrip('?')}" if query else ""
    return f"{FRONTEND_APP_URL}{path}{suffix}"


def find_or_create_stripe_product():
    require_stripe_configured()
    products = stripe.Product.list(active=True, limit=100)
    # Stripe SDK 15+ ListObjects don't expose .get() — use attribute access.
    for product in products.data:
        if product.name == STRIPE_PRODUCT_NAME:
            return product.id

    product = stripe.Product.create(
        name=STRIPE_PRODUCT_NAME,
        description="FinTrack Pro monthly subscription",
        metadata={"app": "fintrack", "plan": "pro"},
    )
    return product.id


def find_or_create_stripe_price(currency):
    require_stripe_configured()
    currency = "CAD" if str(currency or "").upper() == "CAD" else "USD"

    configured_price = STRIPE_PRICE_CAD_ID if currency == "CAD" else STRIPE_PRICE_USD_ID
    if configured_price:
        return configured_price

    lookup_key = stripe_price_lookup_key(currency)
    prices = stripe.Price.list(active=True, lookup_keys=[lookup_key], limit=1)
    # Stripe SDK 15+ ListObjects don't expose .get() — use attribute access.
    if prices.data:
        return prices.data[0].id

    price = stripe.Price.create(
        product=find_or_create_stripe_product(),
        unit_amount=stripe_amount_for_currency(currency),
        currency=currency.lower(),
        recurring={"interval": "month"},
        lookup_key=lookup_key,
        nickname=f"{STRIPE_PRODUCT_NAME} {currency} monthly",
        metadata={"app": "fintrack", "plan": "pro", "currency": currency},
    )
    return price.id


def stripe_subscription_to_status(stripe_status):
    status = str(stripe_status or "").lower()
    if status == "trialing":
        return "trial"
    if status == "active":
        return "active"
    if status in {"canceled", "unpaid", "incomplete_expired"}:
        return "canceled"
    if status in {"past_due", "incomplete", "paused"}:
        return status
    return status or "canceled"


def timestamp_to_datetime(timestamp_value):
    if not timestamp_value:
        return None
    try:
        return datetime.utcfromtimestamp(int(timestamp_value))
    except (TypeError, ValueError, OSError):
        return None


def _coerce_to_dict(obj):
    """Accept either a plain dict or a Stripe SDK 15+ object that doesn't
    expose .get(). Return a dict either way."""
    if obj is None or isinstance(obj, dict):
        return obj or {}
    if hasattr(obj, "to_dict") and callable(getattr(obj, "to_dict")):
        try:
            return obj.to_dict()
        except Exception:
            pass
    try:
        return json.loads(str(obj))
    except Exception:
        return {}


def update_user_from_stripe_subscription(subscription, fallback_user_id=None, fallback_customer_id=None):
    if not subscription:
        return

    subscription = _coerce_to_dict(subscription)
    subscription_id = subscription.get("id")
    customer_id = subscription.get("customer") or fallback_customer_id
    status = stripe_subscription_to_status(subscription.get("status"))
    trial_ends_at = timestamp_to_datetime(subscription.get("trial_end"))
    cancel_at_period_end = bool(subscription.get("cancel_at_period_end"))
    current_period_end = timestamp_to_datetime(subscription.get("current_period_end"))
    canceled_at = timestamp_to_datetime(subscription.get("canceled_at"))

    conn = get_connection()
    cur = conn.cursor()

    if fallback_user_id:
        cur.execute("""
            UPDATE users
            SET subscription_status = %s,
                stripe_customer_id = COALESCE(%s, stripe_customer_id),
                stripe_subscription_id = COALESCE(%s, stripe_subscription_id),
                subscription_cancel_at_period_end = %s,
                subscription_current_period_end = COALESCE(%s, subscription_current_period_end),
                subscription_canceled_at = %s,
                trial_ends_at = COALESCE(%s, trial_ends_at)
            WHERE id = %s
        """, (
            status,
            customer_id,
            subscription_id,
            cancel_at_period_end,
            current_period_end,
            canceled_at,
            trial_ends_at,
            fallback_user_id,
        ))
    else:
        cur.execute("""
            UPDATE users
            SET subscription_status = %s,
                stripe_customer_id = COALESCE(%s, stripe_customer_id),
                stripe_subscription_id = COALESCE(%s, stripe_subscription_id),
                subscription_cancel_at_period_end = %s,
                subscription_current_period_end = COALESCE(%s, subscription_current_period_end),
                subscription_canceled_at = %s,
                trial_ends_at = COALESCE(%s, trial_ends_at)
            WHERE stripe_subscription_id = %s
               OR stripe_customer_id = %s
        """, (
            status,
            customer_id,
            subscription_id,
            cancel_at_period_end,
            current_period_end,
            canceled_at,
            trial_ends_at,
            subscription_id,
            customer_id,
        ))

    conn.commit()
    cur.close()
    conn.close()


def mark_subscription_deleted(subscription):
    subscription = _coerce_to_dict(subscription)
    subscription_id = subscription.get("id")
    customer_id = subscription.get("customer")
    current_period_end = timestamp_to_datetime(subscription.get("current_period_end"))
    canceled_at = timestamp_to_datetime(subscription.get("canceled_at"))
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE users
        SET subscription_status = 'canceled',
            stripe_subscription_id = COALESCE(%s, stripe_subscription_id),
            stripe_customer_id = COALESCE(%s, stripe_customer_id),
            subscription_cancel_at_period_end = FALSE,
            subscription_current_period_end = COALESCE(%s, subscription_current_period_end),
            subscription_canceled_at = COALESCE(%s, subscription_canceled_at, NOW())
        WHERE stripe_subscription_id = %s
           OR stripe_customer_id = %s
    """, (subscription_id, customer_id, current_period_end, canceled_at, subscription_id, customer_id))
    conn.commit()
    cur.close()
    conn.close()


def get_user_currency(user_id):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT preferred_currency FROM users WHERE id = %s", (user_id,))
    row = cur.fetchone() or {}
    cur.close()
    conn.close()
    return row.get("preferred_currency") or DEFAULT_CURRENCY


def user_currency():
    currency = getattr(current_user, "preferred_currency", None)
    return currency or DEFAULT_CURRENCY


def get_user_email_payload(user_id):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, email, name, first_name, last_name, preferred_currency,
               subscription_status, trial_started_at, trial_ends_at,
               stripe_customer_id, stripe_subscription_id, subscription_cancel_at_period_end,
               subscription_current_period_end, subscription_canceled_at, created_at, email_verified_at
        FROM users
        WHERE id = %s
    """, (user_id,))
    user = cur.fetchone()
    cur.close()
    conn.close()
    return dict(user) if user else None


def record_email_status(event_id, status, provider_message_id=None, error=None):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE email_events
        SET status = %s,
            provider_message_id = COALESCE(%s, provider_message_id),
            error = %s,
            sent_at = CASE WHEN %s = 'sent' THEN NOW() ELSE sent_at END
        WHERE id = %s
    """, (status, provider_message_id, error, status, event_id))
    conn.commit()
    cur.close()
    conn.close()


def reserve_email_event(user_id, event_key, recipient):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT id, status
        FROM email_events
        WHERE user_id = %s AND event_key = %s
    """, (user_id, event_key))
    existing = cur.fetchone()

    if existing and existing["status"] == "sent":
        cur.close()
        conn.close()
        return None

    if existing:
        cur.execute("""
            UPDATE email_events
            SET status = 'queued',
                recipient = %s,
                error = NULL
            WHERE id = %s
            RETURNING id
        """, (recipient, existing["id"]))
    else:
        cur.execute("""
            INSERT INTO email_events (user_id, event_key, recipient, status)
            VALUES (%s, %s, %s, 'queued')
            ON CONFLICT (user_id, event_key) DO NOTHING
            RETURNING id
        """, (user_id, event_key, recipient))

    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return row["id"] if row else None


def send_transactional_email_once(user, event_key, template_builder):
    """Best-effort email send with idempotency per user/event.
    Missing local Resend config never blocks product flows."""
    if not user or not user.get("email"):
        return {"status": "skipped", "reason": "missing_recipient"}

    template = template_builder(user)
    recipient = user["email"]

    if not email_configured():
        print(f"[email] skipped {event_key}: Resend is not configured")
        return {"status": "skipped", "reason": "not_configured"}

    event_id = reserve_email_event(user["id"], event_key, recipient)
    if event_id is None:
        return {"status": "skipped", "reason": "already_sent"}

    try:
        result = send_email(
            to=recipient,
            subject=template["subject"],
            html_body=template["html_body"],
            text_body=template.get("text_body"),
        )
    except EmailNotConfigured as exc:
        record_email_status(event_id, "failed", error=str(exc)[:1000])
        print(f"[email] skipped {event_key}: {exc}")
        return {"status": "skipped", "reason": "not_configured"}
    except EmailDeliveryError as exc:
        record_email_status(event_id, "failed", error=str(exc)[:1000])
        print(f"[email] failed {event_key} for user {user['id']}:", exc)
        return {"status": "failed", "error": str(exc)}
    except Exception as exc:
        record_email_status(event_id, "failed", error=str(exc)[:1000])
        print(f"[email] failed unexpectedly {event_key} for user {user['id']}:", exc)
        return {"status": "failed", "error": str(exc)}

    if result.status != "sent":
        record_email_status(event_id, result.status)
        return {"status": result.status}

    record_email_status(event_id, "sent", provider_message_id=result.message_id)
    return {"status": "sent", "message_id": result.message_id}


def send_email_for_user_once(user_id, event_key, template_builder):
    user = get_user_email_payload(user_id)
    return send_transactional_email_once(user, event_key, template_builder)


def find_user_id_by_stripe(customer_id=None, subscription_id=None):
    if not customer_id and not subscription_id:
        return None

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id
        FROM users
        WHERE (%s IS NOT NULL AND stripe_customer_id = %s)
           OR (%s IS NOT NULL AND stripe_subscription_id = %s)
        ORDER BY id
        LIMIT 1
    """, (customer_id, customer_id, subscription_id, subscription_id))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row["id"] if row else None


def ensure_dev_user():
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, email, name, subscription_status, trial_started_at, trial_ends_at,
               stripe_customer_id, stripe_subscription_id, subscription_cancel_at_period_end,
               subscription_current_period_end, subscription_canceled_at, created_at, email_verified_at,
               profile_image_url, preferred_currency, preferred_language
        FROM users
        WHERE email = %s
    """, (DEV_USER_EMAIL,))
    user = cur.fetchone()

    if not user:
        password_hash = bcrypt.hashpw(os.urandom(24), bcrypt.gensalt()).decode('utf-8')
        cur.execute("""
            INSERT INTO users (name, email, password_hash)
            VALUES (%s, %s, %s)
            RETURNING id, email, name, subscription_status, trial_started_at, trial_ends_at,
                      stripe_customer_id, stripe_subscription_id, subscription_cancel_at_period_end,
                      subscription_current_period_end, subscription_canceled_at, created_at, email_verified_at,
                      profile_image_url, preferred_currency, preferred_language,
                      onboarding_completed_at, onboarding_goal
        """, ("Local Demo User", DEV_USER_EMAIL, password_hash))
        user = cur.fetchone()
        conn.commit()

    cur.close()
    conn.close()
    return user


def attach_orphan_demo_data(user_id):
    conn = get_connection()
    cur = conn.cursor()
    for table in ("transactions", "budgets", "goals", "recurring_payments"):
        cur.execute(f"UPDATE {table} SET user_id = %s WHERE user_id IS NULL", (user_id,))
    conn.commit()
    cur.close()
    conn.close()


@app.before_request
def dev_auto_login():
    request_host = request.host.split(":")[0]
    is_local_request = request_host in {"127.0.0.1", "localhost"}
    should_auto_login = DEV_AUTO_LOGIN or (LOCAL_DEV_AUTO_LOGIN and is_local_request)

    if not should_auto_login:
        return

    if not request.path.startswith("/api/"):
        return

    if current_user.is_authenticated:
        return

    user = ensure_dev_user()
    attach_orphan_demo_data(user["id"])
    login_user(User(user))


# Only the endpoints that actually invoke Claude count against the per-user
# rate limit. Read-only / deterministic endpoints (forecast, safe-to-spend,
# insights GET, history GET, what-if, etc.) are cheap and should never block
# the dashboard from rendering.
AI_RATE_LIMITED_RULES = (
    ("POST", "/api/money-coach"),
    ("POST", "/api/money-coach/stream"),
    ("POST", "/api/coach"),
    ("POST", "/api/coach/ask"),
    ("POST", "/api/insights/daily-scan"),
    ("POST", "/api/transactions/scan-receipt"),
    ("POST", "/api/receipt/scan"),
)


@app.before_request
def rate_limit_coach_endpoints():
    if request.method == "OPTIONS":
        return

    method = request.method.upper()
    path = request.path
    if (method, path) not in AI_RATE_LIMITED_RULES:
        return

    if not current_user.is_authenticated:
        return

    retry_after = check_money_coach_rate_limit(current_user_id())
    if retry_after:
        return jsonify({
            "error": "Coach rate limit reached. Try again later.",
            "retry_after": retry_after,
            "limit": MONEY_COACH_RATE_LIMIT_COUNT,
            "window_seconds": MONEY_COACH_RATE_LIMIT_WINDOW,
        }), 429


def validate_transaction_payload(data):
    data = data or {}
    required_fields = ["name", "amount", "category", "account", "date"]
    missing = [
        field
        for field in required_fields
        if data.get(field) is None or str(data.get(field)).strip() == ""
    ]

    if missing:
        return None, f"Missing required fields: {', '.join(missing)}"

    try:
        amount = Decimal(str(data.get("amount")))
    except (InvalidOperation, TypeError):
        return None, "Amount must be a valid number"

    try:
        pd.to_datetime(str(data.get("date"))).date()
    except Exception:
        return None, "Date must be valid"

    return {
        "name": str(data.get("name")).strip(),
        "amount": amount,
        "category": str(data.get("category")).strip(),
        "account": str(data.get("account")).strip(),
        "date": data.get("date"),
        "source": (data.get("source") or "manual").strip() if isinstance(data.get("source"), str) else "manual",
    }, None

# ── START UP ──
init_db()
# NOTE: backfill_email_canonical() runs at the bottom of the file, after the
# function itself is defined. Don't call it here.

# ══════════════════════════════════════
#  AUTH
# ══════════════════════════════════════

@app.route('/auth/register', methods=['POST'])
def register():
    data = request.json or {}
    name = (data.get('name') or '').strip()
    email = normalize_email(data.get('email'))
    password = data.get('password') or ''

    if not name or not email or not password:
        return jsonify({"error": "Name, email, and password are required"}), 400

    if not EMAIL_RE.match(email):
        return jsonify({"error": "Please enter a valid email address"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    # ── Trial-abuse guards ───────────────────────────────────────────────
    # Layer 1: disposable / throwaway email domains.
    if is_disposable_email(email):
        return jsonify({
            "error": "Please use a permanent email address — temporary or disposable inboxes aren't supported."
        }), 400

    # Layer 2 + 3: same canonical email already in use, OR previously deleted.
    # Catches Gmail aliasing (anas+1@gmail.com), dot tricks (a.n.a.s@gmail.com),
    # and re-trial after account deletion.
    had_prior, kind = email_has_prior_account(email)
    if had_prior:
        if kind == "active":
            return jsonify({
                "error": "An account already exists for this email. Sign in instead, or reset your password if you've forgotten it."
            }), 409
        # kind == "deleted"
        return jsonify({
            "error": f"You've already used a FinTrack trial on this email. Sign in to your existing account, or contact {SUPPORT_EMAIL} if you need help getting back in."
        }), 409

    canonical = canonicalize_email(email)
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT id FROM users WHERE email = %s", (email,))
    if cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({"error": "Email is already registered"}), 409

    cur.execute("""
        INSERT INTO users (name, email, password_hash, email_canonical)
        VALUES (%s, %s, %s, %s)
        RETURNING id, email, name, subscription_status, trial_started_at, trial_ends_at,
                  stripe_customer_id, stripe_subscription_id, subscription_cancel_at_period_end,
                  subscription_current_period_end, subscription_canceled_at, created_at, email_verified_at,
                  profile_image_url, preferred_currency, preferred_language,
                  onboarding_completed_at, onboarding_goal
    """, (name, email, password_hash, canonical))

    user = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    send_verification_email_for_user(dict(user))
    send_transactional_email_once(user, "welcome_trial", welcome_trial_email)

    # If email verification is enforced, we deliberately do NOT auto-login.
    # The frontend must redirect to verify-email.html, the user clicks the
    # emailed link, then they can log in. This prevents typo signups and
    # makes email verification a true gate, not a soft banner.
    if EMAIL_VERIFICATION_REQUIRED and not app.config.get("TESTING"):
        return jsonify({
            "message": "Account created. Check your email to verify it before logging in.",
            "user": public_user_payload(user),
            "verification_required": True,
            "email": user.get("email"),
        }), 201

    # Verification not required (test / local dev): log them in immediately so
    # the dev_auto_login middleware doesn't hijack the next request as the
    # local dev user.
    login_user(User(dict(user)))
    return jsonify({"message": "Registration successful", "user": public_user_payload(user)}), 201


@app.route('/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    email = normalize_email(data.get('email'))
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, email, password_hash, name, subscription_status, trial_started_at, trial_ends_at,
               stripe_customer_id, stripe_subscription_id, subscription_cancel_at_period_end,
               subscription_current_period_end, subscription_canceled_at, created_at, email_verified_at,
               profile_image_url, preferred_currency, preferred_language
        FROM users
        WHERE email = %s
    """, (email,))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if not user or not bcrypt.checkpw(password.encode('utf-8'), user["password_hash"].encode('utf-8')):
        return jsonify({"error": "Invalid email or password"}), 401

    if EMAIL_VERIFICATION_REQUIRED and not app.config.get("TESTING") and not user.get("email_verified_at"):
        send_verification_email_for_user(dict(user))
        return jsonify({
            "error": "Please verify your email before logging in. We sent you a new verification link.",
            "code": "email_not_verified",
        }), 403

    login_user(User(user))

    return jsonify({"message": "Login successful", "user": public_user_payload(user)}), 200


@app.route('/auth/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = normalize_email(data.get("email"))
    generic_message = "If that email is registered, a reset link has been sent."

    if not email or not EMAIL_RE.match(email):
        return jsonify({"message": generic_message}), 200

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, email, name, first_name
        FROM users
        WHERE email = %s
    """, (email,))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if not user:
        return jsonify({"message": generic_message}), 200

    token = create_password_reset_token(user["id"])
    reset_url = frontend_page_url("reset-password.html", f"token={token}")
    template = password_reset_email(dict(user), reset_url)

    if email_configured():
        try:
            send_email(
                to=user["email"],
                subject=template["subject"],
                html_body=template["html_body"],
                text_body=template.get("text_body"),
            )
        except Exception as exc:
            print(f"[email] password reset failed for user {user['id']}:", exc)
    else:
        print("[email] skipped password reset: Resend is not configured")

    return jsonify({"message": generic_message}), 200


@app.route('/auth/reset-password/validate', methods=['GET'])
def validate_password_reset():
    token = (request.args.get("token") or "").strip()
    if not token or not find_valid_password_reset_token(token):
        return jsonify({"valid": False, "error": "This reset link is invalid or has expired."}), 400
    return jsonify({"valid": True}), 200


@app.route('/auth/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    password = data.get("password") or ""

    if not token:
        return jsonify({"error": "Reset token is required"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    token_row = find_valid_password_reset_token(token)
    if not token_row:
        return jsonify({"error": "This reset link is invalid or has expired."}), 400

    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE users
        SET password_hash = %s
        WHERE id = %s
    """, (password_hash, token_row["user_id"]))
    conn.commit()
    cur.close()
    conn.close()

    mark_password_reset_token_used(token_row["id"])
    return jsonify({"message": "Password updated. You can now log in."}), 200


@app.route('/auth/change-password', methods=['POST'])
@login_required
def change_password():
    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""

    if not current_password or not new_password:
        return jsonify({"error": "Current password and new password are required"}), 400

    if len(new_password) < 8:
        return jsonify({"error": "New password must be at least 8 characters"}), 400

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, password_hash
        FROM users
        WHERE id = %s
    """, (current_user_id(),))
    user = cur.fetchone()

    if not user or not bcrypt.checkpw(current_password.encode("utf-8"), user["password_hash"].encode("utf-8")):
        cur.close()
        conn.close()
        return jsonify({"error": "Current password is incorrect"}), 400

    password_hash = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    cur.execute("""
        UPDATE users
        SET password_hash = %s
        WHERE id = %s
    """, (password_hash, current_user_id()))
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "Password changed successfully."}), 200


@app.route('/auth/verify-email', methods=['POST'])
def verify_email():
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()

    if not token:
        return jsonify({"error": "Verification token is required"}), 400

    token_row = find_valid_email_verification_token(token)
    if not token_row:
        return jsonify({"error": "This verification link is invalid or has expired."}), 400

    mark_user_email_verified(token_row["user_id"])
    mark_email_verification_token_used(token_row["id"])
    return jsonify({"message": "Email verified. You can continue using FinTrack."}), 200


@app.route('/auth/resend-verification', methods=['POST'])
def resend_verification():
    # Public endpoint — a freshly-signed-up user can't be logged in yet because
    # the verification gate blocks login. We accept the email in the body and
    # always return a generic 200 to prevent account enumeration.
    generic_ok = jsonify({
        "message": "If that email is registered, a verification link has been sent.",
    }), 200

    data = request.get_json(silent=True) or {}
    email = normalize_email(data.get("email"))
    if not email:
        if current_user.is_authenticated:
            user = get_user_email_payload(current_user_id())
            if user and not user.get("email_verified_at"):
                send_verification_email_for_user(user)
            return generic_ok
        return generic_ok

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "SELECT id, email, name, email_verified_at FROM users WHERE email = %s",
        (email,),
    )
    user = cur.fetchone()
    cur.close()
    conn.close()

    if user and not user.get("email_verified_at"):
        send_verification_email_for_user(dict(user))

    return generic_ok


@app.route('/auth/logout', methods=['POST'])
def logout():
    logout_user()
    return jsonify({"message": "Logout successful"}), 200


# ─── TEMPORARY DEBUG ENDPOINT — remove after diagnosing email send issue ───
@app.route('/api/debug/email-status', methods=['GET'])
def debug_email_status():
    token = request.args.get("token", "")
    if token != "fintrack_debug_2026_05_22":
        return jsonify({"error": "Not found"}), 404

    import email_service as _es
    client = _es.email_client
    info = {
        "has_api_key": bool(client.api_key),
        "api_key_length": len(client.api_key) if client.api_key else 0,
        "api_key_prefix": client.api_key[:6] + "..." if client.api_key else None,
        "from_email": client.from_email,
        "reply_to": client.reply_to,
        "enabled": client.enabled,
        "resend_module_loaded": _es.resend is not None,
        "configured": client.configured(),
        "EMAIL_VERIFICATION_REQUIRED": EMAIL_VERIFICATION_REQUIRED,
    }

    test_to = request.args.get("send_to")
    if test_to:
        try:
            result = _es.send_email(
                to=test_to,
                subject="FinTrack debug ping",
                html_body="<p>Debug send from /api/debug/email-status.</p>",
                text_body="Debug send from /api/debug/email-status.",
            )
            info["test_send"] = {"status": result.status, "message_id": result.message_id}
        except Exception as exc:
            info["test_send"] = {"status": "exception", "error": repr(exc)}

    return jsonify(info), 200


def _rows_to_csv(rows, fieldnames):
    """Convert a list of dicts to a CSV string. Empty list yields just the
    header row, which is the standard convention for data exports."""
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL)
    writer.writeheader()
    for row in rows or []:
        clean = {}
        for k in fieldnames:
            v = row.get(k) if isinstance(row, dict) else None
            if v is None:
                clean[k] = ""
            elif hasattr(v, "isoformat"):
                clean[k] = v.isoformat()
            else:
                clean[k] = str(v)
        writer.writerow(clean)
    return buf.getvalue()


@app.route('/api/account/export', methods=['GET'])
@login_required
def export_account_data():
    """Download a ZIP archive containing every piece of personal data we hold
    for the current user, formatted as plain CSV files. Honors the
    right-to-data-portability promised in our Privacy Policy + help center."""
    user_id = current_user_id()
    if not user_id:
        return jsonify({"error": "Please log in"}), 401

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    buf = io.BytesIO()
    try:
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            # 1. Account profile (the user's own data about themselves)
            cur.execute("""
                SELECT id, email, name, first_name, last_name, phone,
                       preferred_currency, preferred_language,
                       subscription_status, trial_started_at, trial_ends_at,
                       email_verified_at, created_at,
                       onboarding_completed_at, onboarding_goal
                FROM users
                WHERE id = %s
            """, (user_id,))
            profile = cur.fetchone()
            profile_fields = ["id", "email", "name", "first_name", "last_name", "phone",
                              "preferred_currency", "preferred_language",
                              "subscription_status", "trial_started_at", "trial_ends_at",
                              "email_verified_at", "created_at",
                              "onboarding_completed_at", "onboarding_goal"]
            zf.writestr("account.csv", _rows_to_csv([dict(profile)] if profile else [], profile_fields))

            # 2. Transactions
            cur.execute("""
                SELECT date, name, amount, category, account, source, created_at
                FROM transactions
                WHERE user_id = %s
                ORDER BY date DESC, id DESC
            """, (user_id,))
            zf.writestr("transactions.csv", _rows_to_csv(
                [dict(r) for r in cur.fetchall()],
                ["date", "name", "amount", "category", "account", "source", "created_at"]
            ))

            # 3. Budgets
            cur.execute("""
                SELECT category, amount, start_date, days, match_keyword, month, year, created_at
                FROM budgets
                WHERE user_id = %s
                ORDER BY id
            """, (user_id,))
            zf.writestr("budgets.csv", _rows_to_csv(
                [dict(r) for r in cur.fetchall()],
                ["category", "amount", "start_date", "days", "match_keyword", "month", "year", "created_at"]
            ))

            # 4. Recurring payments
            cur.execute("""
                SELECT name, amount, category, account, frequency, next_date,
                       is_active, last_paid_at, last_paid_for_date, created_at
                FROM recurring_payments
                WHERE user_id = %s
                ORDER BY id
            """, (user_id,))
            zf.writestr("recurring.csv", _rows_to_csv(
                [dict(r) for r in cur.fetchall()],
                ["name", "amount", "category", "account", "frequency", "next_date",
                 "is_active", "last_paid_at", "last_paid_for_date", "created_at"]
            ))

            # 5. Goals + their contributions
            cur.execute("""
                SELECT id, name, target_amount, saved_amount, deadline, category,
                       icon, auto_link_savings, created_at
                FROM goals
                WHERE user_id = %s
                ORDER BY id
            """, (user_id,))
            goal_rows = [dict(r) for r in cur.fetchall()]
            goal_ids = [g["id"] for g in goal_rows]
            zf.writestr("goals.csv", _rows_to_csv(
                goal_rows,
                ["id", "name", "target_amount", "saved_amount", "deadline", "category",
                 "icon", "auto_link_savings", "created_at"]
            ))

            # 5b. Goal contributions (only the ones tied to your goals)
            if goal_ids:
                cur.execute("""
                    SELECT goal_id, amount, note, date, source, created_at
                    FROM goal_contributions
                    WHERE goal_id = ANY(%s)
                    ORDER BY date DESC, id DESC
                """, (goal_ids,))
                zf.writestr("goal_contributions.csv", _rows_to_csv(
                    [dict(r) for r in cur.fetchall()],
                    ["goal_id", "amount", "note", "date", "source", "created_at"]
                ))
            else:
                zf.writestr("goal_contributions.csv", _rows_to_csv([], ["goal_id", "amount", "note", "date", "source", "created_at"]))

            # 6. Money Coach Q&A history
            cur.execute("""
                SELECT created_at, question, answer, mode, feedback
                FROM money_coach_history
                WHERE user_id = %s
                ORDER BY created_at DESC
            """, (user_id,))
            zf.writestr("money_coach_history.csv", _rows_to_csv(
                [dict(r) for r in cur.fetchall()],
                ["created_at", "question", "answer", "mode", "feedback"]
            ))

            # 7. README so a non-technical user understands what they got
            now_iso = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
            readme = (
                "FinTrack — your data export\n"
                "===========================\n\n"
                f"Exported on: {now_iso}\n"
                f"Account email: {profile['email'] if profile else 'unknown'}\n\n"
                "This archive contains everything FinTrack has stored about you,\n"
                "as plain CSV files. Open them in Excel, Google Sheets, Numbers,\n"
                "Apple Numbers, or any text editor. All files use UTF-8 encoding.\n\n"
                "Files in this archive:\n"
                "  • account.csv               - your profile (email, name, settings)\n"
                "  • transactions.csv          - every transaction you've recorded\n"
                "  • budgets.csv               - your category budgets\n"
                "  • recurring.csv             - subscriptions and recurring bills\n"
                "  • goals.csv                 - your savings goals\n"
                "  • goal_contributions.csv    - savings you've added to goals\n"
                "  • money_coach_history.csv   - your AI Money Coach Q&A history\n\n"
                "What's NOT in here, by design:\n"
                "  • Your password (we never store it in plain text — only as a\n"
                "    one-way bcrypt hash, which is meaningless to you).\n"
                "  • Card details (handled by Stripe, never stored by us).\n"
                "  • Service logs and abuse-prevention hashes.\n\n"
                "Questions? help@fintrack.app\n"
            )
            zf.writestr("README.txt", readme)
    finally:
        cur.close()
        conn.close()

    buf.seek(0)
    filename = f"fintrack-export-{datetime.utcnow().strftime('%Y-%m-%d')}.zip"
    return send_file(
        buf,
        mimetype="application/zip",
        as_attachment=True,
        download_name=filename,
    )


@app.route('/api/account/delete', methods=['POST'])
@login_required
def delete_account():
    """Permanently delete the user's account.
    Before deleting, we record the canonical-hash of their email in
    previously_used_emails so the trial can't be reopened from the same address
    (including Gmail aliases). The user must type the word 'delete' to confirm.
    """
    data = request.get_json(silent=True) or {}
    confirmation = (data.get("confirmation") or "").strip().lower()
    if confirmation != "delete":
        return jsonify({
            "error": "Type the word 'delete' to confirm. This action is irreversible."
        }), 400

    user_id = current_user_id()
    if not user_id:
        return jsonify({"error": "Please log in"}), 401

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            "SELECT id, email, trial_ends_at FROM users WHERE id = %s",
            (user_id,),
        )
        user = cur.fetchone()
        if not user:
            return jsonify({"error": "Account not found"}), 404

        canonical_h = email_canonical_hash(user["email"])

        # Record the hash before deleting so this email can't reopen a trial.
        cur.execute("""
            INSERT INTO previously_used_emails
                (email_canonical_hash, original_user_id, trial_ended_at, deleted_at, reason)
            VALUES (%s, %s, %s, NOW(), 'user_requested_delete')
            ON CONFLICT (email_canonical_hash) DO UPDATE
            SET original_user_id = EXCLUDED.original_user_id,
                deleted_at = NOW(),
                reason = 'user_requested_delete'
        """, (canonical_h, user_id, user.get("trial_ends_at")))

        # Delete the user row. ON DELETE CASCADE on the foreign keys cleans
        # up transactions, budgets, goals, recurring, insights, etc.
        cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
    except Exception:
        try: conn.rollback()
        except Exception: pass
        raise
    finally:
        cur.close()
        conn.close()

    logout_user()
    return jsonify({
        "message": "Account deleted. Your data has been removed."
    }), 200


@app.route('/auth/me', methods=['GET'])
@login_required
def me():
    return jsonify({
        "user": {
            "id": current_user_id(),
            "email": current_user.email,
            "name": current_user.name,
            "subscription_status": current_user.subscription_status,
            "trial_started_at": current_user.trial_started_at,
            "trial_ends_at": current_user.trial_ends_at,
            "stripe_customer_id": current_user.stripe_customer_id,
            "stripe_subscription_id": current_user.stripe_subscription_id,
            "subscription_cancel_at_period_end": bool(current_user.subscription_cancel_at_period_end),
            "subscription_current_period_end": current_user.subscription_current_period_end,
            "subscription_canceled_at": current_user.subscription_canceled_at,
            "created_at": current_user.created_at,
            "email_verified_at": current_user.email_verified_at,
            "email_verified": bool(current_user.email_verified_at),
            "profile_image_url": current_user.profile_image_url,
            "preferred_currency": current_user.preferred_currency,
            "preferred_language": current_user.preferred_language,
        }
    }), 200


# ══════════════════════════════════════
#  BILLING
# ══════════════════════════════════════

@app.route('/api/billing/create-checkout', methods=['POST'])
@login_required
def create_billing_checkout():
    try:
        require_stripe_configured()
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503

    payload = request.get_json(silent=True) or {}
    requested_currency = str(payload.get("currency") or user_currency() or "USD").upper()
    billing_currency = "CAD" if requested_currency == "CAD" else "USD"

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, email, name, stripe_customer_id, preferred_currency
        FROM users
        WHERE id = %s
    """, (current_user_id(),))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if not user:
        return jsonify({"error": "Please log in"}), 401

    try:
        price_id = find_or_create_stripe_price(billing_currency)
        session_args = {
            "mode": "subscription",
            "line_items": [{"price": price_id, "quantity": 1}],
            "client_reference_id": str(current_user_id()),
            "metadata": {"user_id": str(current_user_id()), "plan": "fintrack_pro"},
            "subscription_data": {
                "trial_period_days": STRIPE_TRIAL_DAYS,
                "metadata": {"user_id": str(current_user_id()), "plan": "fintrack_pro"},
            },
            "success_url": frontend_billing_url("success"),
            "cancel_url": frontend_billing_url("cancelled"),
            "allow_promotion_codes": True,
        }

        if user.get("stripe_customer_id"):
            session_args["customer"] = user["stripe_customer_id"]
        else:
            session_args["customer_email"] = user["email"]

        checkout_session = stripe.checkout.Session.create(**session_args)
    except Exception as exc:
        print("Stripe checkout error:", exc)
        return jsonify({"error": "Could not start checkout"}), 502

    return jsonify({"url": checkout_session["url"]}), 200


@app.route('/api/billing/portal', methods=['POST'])
@login_required
def create_billing_portal_session():
    """Open the Stripe Customer Portal so the user can update their payment
    method, view invoices, change billing email, or cancel the subscription.
    Stripe hosts this page — we just create a session and redirect."""
    try:
        require_stripe_configured()
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "SELECT id, stripe_customer_id FROM users WHERE id = %s",
        (current_user_id(),),
    )
    user = cur.fetchone()
    cur.close()
    conn.close()

    if not user:
        return jsonify({"error": "Please log in"}), 401
    if not user.get("stripe_customer_id"):
        # No customer in Stripe yet — they haven't subscribed. Send them to
        # checkout instead so the action still does something useful.
        return jsonify({
            "error": "no_stripe_customer",
            "message": "You don't have a billing account yet. Subscribe first.",
        }), 409

    try:
        session = stripe.billing_portal.Session.create(
            customer=user["stripe_customer_id"],
            return_url=frontend_billing_url("returned"),
        )
    except Exception as exc:
        print("Stripe billing portal error:", exc)
        return jsonify({"error": "Could not open billing portal"}), 502

    return jsonify({"url": session["url"]}), 200


@app.route('/api/billing/cancel-subscription', methods=['POST'])
@login_required
def cancel_billing_subscription():
    payload = request.get_json(silent=True) or {}
    confirmed = payload.get("confirm") is True or str(payload.get("confirmation") or "").strip().lower() == "cancel"
    if not confirmed:
        return jsonify({"error": "Please confirm subscription cancellation."}), 400

    try:
        require_stripe_configured()
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, stripe_customer_id, stripe_subscription_id
        FROM users
        WHERE id = %s
    """, (current_user_id(),))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if not user:
        return jsonify({"error": "Please log in"}), 401

    subscription_id = user.get("stripe_subscription_id")
    if not subscription_id:
        return jsonify({
            "error": "No active Stripe subscription was found for this account.",
            "code": "no_subscription",
        }), 409

    try:
        subscription = _coerce_to_dict(stripe.Subscription.retrieve(subscription_id))
        subscription_status = str(subscription.get("status") or "").lower()
        message = "Subscription cancellation scheduled. You keep access until the current billing period ends."

        if subscription_status in {"canceled", "incomplete_expired"}:
            mark_subscription_deleted(subscription)
            message = "Subscription is already canceled."
        elif subscription.get("cancel_at_period_end"):
            update_user_from_stripe_subscription(
                subscription,
                fallback_user_id=current_user_id(),
                fallback_customer_id=user.get("stripe_customer_id"),
            )
            message = "Subscription cancellation is already scheduled. You keep access until the current billing period ends."
        else:
            subscription = _coerce_to_dict(stripe.Subscription.modify(
                subscription_id,
                cancel_at_period_end=True,
            ))
            update_user_from_stripe_subscription(
                subscription,
                fallback_user_id=current_user_id(),
                fallback_customer_id=user.get("stripe_customer_id"),
            )
    except Exception as exc:
        print("Stripe subscription cancellation error:", exc)
        return jsonify({
            "error": f"Could not cancel subscription. Please try again or contact {SUPPORT_EMAIL}.",
        }), 502

    fresh_user = get_public_user_by_id(current_user_id())
    return jsonify({
        "message": message,
        "user": public_user_payload(fresh_user) if fresh_user else None,
    }), 200


@app.route('/api/billing/webhook', methods=['POST'])
def stripe_billing_webhook():
    if stripe is None:
        return jsonify({"error": "Stripe SDK is not installed"}), 503

    payload = request.get_data()
    signature = request.headers.get("Stripe-Signature", "")

    try:
        if STRIPE_WEBHOOK_SECRET:
            # construct_event verifies the HMAC signature; we don't use its
            # return value because StripeObject in SDK 15+ doesn't expose a
            # plain .get() interface across all nested fields. Re-parse the
            # raw payload as a dict — the signature check above guarantees
            # authenticity.
            stripe.Webhook.construct_event(payload, signature, STRIPE_WEBHOOK_SECRET)
            event = json.loads(payload.decode("utf-8") or "{}")
        elif IS_PRODUCTION:
            return jsonify({"error": "Stripe webhook secret is not configured"}), 503
        else:
            event = json.loads(payload.decode("utf-8") or "{}")
    except ValueError:
        return jsonify({"error": "Invalid webhook payload"}), 400
    except Exception as exc:
        print("Stripe webhook signature error:", exc)
        return jsonify({"error": "Invalid webhook signature"}), 400

    event_type = event.get("type")
    data_object = (event.get("data") or {}).get("object") or {}

    try:
        if event_type == "checkout.session.completed":
            user_id = data_object.get("client_reference_id") or (data_object.get("metadata") or {}).get("user_id")
            subscription_id = data_object.get("subscription")
            customer_id = data_object.get("customer")

            if user_id:
                conn = get_connection()
                cur = conn.cursor()
                cur.execute("""
                    UPDATE users
                    SET stripe_customer_id = COALESCE(%s, stripe_customer_id),
                        stripe_subscription_id = COALESCE(%s, stripe_subscription_id)
                    WHERE id = %s
                """, (customer_id, subscription_id, int(user_id)))
                conn.commit()
                cur.close()
                conn.close()

            if subscription_id and STRIPE_SECRET_KEY:
                subscription = stripe.Subscription.retrieve(subscription_id)
                update_user_from_stripe_subscription(
                    subscription,
                    fallback_user_id=int(user_id) if user_id else None,
                    fallback_customer_id=customer_id,
                )

            if user_id:
                checkout_currency = str(data_object.get("currency") or get_user_currency(int(user_id)) or "USD").upper()
                checkout_currency = "CAD" if checkout_currency == "CAD" else "USD"
                send_email_for_user_once(
                    int(user_id),
                    "subscription_active",
                    lambda user: subscription_active_email(user, checkout_currency),
                )

        elif event_type == "customer.subscription.updated":
            update_user_from_stripe_subscription(data_object)
            status = stripe_subscription_to_status(data_object.get("status"))
            if status in {"active", "trial"}:
                user_id = find_user_id_by_stripe(
                    customer_id=data_object.get("customer"),
                    subscription_id=data_object.get("id"),
                )
                if user_id:
                    currency = "CAD" if get_user_currency(user_id) == "CAD" else "USD"
                    send_email_for_user_once(
                        user_id,
                        "subscription_active",
                        lambda user: subscription_active_email(user, currency),
                    )

        elif event_type == "customer.subscription.deleted":
            user_id = find_user_id_by_stripe(
                customer_id=data_object.get("customer"),
                subscription_id=data_object.get("id"),
            )
            mark_subscription_deleted(data_object)
            if user_id:
                send_email_for_user_once(user_id, "subscription_canceled", subscription_canceled_email)

        elif event_type == "invoice.paid":
            # Send a receipt for every successful charge. Required by most tax
            # authorities, and customers expect it. Dedup key includes the
            # invoice ID so each invoice gets exactly one receipt email.
            user_id = find_user_id_by_stripe(
                customer_id=data_object.get("customer"),
                subscription_id=data_object.get("subscription"),
            )
            invoice_id = data_object.get("id") or "unknown"
            if user_id:
                send_email_for_user_once(
                    user_id,
                    f"invoice_paid:{invoice_id}",
                    lambda user, inv=data_object: payment_receipt_email(user, inv),
                )

        elif event_type == "invoice.payment_failed":
            # Dunning email — tell the user the card didn't go through and
            # when Stripe will retry. Dedup key includes the attempt_count so
            # each retry attempt gets its own email instead of being silenced.
            user_id = find_user_id_by_stripe(
                customer_id=data_object.get("customer"),
                subscription_id=data_object.get("subscription"),
            )
            invoice_id = data_object.get("id") or "unknown"
            attempt = data_object.get("attempt_count") or 1
            if user_id:
                send_email_for_user_once(
                    user_id,
                    f"invoice_payment_failed:{invoice_id}:{attempt}",
                    lambda user, inv=data_object: payment_failed_email(user, inv),
                )

    except Exception as exc:
        print("Stripe webhook handling error:", exc)
        return jsonify({"error": "Webhook handling failed"}), 500

    return jsonify({"received": True}), 200


@app.route('/uploads/profile-pictures/<path:filename>')
def uploaded_profile_picture(filename):
    return send_from_directory(PROFILE_UPLOAD_DIR, filename)


@app.route('/api/profile', methods=['GET'])
@login_required
def get_profile():
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, email, name, first_name, last_name, phone, preferred_currency, preferred_language,
               subscription_status, trial_started_at, trial_ends_at,
               stripe_customer_id, stripe_subscription_id, subscription_cancel_at_period_end,
               subscription_current_period_end, subscription_canceled_at, created_at, email_verified_at, profile_image_url,
               onboarding_completed_at, onboarding_goal
        FROM users
        WHERE id = %s
    """, (current_user_id(),))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if not user:
        return jsonify({"error": "Please log in"}), 401

    return jsonify({"user": public_user_payload(user)}), 200


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^[\d\s()+\-]{0,30}$")
CURRENCY_RE = re.compile(r"^[A-Z]{3}$")
SUPPORTED_LANGUAGES = {"en", "fr", "es"}


def normalize_email(value):
    return (value or "").strip().lower()


# Gmail and Googlemail share one mailbox: dots in the local part are ignored,
# and everything after '+' is an alias of the base address. We canonicalize
# these aggressively so the same human signing up twice with different surface
# emails is detected as one prior account.
GMAIL_CANONICAL_DOMAINS = {"gmail.com", "googlemail.com"}

# Common throwaway email services. Not exhaustive — just the obvious ones
# that catch casual abuse. Real fraud uses VPNs and unique addresses anyway.
DISPOSABLE_EMAIL_DOMAINS = frozenset({
    "10minutemail.com", "10minutemail.net", "20minutemail.com",
    "anonymouspaste.org", "dispostable.com", "fakemail.net", "getairmail.com",
    "guerrillamail.com", "guerrillamailblock.com", "mailinator.com",
    "mailnesia.com", "maildrop.cc", "sharklasers.com", "spambox.us",
    "tempinbox.com", "tempmail.org", "tempr.email", "throwawaymail.com",
    "trashmail.com", "yopmail.com", "mintemail.com", "mohmal.com",
})


def canonicalize_email(email):
    """Return the canonical form used ONLY for abuse-detection duplicate checks.
    Do not store this as the user's primary email — use normalize_email() for that.
    Returns a lowercased '<local>@<domain>' string, or '' if unparseable."""
    cleaned = (email or "").strip().lower()
    if "@" not in cleaned:
        return cleaned
    local, _, domain = cleaned.partition("@")
    if not local or not domain:
        return cleaned
    # Strip alias (everything after '+') for all providers — it's the most
    # common reuse trick and is provider-defined for Gmail/Outlook/iCloud.
    local = local.split("+", 1)[0]
    if domain in GMAIL_CANONICAL_DOMAINS:
        # Gmail ignores dots in the local part.
        local = local.replace(".", "")
        domain = "gmail.com"
    return f"{local}@{domain}"


def email_canonical_hash(email):
    """SHA-256 of the canonical email. Used for previously_used_emails
    so we can prove "this address held an account before" without
    storing the address itself."""
    return hashlib.sha256(canonicalize_email(email).encode("utf-8")).hexdigest()


def is_disposable_email(email):
    canonical = canonicalize_email(email)
    if "@" not in canonical:
        return False
    return canonical.split("@", 1)[1] in DISPOSABLE_EMAIL_DOMAINS


def email_has_prior_account(email):
    """Returns (had_prior, kind) where kind is 'active' (still has an account)
    or 'deleted' (canonical hash in previously_used_emails) or None.
    Used at signup to block trial-reuse via Gmail aliases."""
    canonical = canonicalize_email(email)
    if not canonical or "@" not in canonical:
        return False, None
    canonical_h = email_canonical_hash(email)

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            "SELECT id FROM users WHERE email_canonical = %s LIMIT 1",
            (canonical,),
        )
        if cur.fetchone():
            return True, "active"
        cur.execute(
            "SELECT 1 FROM previously_used_emails WHERE email_canonical_hash = %s LIMIT 1",
            (canonical_h,),
        )
        if cur.fetchone():
            return True, "deleted"
        return False, None
    finally:
        cur.close()
        conn.close()


def backfill_email_canonical():
    """One-shot at startup: any users row whose email_canonical is NULL
    (i.e. created before this column existed) gets its canonical filled in.
    Safe to call repeatedly; the WHERE clause makes it a no-op after the
    first run."""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT id, email FROM users WHERE email_canonical IS NULL")
        rows = cur.fetchall()
        if not rows:
            return 0
        for row in rows:
            canonical = canonicalize_email(row["email"])
            cur.execute(
                "UPDATE users SET email_canonical = %s WHERE id = %s",
                (canonical, row["id"]),
            )
        conn.commit()
        print(f"[abuse-guard] backfilled email_canonical on {len(rows)} existing users")
        return len(rows)
    except Exception as exc:
        print(f"[abuse-guard] backfill failed: {exc}")
        conn.rollback()
        return 0
    finally:
        cur.close()
        conn.close()


def password_reset_token_hash(token):
    return hashlib.sha256(str(token or "").encode("utf-8")).hexdigest()


def secure_token_hash(token):
    return hashlib.sha256(str(token or "").encode("utf-8")).hexdigest()


def create_one_time_token(user_id, table_name, expires_minutes):
    raw_token = secrets.token_urlsafe(32)
    token_hash = secure_token_hash(raw_token)

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(f"""
        UPDATE {table_name}
        SET used_at = NOW()
        WHERE user_id = %s
          AND used_at IS NULL
    """, (user_id,))
    cur.execute(f"""
        INSERT INTO {table_name} (user_id, token_hash, expires_at)
        VALUES (%s, %s, NOW() + (%s || ' minutes')::interval)
    """, (user_id, token_hash, expires_minutes))
    conn.commit()
    cur.close()
    conn.close()
    return raw_token


def create_password_reset_token(user_id):
    return create_one_time_token(user_id, "password_reset_tokens", PASSWORD_RESET_TOKEN_MINUTES)


def find_valid_password_reset_token(token):
    token_hash = secure_token_hash(token)
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT prt.id, prt.user_id, u.email, u.name, u.first_name
        FROM password_reset_tokens prt
        JOIN users u ON u.id = prt.user_id
        WHERE prt.token_hash = %s
          AND prt.used_at IS NULL
          AND prt.expires_at > NOW()
        LIMIT 1
    """, (token_hash,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def mark_password_reset_token_used(token_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE id = %s
    """, (token_id,))
    conn.commit()
    cur.close()
    conn.close()


def create_email_verification_token(user_id):
    return create_one_time_token(user_id, "email_verification_tokens", EMAIL_VERIFICATION_TOKEN_MINUTES)


def find_valid_email_verification_token(token):
    token_hash = secure_token_hash(token)
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT evt.id, evt.user_id, u.email, u.name, u.first_name, u.email_verified_at
        FROM email_verification_tokens evt
        JOIN users u ON u.id = evt.user_id
        WHERE evt.token_hash = %s
          AND evt.used_at IS NULL
          AND evt.expires_at > NOW()
        LIMIT 1
    """, (token_hash,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return dict(row) if row else None


def mark_email_verification_token_used(token_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE email_verification_tokens
        SET used_at = NOW()
        WHERE id = %s
    """, (token_id,))
    conn.commit()
    cur.close()
    conn.close()


def mark_user_email_verified(user_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE users
        SET email_verified_at = COALESCE(email_verified_at, NOW())
        WHERE id = %s
    """, (user_id,))
    conn.commit()
    cur.close()
    conn.close()


def send_verification_email_for_user(user):
    if not user or user.get("email_verified_at"):
        return {"status": "skipped", "reason": "already_verified"}

    token = create_email_verification_token(user["id"])
    verify_url = frontend_page_url("verify-email.html", f"token={token}")
    template = email_verification_email(dict(user), verify_url)

    if not email_configured():
        print("[email] skipped email verification: Resend is not configured")
        return {"status": "skipped", "reason": "not_configured"}

    try:
        result = send_email(
            to=user["email"],
            subject=template["subject"],
            html_body=template["html_body"],
            text_body=template.get("text_body"),
        )
        return {"status": result.status, "message_id": result.message_id}
    except Exception as exc:
        print(f"[email] verification failed for user {user['id']}:", exc)
        return {"status": "failed", "error": str(exc)}


@app.route('/api/profile', methods=['PUT'])
@login_required
def update_profile():
    data = request.get_json(silent=True) or {}

    first_name = (data.get("first_name") or "").strip()
    last_name  = (data.get("last_name") or "").strip()
    email      = (data.get("email") or "").strip().lower()
    phone      = (data.get("phone") or "").strip()

    if not first_name and not last_name:
        return jsonify({"error": "Please enter your first or last name"}), 400

    if len(first_name) > 80 or len(last_name) > 80:
        return jsonify({"error": "Names must be 80 characters or fewer"}), 400

    if not email or not EMAIL_RE.match(email):
        return jsonify({"error": "Please enter a valid email address"}), 400

    if phone and not PHONE_RE.match(phone):
        return jsonify({"error": "Please enter a valid phone number"}), 400

    full_name = (first_name + " " + last_name).strip()

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT id FROM users WHERE email = %s AND id <> %s", (email, current_user_id()))
    if cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({"error": "That email is already in use"}), 409

    cur.execute("""
        UPDATE users
        SET first_name = %s,
            last_name  = %s,
            name       = %s,
            email      = %s,
            phone      = NULLIF(%s, '')
        WHERE id = %s
        RETURNING id, email, name, first_name, last_name, phone, preferred_currency, preferred_language,
                  subscription_status, trial_started_at, trial_ends_at,
                  stripe_customer_id, stripe_subscription_id, subscription_cancel_at_period_end,
                  subscription_current_period_end, subscription_canceled_at, created_at, email_verified_at, profile_image_url,
                  onboarding_completed_at, onboarding_goal
    """, (first_name, last_name, full_name, email, phone, current_user_id()))
    user = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({
        "message": "Profile updated",
        "user": public_user_payload(user)
    }), 200


@app.route('/api/preferences', methods=['PUT'])
@login_required
def update_preferences():
    data = request.get_json(silent=True) or {}

    updates = {}

    if "preferred_currency" in data:
        currency = (data.get("preferred_currency") or "").strip().upper()
        if currency and not CURRENCY_RE.match(currency):
            return jsonify({"error": "Please pick a valid currency"}), 400
        updates["preferred_currency"] = currency or None

    if "preferred_language" in data:
        language = (data.get("preferred_language") or "").strip().lower()
        if language and language not in SUPPORTED_LANGUAGES:
            return jsonify({"error": "Please pick a supported language"}), 400
        updates["preferred_language"] = language or None

    if not updates:
        return jsonify({"error": "No preferences to update"}), 400

    set_clause = ", ".join(f"{col} = %s" for col in updates.keys())
    values = list(updates.values()) + [current_user_id()]

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(f"""
        UPDATE users
        SET {set_clause}
        WHERE id = %s
        RETURNING id, email, name, first_name, last_name, phone, preferred_currency, preferred_language,
                  subscription_status, trial_started_at, trial_ends_at,
                  stripe_customer_id, stripe_subscription_id, subscription_cancel_at_period_end,
                  subscription_current_period_end, subscription_canceled_at, created_at, email_verified_at, profile_image_url
    """, values)
    user = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({
        "message": "Preferences saved",
        "user": public_user_payload(user)
    }), 200


# Valid goals from the first onboarding screen.
ONBOARDING_GOALS = {"stop_overspending", "save_for_goal", "see_where_money_goes"}


@app.route('/api/onboarding/complete', methods=['POST'])
@login_required
def complete_onboarding():
    """Save the answers from the 4-screen onboarding modal and mark the user
    as onboarded. Idempotent — repeated calls just overwrite the same row."""
    data = request.get_json(silent=True) or {}

    goal = (data.get("goal") or "").strip().lower()
    if goal and goal not in ONBOARDING_GOALS:
        return jsonify({"error": "Invalid goal"}), 400

    currency = (data.get("currency") or "").strip().upper()
    if currency and not CURRENCY_RE.match(currency):
        return jsonify({"error": "Please pick a valid currency"}), 400

    language = (data.get("language") or "").strip().lower()
    if language and language not in SUPPORTED_LANGUAGES:
        return jsonify({"error": "Please pick a supported language"}), 400

    account_nickname = (data.get("account_nickname") or "").strip()[:100]

    starting_balance_raw = data.get("starting_balance")
    starting_balance = None
    if starting_balance_raw not in (None, "", 0):
        try:
            starting_balance = float(starting_balance_raw)
            if starting_balance < 0 or starting_balance > 10_000_000:
                return jsonify({"error": "Starting balance out of range"}), 400
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid starting balance"}), 400

    user_id = current_user_id()
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Mark onboarding complete + save goal + sync preferences in one update.
    cur.execute("""
        UPDATE users
        SET onboarding_completed_at = COALESCE(onboarding_completed_at, NOW()),
            onboarding_goal = COALESCE(NULLIF(%s, ''), onboarding_goal),
            preferred_currency = COALESCE(NULLIF(%s, ''), preferred_currency),
            preferred_language = COALESCE(NULLIF(%s, ''), preferred_language)
        WHERE id = %s
        RETURNING id, email, name, first_name, last_name, phone, preferred_currency, preferred_language,
                  subscription_status, trial_started_at, trial_ends_at,
                  stripe_customer_id, stripe_subscription_id, subscription_cancel_at_period_end,
                  subscription_current_period_end, subscription_canceled_at, created_at, email_verified_at, profile_image_url,
                  onboarding_completed_at, onboarding_goal
    """, (goal, currency, language, user_id))
    user = cur.fetchone()

    # If they gave us a starting balance, seed an "Opening Balance" transaction
    # so the dashboard balance reflects reality from day one.
    if starting_balance is not None and starting_balance > 0:
        account_label = account_nickname or "Cash"
        cur.execute("""
            INSERT INTO transactions (user_id, name, amount, category, account, date, source)
            VALUES (%s, %s, %s, %s, %s, CURRENT_DATE, 'onboarding')
        """, (user_id, "Opening Balance", starting_balance, "Income", account_label))

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({
        "message": "Onboarding complete",
        "user": public_user_payload(user)
    }), 200


@app.route('/api/profile/avatar', methods=['POST'])
@login_required
def upload_profile_avatar():
    file = request.files.get("avatar") or request.files.get("file")

    if not file or not file.filename:
        return jsonify({"error": "Profile picture is required"}), 400

    original_filename = secure_filename(file.filename)
    extension = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else ""

    if extension not in PROFILE_IMAGE_ALLOWED_EXTENSIONS:
        return jsonify({"error": "Please upload a PNG, JPG, WEBP, or GIF image"}), 400

    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)

    if file_size > PROFILE_IMAGE_MAX_BYTES:
        max_mb = max(1, round(PROFILE_IMAGE_MAX_BYTES / (1024 * 1024)))
        return jsonify({"error": f"Profile picture must be {max_mb}MB or smaller"}), 400

    if file.mimetype and not file.mimetype.startswith("image/"):
        return jsonify({"error": "Please upload an image file"}), 400

    PROFILE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stored_filename = f"user-{current_user_id()}-{uuid.uuid4().hex}.{extension}"
    file.save(PROFILE_UPLOAD_DIR / stored_filename)
    profile_image_url = f"/uploads/profile-pictures/{stored_filename}"

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        UPDATE users
        SET profile_image_url = %s
        WHERE id = %s
        RETURNING id, email, name, first_name, last_name, phone, preferred_currency, preferred_language,
                  subscription_status, trial_started_at, trial_ends_at,
                  stripe_customer_id, stripe_subscription_id, subscription_cancel_at_period_end,
                  subscription_current_period_end, subscription_canceled_at, created_at, email_verified_at, profile_image_url
    """, (profile_image_url, current_user_id()))
    user = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({
        "message": "Profile picture updated",
        "user": public_user_payload(user)
    }), 200

# ══════════════════════════════════════
#  TRANSACTIONS
# ══════════════════════════════════════

@app.route('/api/transactions', methods=['GET'])
@login_required
def get_transactions():
    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT *
        FROM transactions
        WHERE user_id = %s
        ORDER BY date DESC
    """, (current_user_id(),))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(rows)

@app.route('/api/transactions', methods=['POST'])
@login_required
def add_transaction():
    data, error = validate_transaction_payload(request.json)
    if error:
        return jsonify({"error": error}), 400

    conn = get_connection()
    cur  = conn.cursor()
    cur.execute("""
        INSERT INTO transactions (user_id, name, amount, category, account, date, source)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (
        current_user_id(),
        data["name"],
        data["amount"],
        data["category"],
        data["account"],
        data["date"],
        data["source"]
    ))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"message": "Transaction added!"}), 201

@app.route('/api/transactions/<int:tx_id>', methods=['DELETE'])
@login_required
def delete_transaction(tx_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("DELETE FROM transactions WHERE id = %s AND user_id = %s", (tx_id, current_user_id()))
    deleted_count = cur.rowcount

    conn.commit()
    cur.close()
    conn.close()

    if deleted_count == 0:
        return jsonify({"error": "Transaction not found"}), 404

    return jsonify({"message": "Transaction deleted successfully"}), 200

@app.route('/api/transactions/<int:tx_id>', methods=['PUT'])
@login_required
def update_transaction(tx_id):
    data, error = validate_transaction_payload(request.json)
    if error:
        return jsonify({"error": error}), 400

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        UPDATE transactions
        SET name = %s,
            amount = %s,
            category = %s,
            account = %s,
            date = %s,
            source = %s
        WHERE id = %s AND user_id = %s
    """, (
        data["name"],
        data["amount"],
        data["category"],
        data["account"],
        data["date"],
        data["source"],
        tx_id,
        current_user_id()
    ))

    updated_count = cur.rowcount
    conn.commit()
    cur.close()
    conn.close()

    if updated_count == 0:
        return jsonify({"error": "Transaction not found"}), 404

    return jsonify({"message": "Transaction updated!"})

@app.route('/api/transactions', methods=['DELETE'])
@login_required
def delete_all_transactions():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("DELETE FROM transactions WHERE user_id = %s", (current_user_id(),))
    deleted_count = cur.rowcount

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({
        "message": "All transactions deleted successfully",
        "deleted_count": deleted_count
    }), 200

# ══════════════════════════════════════
#  RECEIPT SCAN (Claude vision)
# ══════════════════════════════════════

RECEIPT_MAX_BYTES = env_int("RECEIPT_MAX_BYTES", 8 * 1024 * 1024)
RECEIPT_ALLOWED_MIME = {
    "image/jpeg": "image/jpeg",
    "image/jpg":  "image/jpeg",
    "image/png":  "image/png",
    "image/webp": "image/webp",
    "image/heic": "image/heic",
    "image/heif": "image/heic",
}
RECEIPT_SCAN_CATEGORIES = [
    "Income",
    "Groceries",
    "Entertainment",
    "Transport",
    "Utilities",
    "Housing",
    "Dining",
    "Health",
    "Shopping",
    "Other",
]

RECEIPT_SCAN_PROMPT = """Extract from this receipt: merchant name, total amount, currency code, date (ISO),
and best-guess category from this list: [Income, Groceries, Entertainment, Transport,
Utilities, Housing, Dining, Health, Shopping, Other]. Return JSON only."""

RECEIPT_SCAN_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["merchant", "amount", "currency", "date", "suggested_category"],
    "properties": {
        "merchant": {"type": "string"},
        "amount": {"type": "number"},
        "currency": {"type": "string"},
        "date": {"type": "string"},
        "suggested_category": {
            "type": "string",
            "enum": RECEIPT_SCAN_CATEGORIES,
        },
    },
}

RECEIPT_EXTRACT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["is_receipt", "merchant", "amount", "currency", "date", "category", "confidence"],
    "properties": {
        "is_receipt": {"type": "boolean"},
        "merchant":   {"type": "string"},
        "amount":     {"type": "number"},
        "currency":   {"type": "string"},
        "date":       {"type": "string"},
        "category":   {"type": "string"},
        "type":       {"type": "string", "enum": ["expense", "income"]},
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["name", "price"],
                "properties": {
                    "name":  {"type": "string"},
                    "price": {"type": "number"}
                }
            }
        },
        "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
        "notes":      {"type": "string"}
    }
}


def _resolve_receipt_mime(file_storage):
    declared = (getattr(file_storage, "mimetype", "") or "").lower()
    if declared in RECEIPT_ALLOWED_MIME:
        return RECEIPT_ALLOWED_MIME[declared]
    filename = (getattr(file_storage, "filename", "") or "").lower()
    if filename.endswith((".jpg", ".jpeg")): return "image/jpeg"
    if filename.endswith(".png"):            return "image/png"
    if filename.endswith(".webp"):           return "image/webp"
    if filename.endswith((".heic", ".heif")): return "image/heic"
    return None


def _read_receipt_upload():
    file_storage = request.files.get("image") or request.files.get("receipt") or request.files.get("file")
    if not file_storage or not file_storage.filename:
        return None, None, jsonify({"error": "No image attached"}), 400

    media_type = _resolve_receipt_mime(file_storage)
    if not media_type:
        return None, None, jsonify({"error": "Unsupported image type. Use JPG, PNG, WEBP, or HEIC."}), 415

    image_bytes = file_storage.read()
    if not image_bytes:
        return None, None, jsonify({"error": "The uploaded file is empty"}), 400
    if len(image_bytes) > RECEIPT_MAX_BYTES:
        return None, None, jsonify({"error": f"Image is too large (max {RECEIPT_MAX_BYTES // (1024 * 1024)} MB)"}), 413

    return image_bytes, media_type, None, None


def validate_receipt_scan_output(parsed):
    if not isinstance(parsed, dict):
        return None, "Claude did not return a JSON object"

    merchant = str(parsed.get("merchant") or "").strip() or "Unknown"

    try:
        amount = Decimal(str(parsed.get("amount")))
    except (InvalidOperation, TypeError):
        return None, "Receipt scan did not include a valid amount"

    if amount <= 0:
        return None, "Receipt scan did not include a valid amount"

    currency = str(parsed.get("currency") or "").strip().upper()
    if not CURRENCY_RE.match(currency):
        return None, "Receipt scan did not include a valid currency code"

    receipt_date = str(parsed.get("date") or "").strip()
    try:
        datetime.strptime(receipt_date, "%Y-%m-%d")
    except (TypeError, ValueError):
        return None, "Receipt scan did not include a valid ISO date"

    suggested_category = str(parsed.get("suggested_category") or "").strip()
    if suggested_category not in RECEIPT_SCAN_CATEGORIES:
        suggested_category = "Other"

    return {
        "merchant": merchant,
        "amount": float(amount),
        "currency": currency,
        "date": receipt_date,
        "suggested_category": suggested_category,
    }, None


def call_receipt_scan_ai(user_id, image_bytes, media_type):
    if anthropic_client is None:
        raise RuntimeError("Receipt scanning requires ANTHROPIC_API_KEY to be set")

    encoded = base64.standard_b64encode(image_bytes).decode("ascii")
    response = create_claude_message(
        user_id=user_id,
        system_text="You extract receipt data and return only JSON that matches the requested schema.",
        prompt_text=RECEIPT_SCAN_PROMPT,
        max_tokens=700,
        json_schema=RECEIPT_SCAN_SCHEMA,
        extra_content=[{
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": encoded,
            },
        }],
    )
    text = extract_claude_text(response)
    return parse_claude_json_text(text)


def _extract_json_object(text):
    """Pull the first JSON object out of a model response (handles
    ```json fences and surrounding prose)."""
    if not text:
        raise ValueError("Empty response from receipt parser")
    cleaned = text.strip()
    # Strip code fences if Claude wrapped the JSON in ```json ... ```
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```\s*$", "", cleaned)
    # Find the first {...} block.
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("Receipt parser response did not contain JSON")
    return json.loads(cleaned[start:end + 1])


def call_receipt_vision_ai(user_id, image_bytes, media_type, category_hints, lang="en"):
    """Send a receipt image to Claude vision and return parsed JSON.
    Asks Claude to return JSON in the response text (no output_config) so it
    works with proxies that don't support response-format constraints."""
    if anthropic_client is None:
        raise RuntimeError("Receipt scanning requires ANTHROPIC_API_KEY to be set")

    encoded = base64.standard_b64encode(image_bytes).decode("ascii")
    category_list = ", ".join(category_hints) if category_hints else "Groceries, Dining, Transport, Utilities, Housing, Health, Shopping, Entertainment, Income, Other"

    lang_note = {
        "en": "Respond with field values in English (merchant names as printed).",
        "fr": "Le champ category doit utiliser un nom de catégorie ci-dessus. Garde le nom du marchand tel qu'imprimé.",
        "es": "El campo category debe usar uno de los nombres de categoría arriba. Mantén el nombre del comercio tal como aparece.",
    }.get(lang, "")

    instructions = f"""You are FinTrack's receipt parser. Extract structured data from this receipt image.

Return ONLY a single JSON object with this exact shape — no prose, no markdown, no code fences:

{{
  "is_receipt": <true|false>,
  "merchant": "<seller name as printed, no Inc./LLC suffixes>",
  "amount": <number, the GRAND TOTAL paid, positive, no currency symbol>,
  "currency": "<3-letter ISO code, e.g. USD, CAD, EUR, MAD, CNY, GBP>",
  "date": "<YYYY-MM-DD, purchase date; today's date {date.today().isoformat()} if not legible>",
  "category": "<one of: {category_list}>",
  "type": "<expense|income, income only if it's clearly a refund or deposit>",
  "confidence": "<high|medium|low>",
  "notes": "<short caveat, optional, e.g. 'tip not included'>",
  "items": [ {{"name": "<line item>", "price": <number>}} ]
}}

Rules:
- "is_receipt" is true ONLY for a real purchase receipt or proof of purchase. Set false for bank statements, invoices, screenshots of apps, or random photos.
- "amount" must be the grand total AFTER taxes/tips, never a subtotal.
- "items" is optional and capped at 12 entries — omit it if line items are illegible.
- "confidence": "high" if everything is clearly legible, "medium" if some fields were inferred, "low" if much was guessed.

{lang_note}

If is_receipt is false, still fill the other fields with safe defaults (merchant="Unknown", amount=0, date=today, category="Other") and set confidence="low".

Reply with the JSON object and nothing else.
"""

    response = create_claude_message(
        user_id=user_id,
        system_text="You are a precise receipt OCR and categorizer. You never invent data. Reply with one JSON object and nothing else.",
        prompt_text=instructions,
        max_tokens=1500,
        extra_content=[{
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": encoded,
            },
        }],
    )
    text = extract_claude_text(response)
    return _extract_json_object(text)


@app.route('/api/receipt/scan', methods=['POST'])
@login_required
@require_active_subscription
def scan_receipt_structured():
    if anthropic_client is None:
        return jsonify({"error": "Receipt scanning is not configured on this server."}), 503

    image_bytes, media_type, error_response, status_code = _read_receipt_upload()
    if error_response is not None:
        return error_response, status_code

    try:
        parsed = call_receipt_scan_ai(current_user_id(), image_bytes, media_type)
    except anthropic.APIError as exc:
        print("Receipt scan Claude error:", repr(exc))
        return jsonify({"error": "The receipt scanner is temporarily unavailable. Try again in a moment."}), 502
    except Exception as exc:
        print("Receipt scan error:", repr(exc))
        return jsonify({"error": "Could not read this receipt. Try a clearer photo or enter the details manually."}), 422

    validated, validation_error = validate_receipt_scan_output(parsed)
    if validation_error:
        return jsonify({"error": validation_error}), 422

    return jsonify(validated), 200


@app.route('/api/transactions/scan-receipt', methods=['POST'])
@login_required
def scan_receipt():
    if anthropic_client is None:
        return jsonify({"error": "Receipt scanning is not configured on this server."}), 503

    image_bytes, media_type, error_response, status_code = _read_receipt_upload()
    if error_response is not None:
        return error_response, status_code

    user_id = current_user_id()
    lang = _normalize_summary_lang(request.form.get("lang") or "en")

    category_hints = []
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT name
            FROM categories
            ORDER BY LOWER(name)
            LIMIT 60
        """)
        category_hints = [row["name"] for row in cur.fetchall() if row.get("name")]
        cur.close()
        conn.close()
    except Exception as exc:
        print("Receipt scan category lookup error:", exc)
        # Non-fatal — Claude will fall back to its built-in default list.

    try:
        parsed = call_receipt_vision_ai(user_id, image_bytes, media_type, category_hints, lang=lang)
    except anthropic.APIError as exc:
        print("Receipt scan Claude error:", repr(exc))
        return jsonify({"error": "The receipt scanner is temporarily unavailable. Try again in a moment."}), 502
    except Exception as exc:
        print("Receipt scan error:", repr(exc))
        return jsonify({"error": "Could not read this receipt. Try a clearer photo or enter the details manually."}), 422

    if not parsed.get("is_receipt"):
        return jsonify({
            "extracted": parsed,
            "warning": "This doesn't look like a receipt. You can still edit the fields manually below."
        }), 200

    return jsonify({"extracted": parsed}), 200


# ══════════════════════════════════════
#  CSV UPLOAD (WeChat + Alipay)
# ══════════════════════════════════════

@app.route('/api/upload-csv', methods=['POST'])
@login_required
def upload_csv():
    max_file_size = 5 * 1024 * 1024

    if 'file' not in request.files:
        return jsonify({"error": "CSV file is required"}), 400

    file = request.files['file']
    filename = file.filename or ''

    if not filename:
        return jsonify({"error": "CSV file is required"}), 400

    if not filename.lower().endswith('.csv'):
        return jsonify({"error": "Only CSV files are supported"}), 400

    if request.content_length and request.content_length > max_file_size:
        return jsonify({"error": "CSV file must be 5MB or smaller"}), 400

    raw_content = file.read()

    if not raw_content:
        return jsonify({"error": "CSV file is empty"}), 400

    if len(raw_content) > max_file_size:
        return jsonify({"error": "CSV file must be 5MB or smaller"}), 400

    try:
        content = raw_content.decode('utf-8-sig')  # handles BOM characters
        df = pd.read_csv(io.StringIO(content))
    except UnicodeDecodeError:
        return jsonify({"error": "CSV file must be UTF-8 encoded"}), 400
    except Exception:
        return jsonify({"error": "CSV file could not be read"}), 400

    # Detect source
    cols   = [c.strip() for c in df.columns.tolist()]
    source = detect_source(cols)

    # Clean based on source
    if source == 'wechat':
        transactions = parse_wechat(df)
    elif source == 'alipay':
        transactions = parse_alipay(df)
    else:
        transactions = parse_generic(df)

    if not transactions:
        return jsonify({"error": "No valid transactions found in CSV"}), 400

    # Save to database
    conn = get_connection()
    cur  = conn.cursor()
    count = 0
    for tx in transactions:
        cur.execute("""
            INSERT INTO transactions (user_id, name, amount, category, account, date, source)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (current_user_id(), tx['name'], tx['amount'], tx['category'],
              tx['account'], tx['date'], source))
        count += 1

    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"message": f"Imported {count} transactions!", "source": source})

def detect_source(cols):
    """Detect if CSV is from WeChat, Alipay, or generic bank"""
    col_str = ' '.join(cols).lower()
    if '交易时间' in col_str and '交易对方' in col_str:
        if '支付方式' in col_str:
            return 'wechat'
        return 'alipay'
    return 'generic'

def parse_wechat(df):
    """Parse WeChat Pay CSV"""
    df.columns = [c.strip() for c in df.columns]
    transactions = []
    for _, row in df.iterrows():
        try:
            amount_str = str(row.get('金额(元)', row.get('金额', '0')))
            amount_str = amount_str.replace('¥', '').replace(',', '').strip()
            amount     = float(amount_str)
            direction  = str(row.get('收/支', '')).strip()
            if direction == '支出':
                amount = -abs(amount)
            else:
                amount = abs(amount)

            transactions.append({
                'name':     str(row.get('交易对方', 'Unknown')).strip(),
                'amount':   amount,
                'category': str(row.get('商品', 'Other')).strip(),
                'account':  'WeChat Pay',
                'date':     pd.to_datetime(str(row.get('交易时间', ''))).date(),
            })
        except Exception as e:
            print(f"Skipping row: {e}")
            continue
    return transactions

def parse_alipay(df):
    """Parse Alipay CSV"""
    df.columns = [c.strip() for c in df.columns]
    transactions = []
    for _, row in df.iterrows():
        try:
            amount_str = str(row.get('金额(元)', row.get('金额', '0')))
            amount_str = amount_str.replace('¥', '').replace(',', '').strip()
            amount     = float(amount_str)
            direction  = str(row.get('收/支', '')).strip()
            if direction == '支出':
                amount = -abs(amount)
            else:
                amount = abs(amount)

            transactions.append({
                'name':     str(row.get('交易对方', 'Unknown')).strip(),
                'amount':   amount,
                'category': str(row.get('交易分类', 'Other')).strip(),
                'account':  'Alipay',
                'date':     pd.to_datetime(str(row.get('交易时间', ''))).date(),
            })
        except Exception as e:
            print(f"Skipping row: {e}")
            continue
    return transactions

def parse_generic(df):
    """Parse any generic bank CSV"""
    df.columns = [c.strip().lower() for c in df.columns]
    transactions = []
    for _, row in df.iterrows():
        try:
            # Try common column names
            name   = str(row.get('description', row.get('name', row.get('merchant', 'Unknown')))).strip()
            amount = float(str(row.get('amount', 0)).replace(',', '').replace('$', ''))
            date   = pd.to_datetime(str(row.get('date', row.get('transaction date', '')))).date()

            transactions.append({
                'name':     name,
                'amount':   amount,
                'category': 'Other',
                'account':  'Bank Import',
                'date':     date,
            })
        except Exception as e:
            print(f"Skipping row: {e}")
            continue
    return transactions

# ══════════════════════════════════════
#  BUDGETS
# ══════════════════════════════════════

@app.route('/api/budgets', methods=['GET'])
@login_required
def get_budgets():
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        WITH budget_periods AS (
            SELECT
                b.*,
                COALESCE(
                    b.start_date,
                    CASE
                        WHEN b.year IS NOT NULL AND b.month IS NOT NULL
                        THEN make_date(b.year, b.month, 1)
                        ELSE CURRENT_DATE
                    END
                ) AS period_start,
                COALESCE(b.days, 30) AS period_days
            FROM budgets b
            WHERE b.user_id = %s
        )
        SELECT
            bp.*,
            bp.match_keyword,
            (bp.period_start + ((bp.period_days - 1) * INTERVAL '1 day'))::date AS end_date,
            COALESCE(SUM(ABS(t.amount)), 0) AS spent,
            COUNT(t.id) AS transaction_count
        FROM budget_periods bp
        LEFT JOIN transactions t
            ON (
                LOWER(t.category) = LOWER(bp.category)
                OR (
                    bp.match_keyword IS NOT NULL
                    AND TRIM(bp.match_keyword) <> ''
                    AND LOWER(t.name) LIKE '%%' || LOWER(TRIM(bp.match_keyword)) || '%%'
                )
            )
            AND t.amount < 0
            AND t.user_id = %s
            AND t.date >= bp.period_start
            AND t.date <= (bp.period_start + ((bp.period_days - 1) * INTERVAL '1 day'))::date
        GROUP BY
            bp.id,
            bp.user_id,
            bp.category,
            bp.amount,
            bp.month,
            bp.year,
            bp.start_date,
            bp.days,
            bp.match_keyword,
            bp.created_at,
            bp.period_start,
            bp.period_days
        ORDER BY bp.created_at DESC
    """, (current_user_id(), current_user_id()))

    rows = cur.fetchall()
    cur.close()
    conn.close()

    today = date.today()
    enriched = []
    for row in rows:
        item = dict(row)
        period_start = item.get("period_start")
        period_days = int(item.get("period_days") or 30)
        spent = float(item.get("spent") or 0)
        amount = float(item.get("amount") or 0)

        if isinstance(period_start, datetime):
            period_start_date = period_start.date()
        else:
            period_start_date = period_start

        # Project end-of-period total + overrun date when we have at least a
        # 7-day window of data to extrapolate from.
        item["projection"] = None
        if period_start_date and amount > 0 and period_days > 0:
            days_elapsed = (today - period_start_date).days + 1
            days_elapsed_clamped = max(0, min(days_elapsed, period_days))
            if days_elapsed_clamped >= 7 and spent > 0:
                rate_per_day = spent / days_elapsed_clamped
                projected_total = round(rate_per_day * period_days, 2)
                projected_overrun_date = None
                if rate_per_day > 0 and amount > 0:
                    days_until_overrun = (amount - spent) / rate_per_day
                    if days_until_overrun >= 0:
                        overrun_day = today + timedelta(days=int(round(days_until_overrun)))
                    else:
                        overrun_day = today
                    end_of_period = period_start_date + timedelta(days=period_days - 1)
                    if overrun_day <= end_of_period:
                        projected_overrun_date = overrun_day.isoformat()
                item["projection"] = {
                    "rate_per_day": round(rate_per_day, 2),
                    "projected_total": projected_total,
                    "projected_overrun_date": projected_overrun_date,
                    "projected_overrun_amount": round(max(projected_total - amount, 0), 2),
                    "days_elapsed": days_elapsed_clamped,
                    "period_days": period_days,
                }

        enriched.append(item)

    return jsonify(enriched)


@app.route('/api/budgets/suggestions', methods=['GET'])
@login_required
def get_budget_suggestions():
    """Return per-category suggested monthly budgets based on the user's last
    90 days of expenses. Guardrails:
      - At least 30 days of data with at least one transaction.
      - Skip categories the user already has an active budget for.
      - Skip Income / refund categories.
      - Cap to top 8 categories by total spend.
    """
    user_id = current_user_id()
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT
            MIN(date) AS earliest_date,
            MAX(date) AS latest_date,
            COUNT(*) AS tx_count
        FROM transactions
        WHERE user_id = %s
          AND amount < 0
          AND date >= CURRENT_DATE - INTERVAL '90 days'
    """, (user_id,))
    coverage = cur.fetchone() or {}
    earliest = coverage.get("earliest_date")
    latest = coverage.get("latest_date")
    tx_count = int(coverage.get("tx_count") or 0)

    if earliest and latest:
        days_of_data = (latest - earliest).days + 1
    else:
        days_of_data = 0

    if tx_count == 0 or days_of_data < 30:
        cur.close()
        conn.close()
        return jsonify({
            "suggestions": [],
            "currency": get_user_currency(user_id),
            "days_of_data": days_of_data,
            "ready": False,
            "reason": "not_enough_data",
        }), 200

    cur.execute("""
        SELECT LOWER(TRIM(category)) AS norm_category
        FROM budgets
        WHERE user_id = %s
          AND COALESCE(NULLIF(TRIM(category), ''), '') <> ''
    """, (user_id,))
    existing_norm = {row["norm_category"] for row in cur.fetchall()}

    cur.execute("""
        SELECT
            COALESCE(NULLIF(TRIM(category), ''), 'Other') AS category,
            COUNT(*) AS tx_count,
            COALESCE(SUM(ABS(amount)), 0) AS spent_total
        FROM transactions
        WHERE user_id = %s
          AND amount < 0
          AND date >= CURRENT_DATE - INTERVAL '90 days'
          AND LOWER(COALESCE(NULLIF(TRIM(category), ''), 'other'))
              NOT IN ('income', 'revenu', 'revenus', 'salaire', 'transfer', 'transfert', 'virement', 'refund', 'remboursement', 'other', 'autre', 'autres', 'divers')
        GROUP BY 1
        ORDER BY spent_total DESC
    """, (user_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    months_of_data = max(days_of_data / 30.0, 1.0)
    suggestions = []
    for row in rows:
        category = row["category"]
        if category.strip().lower() in existing_norm:
            continue
        if int(row["tx_count"] or 0) < 2:
            # One-off — too noisy to suggest a recurring budget.
            continue
        spent = float(row["spent_total"] or 0)
        if spent <= 0:
            continue
        monthly_avg = spent / months_of_data
        # Round to a friendly number (nearest 10 below $200, nearest 50 above).
        if monthly_avg < 200:
            suggested = max(round(monthly_avg / 10) * 10, 10)
        else:
            suggested = max(round(monthly_avg / 50) * 50, 50)
        suggestions.append({
            "category": category,
            "monthly_average": round(monthly_avg, 2),
            "suggested_amount": float(suggested),
            "tx_count": int(row["tx_count"] or 0),
            "spent_total_90d": round(spent, 2),
        })
        if len(suggestions) >= 8:
            break

    return jsonify({
        "suggestions": suggestions,
        "currency": get_user_currency(user_id),
        "days_of_data": days_of_data,
        "ready": True,
    }), 200


@app.route('/api/budgets', methods=['POST'])
@login_required
def add_budget():
    data = request.json

    category = (data.get('category') or '').strip()
    amount = data.get('amount')
    start_date = data.get('start_date')
    days = data.get('days', 30)

    if not category or amount is None or not start_date:
        return jsonify({"error": "Category, amount, and start date are required"}), 400

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 1. Exact duplicate rule:
    # Same category + same start date + same duration = update existing budget instead of creating duplicate.
    cur.execute("""
        SELECT id
        FROM budgets
        WHERE LOWER(category) = LOWER(%s)
          AND start_date = %s
          AND days = %s
          AND user_id = %s
        ORDER BY id ASC
    """, (category, start_date, days, current_user_id()))

    existing_rows = cur.fetchall()

    if existing_rows:
        keep_id = existing_rows[0]["id"]
        duplicate_ids = [row["id"] for row in existing_rows[1:]]

        cur.execute("""
            UPDATE budgets
            SET amount = %s,
                month = %s,
                year = %s,
                match_keyword = %s
            WHERE id = %s
              AND user_id = %s
        """, (
            amount,
            None,
            None,
            (data.get('match_keyword') or '').strip(),
            keep_id,
            current_user_id()
        ))

        if duplicate_ids:
            cur.execute("""
            DELETE FROM budgets
            WHERE id = ANY(%s)
              AND user_id = %s
        """, (duplicate_ids, current_user_id()))

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "message": "Existing budget updated and duplicates merged",
            "mode": "updated",
            "merged_duplicates": len(duplicate_ids)
        }), 200

    # 2. No exact duplicate = create a new flexible budget.
    cur.execute("""
        INSERT INTO budgets (user_id, category, amount, start_date, days, month, year, match_keyword)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        current_user_id(),
        category,
        amount,
        start_date,
        days,
        None,
        None,
        (data.get('match_keyword') or '').strip()
    ))

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({
        "message": "Budget created",
        "mode": "created"
    }), 201

@app.route('/api/budgets/<int:budget_id>', methods=['PUT'])
@login_required
def update_budget(budget_id):
    data = request.json

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        UPDATE budgets
        SET category = %s,
            amount = %s,
            start_date = %s,
            days = %s,
            month = %s,
            year = %s,
            match_keyword = %s
        WHERE id = %s AND user_id = %s
    """, (
        data['category'],
        data['amount'],
        data.get('start_date'),
        data.get('days', 30),
        None,
        None,
        (data.get('match_keyword') or '').strip(),
        budget_id,
        current_user_id()
    ))

    if cur.rowcount == 0:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({"error": "Budget not found"}), 404

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "Budget updated!"}), 200

@app.route('/api/budgets/<int:budget_id>', methods=['DELETE'])
@login_required
def delete_budget(budget_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("DELETE FROM budgets WHERE id = %s AND user_id = %s", (budget_id, current_user_id()))
    deleted_count = cur.rowcount

    conn.commit()
    cur.close()
    conn.close()

    if deleted_count == 0:
        return jsonify({"error": "Budget not found"}), 404

    return jsonify({"message": "Budget deleted successfully"}), 200

# ══════════════════════════════════════
#  GOALS
# ══════════════════════════════════════

@app.route('/api/goals', methods=['GET'])
@login_required
def get_goals():
    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT
            g.*,
            COALESCE(g.saved_amount, 0) AS manual_saved_amount,
            COALESCE(linked.linked_savings_amount, 0) AS linked_savings_amount,
            COALESCE(g.saved_amount, 0) + COALESCE(linked.linked_savings_amount, 0) AS effective_saved_amount,
            manual_activity.last_manual_date,
            linked_activity.last_linked_date,
            NULLIF(
                GREATEST(
                    COALESCE(manual_activity.last_manual_date, DATE '1900-01-01'),
                    COALESCE(linked_activity.last_linked_date, DATE '1900-01-01')
                ),
                DATE '1900-01-01'
            ) AS last_goal_activity_date
        FROM goals g
        LEFT JOIN LATERAL (
            SELECT COALESCE(SUM(ABS(t.amount)), 0) AS linked_savings_amount
            FROM transactions t
            WHERE g.auto_link_savings = TRUE
              AND t.user_id = g.user_id
              AND (
                  LOWER(COALESCE(t.category, '')) = LOWER(COALESCE(g.category, ''))
                  OR LOWER(COALESCE(t.name, '')) LIKE '%%' || LOWER(COALESCE(g.name, '')) || '%%'
              )
              AND (
                  LOWER(COALESCE(t.account, '')) LIKE '%%sav%%'
                  OR LOWER(COALESCE(t.name, '')) LIKE '%%saving%%'
                  OR LOWER(COALESCE(t.category, '')) LIKE '%%saving%%'
              )
        ) linked ON TRUE
        LEFT JOIN LATERAL (
            SELECT MAX(gc.date) AS last_manual_date
            FROM goal_contributions gc
            WHERE gc.goal_id = g.id
        ) manual_activity ON TRUE
        LEFT JOIN LATERAL (
            SELECT MAX(t.date) AS last_linked_date
            FROM transactions t
            WHERE g.auto_link_savings = TRUE
              AND t.user_id = g.user_id
              AND (
                  LOWER(COALESCE(t.category, '')) = LOWER(COALESCE(g.category, ''))
                  OR LOWER(COALESCE(t.name, '')) LIKE '%%' || LOWER(COALESCE(g.name, '')) || '%%'
              )
              AND (
                  LOWER(COALESCE(t.account, '')) LIKE '%%sav%%'
                  OR LOWER(COALESCE(t.name, '')) LIKE '%%saving%%'
                  OR LOWER(COALESCE(t.category, '')) LIKE '%%saving%%'
              )
        ) linked_activity ON TRUE
        WHERE g.user_id = %s
        ORDER BY g.deadline NULLS LAST
    """, (current_user_id(),))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(rows)

@app.route('/api/goals', methods=['POST'])
@login_required
def add_goal():
    data = request.json or {}

    name = (data.get('name') or '').strip()
    target_amount = data.get('target_amount')
    saved_amount = data.get('saved_amount', 0)
    deadline = data.get('deadline')
    icon = (data.get('icon') or '🎯').strip()
    category = (data.get('category') or 'Savings').strip()
    auto_link_savings = request_bool(data.get('auto_link_savings'), True)

    if not name or target_amount is None:
        return jsonify({"error": "Name and target amount are required"}), 400

    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        INSERT INTO goals (user_id, name, target_amount, saved_amount, deadline, icon, category, auto_link_savings)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
    """, (current_user_id(), name, target_amount, saved_amount, deadline, icon, category, auto_link_savings))
    goal = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"message": "Goal created!", "goal": goal}), 201


@app.route('/api/goals/<int:goal_id>', methods=['PUT'])
@login_required
def update_goal(goal_id):
    data = request.json or {}

    name = (data.get('name') or '').strip()
    target_amount = data.get('target_amount')
    saved_amount = data.get('saved_amount', 0)
    deadline = data.get('deadline')
    icon = (data.get('icon') or '🎯').strip()
    category = (data.get('category') or 'Savings').strip()
    auto_link_savings = request_bool(data.get('auto_link_savings'), True)

    if not name or target_amount is None:
        return jsonify({"error": "Name and target amount are required"}), 400

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        UPDATE goals
        SET name = %s,
            target_amount = %s,
            saved_amount = %s,
            deadline = %s,
            icon = %s,
            category = %s,
            auto_link_savings = %s
        WHERE id = %s
          AND user_id = %s
        RETURNING *
    """, (
        name,
        target_amount,
        saved_amount,
        deadline,
        icon,
        category,
        auto_link_savings,
        goal_id,
        current_user_id()
    ))

    updated = cur.fetchone()

    if not updated:
        cur.close()
        conn.close()
        return jsonify({"error": "Goal not found"}), 404

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "Goal updated", "goal": updated}), 200


@app.route('/api/goals/<int:goal_id>/contributions', methods=['GET'])
@login_required
def get_goal_contributions(goal_id):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT *
        FROM goals
        WHERE id = %s
          AND user_id = %s
    """, (goal_id, current_user_id()))
    goal = cur.fetchone()

    if not goal:
        cur.close()
        conn.close()
        return jsonify({"error": "Goal not found"}), 404

    cur.execute("""
        SELECT
            id,
            amount,
            note,
            date,
            source,
            created_at,
            'manual' AS history_type,
            NULL AS transaction_name,
            NULL AS transaction_category,
            NULL AS transaction_account
        FROM goal_contributions
        WHERE goal_id = %s
    """, (goal_id,))
    manual_rows = cur.fetchall()

    transaction_rows = []
    if goal.get("auto_link_savings"):
        cur.execute("""
            SELECT
                t.id,
                ABS(t.amount) AS amount,
                t.name AS note,
                t.date,
                'transaction' AS source,
                t.created_at,
                'transaction' AS history_type,
                t.name AS transaction_name,
                t.category AS transaction_category,
                t.account AS transaction_account
            FROM transactions t
            WHERE (
                LOWER(COALESCE(t.category, '')) = LOWER(COALESCE(%s, ''))
                OR LOWER(COALESCE(t.name, '')) LIKE '%%' || LOWER(COALESCE(%s, '')) || '%%'
            )
              AND (
                LOWER(COALESCE(t.account, '')) LIKE '%%sav%%'
                OR LOWER(COALESCE(t.name, '')) LIKE '%%saving%%'
                OR LOWER(COALESCE(t.category, '')) LIKE '%%saving%%'
              )
              AND t.user_id = %s
            ORDER BY t.date DESC, t.created_at DESC
            LIMIT 20
        """, (goal.get("category") or "", goal.get("name") or "", current_user_id()))
        transaction_rows = cur.fetchall()

    rows = manual_rows + transaction_rows
    rows.sort(
        key=lambda item: (
            str(item.get("date") or ""),
            str(item.get("created_at") or "")
        ),
        reverse=True
    )

    cur.close()
    conn.close()

    return jsonify(rows[:30]), 200


@app.route('/api/goals/<int:goal_id>/suggestions', methods=['GET'])
@login_required
def get_goal_suggestions(goal_id):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT
            g.*,
            COALESCE(g.saved_amount, 0) AS manual_saved_amount,
            COALESCE(linked.linked_savings_amount, 0) AS linked_savings_amount,
            COALESCE(g.saved_amount, 0) + COALESCE(linked.linked_savings_amount, 0) AS effective_saved_amount
        FROM goals g
        LEFT JOIN LATERAL (
            SELECT COALESCE(SUM(ABS(t.amount)), 0) AS linked_savings_amount
            FROM transactions t
            WHERE g.auto_link_savings = TRUE
              AND t.user_id = g.user_id
              AND (
                  LOWER(COALESCE(t.category, '')) = LOWER(COALESCE(g.category, ''))
                  OR LOWER(COALESCE(t.name, '')) LIKE '%%' || LOWER(COALESCE(g.name, '')) || '%%'
              )
              AND (
                  LOWER(COALESCE(t.account, '')) LIKE '%%sav%%'
                  OR LOWER(COALESCE(t.name, '')) LIKE '%%saving%%'
                  OR LOWER(COALESCE(t.category, '')) LIKE '%%saving%%'
              )
        ) linked ON TRUE
        WHERE g.id = %s
          AND g.user_id = %s
    """, (goal_id, current_user_id()))
    goal = cur.fetchone()

    if not goal:
        cur.close()
        conn.close()
        return jsonify({"error": "Goal not found"}), 404

    cur.execute("""
        SELECT name, amount, category, account, date
        FROM transactions
        WHERE user_id = %s
        ORDER BY date DESC
        LIMIT 80
    """, (current_user_id(),))
    transactions = cur.fetchall()

    cur.execute("""
        SELECT category, ABS(SUM(amount)) AS spent
        FROM transactions
        WHERE amount < 0
          AND user_id = %s
          AND date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY category
        ORDER BY spent DESC
        LIMIT 6
    """, (current_user_id(),))
    top_spending = cur.fetchall()

    cur.execute("""
        SELECT name, amount, category, account, date
        FROM transactions
        WHERE amount < 0
          AND user_id = %s
          AND date >= CURRENT_DATE - INTERVAL '30 days'
          AND (
              LOWER(COALESCE(category, '')) = LOWER(%s)
              OR LOWER(COALESCE(name, '')) LIKE '%%' || LOWER(%s) || '%%'
          )
        ORDER BY ABS(amount) DESC
        LIMIT 8
    """, (current_user_id(), goal["category"] or "", goal["name"] or ""))
    goal_related_spending = cur.fetchall()

    cur.execute("""
        SELECT name, amount, category, account, date
        FROM transactions
        WHERE user_id = %s
          AND date >= CURRENT_DATE - INTERVAL '45 days'
          AND (
              LOWER(COALESCE(account, '')) LIKE '%%sav%%'
              OR LOWER(COALESCE(name, '')) LIKE '%%saving%%'
              OR LOWER(COALESCE(category, '')) LIKE '%%saving%%'
          )
        ORDER BY date DESC
        LIMIT 12
    """, (current_user_id(),))
    savings_activity = cur.fetchall()

    cur.execute("""
        SELECT category, amount, start_date, days
        FROM budgets
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT 25
    """, (current_user_id(),))
    budgets = cur.fetchall()

    cur.execute("""
        SELECT name, amount, category, account, frequency, next_date
        FROM recurring_payments
        WHERE is_active = TRUE
          AND user_id = %s
        ORDER BY next_date ASC
        LIMIT 25
    """, (current_user_id(),))
    recurring = cur.fetchall()

    cur.close()
    conn.close()

    prompt = f"""
You are Money Coach inside FinTrack.

Give premium, practical savings advice for this one goal only.
Use only the user's FinTrack data below. Do not invent numbers.
Keep it simple and decision-focused.

Goal:
{goal}

Recent transactions:
{transactions}

Top spending in the last 30 days:
{top_spending}

Goal-related spending in the last 30 days:
{goal_related_spending}

Savings activity in the last 45 days:
{savings_activity}

Budgets:
{budgets}

Recurring payments:
{recurring}

Return valid JSON only in this exact shape:
{{
  "cards": [
    {{
      "title": "short title",
      "action": "specific action in one sentence",
      "why": "why this matters in one sentence"
    }}
  ]
}}

Create exactly 3 cards:
1. A this-week action that helps this goal.
2. A spending tradeoff using real user data if available.
3. An automation or savings opportunity.

Do not mention raw negative numbers like -3000; say spent 3000 instead.
Avoid obvious advice like "stay on pace", "keep auto savings on", or "review spending" unless you name a specific action.
If the data is thin, make the card a useful data-gap action, such as what transaction/category the user should add next.
"""

    suggestions_schema = {
        "type": "object",
        "properties": {
            "cards": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "action": {"type": "string"},
                        "why": {"type": "string"},
                    },
                    "required": ["title", "action", "why"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["cards"],
        "additionalProperties": False,
    }

    try:
        parsed = call_money_coach_ai(
            system_text="You are a concise personal finance coach. Give practical, specific, supportive advice.",
            user_text=prompt,
            max_tokens=1500,
            json_schema=suggestions_schema,
            user_id=current_user_id(),
        )

        cards = parsed.get("cards", []) if isinstance(parsed, dict) else []

        clean_cards = []
        for card in cards:
            if not isinstance(card, dict):
                continue

            title = str(card.get("title") or "").strip()
            action = str(card.get("action") or "").strip()
            why = str(card.get("why") or "").strip()

            if title and action:
                clean_cards.append({
                    "title": title,
                    "action": action,
                    "why": why
                })

        return jsonify({"suggestions": clean_cards[:3]}), 200

    except Exception as e:
        print("Goal suggestions error:", e)
        return jsonify({"error": "Goal suggestions could not load right now"}), 500


@app.route('/api/goals/<int:goal_id>/contribute', methods=['POST'])
@login_required
def contribute_to_goal(goal_id):
    data = request.json or {}

    try:
        amount = Decimal(str(data.get('amount', '0')))
    except (InvalidOperation, TypeError):
        return jsonify({"error": "Contribution amount must be a number"}), 400

    note = (data.get('note') or '').strip()
    date = data.get('date')

    if amount <= 0:
        return jsonify({"error": "Contribution amount must be greater than 0"}), 400

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT id FROM goals WHERE id = %s AND user_id = %s", (goal_id, current_user_id()))
    goal = cur.fetchone()

    if not goal:
        cur.close()
        conn.close()
        return jsonify({"error": "Goal not found"}), 404

    cur.execute("""
        INSERT INTO goal_contributions (goal_id, amount, note, date, source)
        VALUES (%s, %s, %s, COALESCE(%s::date, CURRENT_DATE), %s)
    """, (
        goal_id,
        amount,
        note,
        date or None,
        'manual'
    ))

    cur.execute("""
        UPDATE goals
        SET saved_amount = COALESCE(saved_amount, 0) + %s
        WHERE id = %s
          AND user_id = %s
        RETURNING *
    """, (amount, goal_id, current_user_id()))

    updated = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "Contribution added", "goal": updated}), 200


@app.route('/api/goals/<int:goal_id>', methods=['DELETE'])
@login_required
def delete_goal(goal_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("DELETE FROM goals WHERE id = %s AND user_id = %s", (goal_id, current_user_id()))

    if cur.rowcount == 0:
        cur.close()
        conn.close()
        return jsonify({"error": "Goal not found"}), 404

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "Goal deleted"}), 200

# ══════════════════════════════════════
#  CATEGORIES
# ══════════════════════════════════════

@app.route('/api/categories', methods=['GET'])
def get_categories():
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT id, name, icon, created_at
        FROM categories
        ORDER BY LOWER(name) ASC
    """)
    rows = cur.fetchall()

    cur.close()
    conn.close()
    return jsonify(rows)

@app.route('/api/categories', methods=['POST'])
def add_category():
    data = request.json

    name = (data.get('name') or '').strip()
    icon = (data.get('icon') or '🏷️').strip()

    if not name:
        return jsonify({"error": "Category name is required"}), 400

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT id, name, icon, created_at
        FROM categories
        WHERE LOWER(name) = LOWER(%s)
        LIMIT 1
    """, (name,))
    existing = cur.fetchone()

    if existing:
        cur.close()
        conn.close()
        return jsonify(existing), 200

    cur.execute("""
        INSERT INTO categories (name, icon)
        VALUES (%s, %s)
        RETURNING id, name, icon, created_at
    """, (name, icon))

    new_category = cur.fetchone()
    conn.commit()

    cur.close()
    conn.close()

    return jsonify(new_category), 201

# ══════════════════════════════════════
#  DASHBOARD SUMMARY
# ══════════════════════════════════════

@app.route('/api/dashboard', methods=['GET'])
@login_required
def get_dashboard():
    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    # Total balance
    cur.execute("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = %s", (current_user_id(),))
    total_balance = float(cur.fetchone()['total'])

    # Monthly income
    cur.execute("""
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE amount > 0
        AND user_id = %s
        AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE)
    """, (current_user_id(),))
    monthly_income = float(cur.fetchone()['total'])

    # Monthly expenses
    cur.execute("""
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE amount < 0
        AND user_id = %s
        AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE)
    """, (current_user_id(),))
    monthly_expenses = float(cur.fetchone()['total'])

    # Recent transactions
    cur.execute("""
        SELECT *
        FROM transactions
        WHERE user_id = %s
        ORDER BY date DESC
        LIMIT 6
    """, (current_user_id(),))
    recent = cur.fetchall()

    cur.close()
    conn.close()

    return jsonify({
        "total_balance":     total_balance,
        "monthly_income":    monthly_income,
        "monthly_expenses":  abs(monthly_expenses),
        "total_savings":     total_balance * 0.25,  # placeholder
        "recent_transactions": recent
    })

# ══════════════════════════════════════
#  INVESTMENTS — Real stock prices
# ══════════════════════════════════════

@app.route('/api/investments', methods=['GET'])
@login_required
def get_investments():
    if not SHOW_DEMO_DATA:
        return jsonify({
            'holdings': [],
            'total_value': 0,
            'total_invested': 0,
            'total_return': 0,
            'total_return_pct': 0,
            'today_change': 0,
        })

    import yfinance as yf

    # Your portfolio holdings
    holdings = [
        { 'symbol': 'AAPL', 'name': 'Apple Inc.',      'shares': 25, 'avg_cost': 165.00, 'type': 'STOCK' },
        { 'symbol': 'VOO',  'name': 'S&P 500 ETF',     'shares': 8,  'avg_cost': 420.00, 'type': 'ETF'   },
        { 'symbol': 'MSFT', 'name': 'Microsoft Corp.', 'shares': 6,  'avg_cost': 380.00, 'type': 'STOCK' },
    ]

    results        = []
    total_value    = 0
    total_invested = 0
    total_change   = 0

    for h in holdings:
        try:
            ticker     = yf.Ticker(h['symbol'])
            info       = ticker.fast_info
            price      = round(float(info.last_price), 2)
            prev_close = round(float(info.previous_close), 2)

            total_val      = round(price * h['shares'], 2)
            invested       = round(h['avg_cost'] * h['shares'], 2)
            gain           = round(total_val - invested, 2)
            gain_pct       = round((gain / invested) * 100, 2)
            day_change_pct = round(((price - prev_close) / prev_close) * 100, 2)

            total_value    += total_val
            total_invested += invested
            total_change   += round((price - prev_close) * h['shares'], 2)

            results.append({
                'symbol':        h['symbol'],
                'name':          h['name'],
                'type':          h['type'],
                'shares':        h['shares'],
                'avg_cost':      h['avg_cost'],
                'price':         price,
                'total_value':   total_val,
                'gain':          gain,
                'gain_pct':      gain_pct,
                'day_change_pct': day_change_pct,
            })

        except Exception as e:
            print(f"Error fetching {h['symbol']}: {e}")
            results.append({
                'symbol':        h['symbol'],
                'name':          h['name'],
                'type':          h['type'],
                'shares':        h['shares'],
                'avg_cost':      h['avg_cost'],
                'price':         0,
                'total_value':   0,
                'gain':          0,
                'gain_pct':      0,
                'day_change_pct': 0,
            })

    total_return     = round(total_value - total_invested, 2)
    total_return_pct = round((total_return / total_invested) * 100, 2) if total_invested else 0

    return jsonify({
        'holdings':          results,
        'total_value':       round(total_value, 2),
        'total_invested':    round(total_invested, 2),
        'total_return':      total_return,
        'total_return_pct':  total_return_pct,
        'today_change':      round(total_change, 2),
    })


@app.route('/api/investment-news', methods=['GET'])
@login_required
def get_investment_news():
    from datetime import datetime, timedelta, timezone

    if not SHOW_DEMO_DATA:
        return jsonify({
            'news': [],
            'earnings': [],
            'alerts': []
        })

    holdings = [
        { 'symbol': 'AAPL', 'name': 'Apple Inc.',      'type': 'STOCK' },
        { 'symbol': 'VOO',  'name': 'S&P 500 ETF',     'type': 'ETF'   },
        { 'symbol': 'MSFT', 'name': 'Microsoft Corp.', 'type': 'STOCK' },
    ]
    holding_by_symbol = {h['symbol']: h for h in holdings}
    now = datetime.now(timezone.utc)

    fallback_news = {
        'AAPL': {
            'title': 'Apple supplier checks point to steady iPhone demand',
            'source': 'Market Watchlist',
            'summary': 'Relevant because Apple is your largest individual stock holding.',
            'impact': 'medium',
            'sentiment': 'Bullish',
            'published_at': (now - timedelta(hours=2)).isoformat()
        },
        'MSFT': {
            'title': 'Microsoft cloud growth remains a key focus before earnings',
            'source': 'Earnings Desk',
            'summary': 'Cloud revenue and AI spending are the main items to watch for this position.',
            'impact': 'high',
            'sentiment': 'Neutral',
            'published_at': (now - timedelta(hours=4)).isoformat()
        },
        'VOO': {
            'title': 'S&P 500 investors watch inflation data and rate expectations',
            'source': 'Index Brief',
            'summary': 'This matters because VOO tracks broad market sentiment.',
            'impact': 'medium',
            'sentiment': 'Neutral',
            'published_at': (now - timedelta(days=1)).isoformat()
        }
    }

    fallback_earnings = {
        'AAPL': '2026-05-02',
        'MSFT': '2026-04-30',
        'VOO': None
    }

    news_items = []

    def infer_symbol_from_title(title, fallback_symbol):
        lowered = (title or '').lower()

        if 'microsoft' in lowered or 'msft' in lowered:
            return 'MSFT'
        if 'apple' in lowered or 'iphone' in lowered or 'aapl' in lowered:
            return 'AAPL'
        if 's&p' in lowered or 's&p 500' in lowered or 'index' in lowered or 'market' in lowered:
            return 'VOO'

        return fallback_symbol

    def infer_sentiment(title):
        lowered = (title or '').lower()
        bullish_words = ['breakout', 'growth', 'rally', 'beat', 'upside', 'strong', 'record']
        bearish_words = ['lawsuit', 'miss', 'cut', 'slump', 'drop', 'warning', 'risk', 'probe']

        if any(word in lowered for word in bullish_words):
            return 'Bullish'
        if any(word in lowered for word in bearish_words):
            return 'Bearish'

        return 'Neutral'

    try:
        import yfinance as yf

        for holding in holdings:
            symbol = holding['symbol']
            ticker = yf.Ticker(symbol)
            raw_news = getattr(ticker, 'news', []) or []

            if raw_news:
                item = raw_news[0]
                content = item.get('content') if isinstance(item.get('content'), dict) else {}
                title = item.get('title') or content.get('title') or fallback_news[symbol]['title']
                matched_symbol = infer_symbol_from_title(title, symbol)
                matched_holding = holding_by_symbol.get(matched_symbol, holding)
                fallback_item = fallback_news.get(matched_symbol, fallback_news[symbol])
                publisher = item.get('publisher') or content.get('provider', {}).get('displayName') or fallback_news[symbol]['source']
                link = item.get('link') or content.get('canonicalUrl', {}).get('url') or ''
                publish_time = item.get('providerPublishTime') or item.get('pubDate') or fallback_item['published_at']

                news_items.append({
                    'symbol': matched_symbol,
                    'name': matched_holding['name'],
                    'title': title,
                    'source': publisher,
                    'summary': fallback_item['summary'],
                    'impact': fallback_item['impact'],
                    'sentiment': infer_sentiment(title),
                    'published_at': publish_time,
                    'url': link
                })
            else:
                raise ValueError(f'No news returned for {symbol}')
    except Exception as e:
        print('Investment news fallback:', e)
        news_items = [
            {
                'symbol': symbol,
                'name': next((h['name'] for h in holdings if h['symbol'] == symbol), symbol),
                'title': item['title'],
                'source': item['source'],
                'summary': item['summary'],
                'impact': item['impact'],
                'sentiment': item['sentiment'],
                'published_at': item['published_at'],
                'url': ''
            }
            for symbol, item in fallback_news.items()
        ]

    earnings = [
        {
            'symbol': holding['symbol'],
            'name': holding['name'],
            'date': fallback_earnings.get(holding['symbol']),
            'event': 'Earnings' if holding['type'] == 'STOCK' else 'ETF distribution review'
        }
        for holding in holdings
    ]

    alerts = [
        {
            'symbol': item['symbol'],
            'title': item['title'],
            'message': f"{item['symbol']} has a high-impact news item to review.",
            'impact': item['impact']
        }
        for item in news_items
        if item.get('impact') == 'high'
    ]

    return jsonify({
        'news': news_items,
        'earnings': earnings,
        'alerts': alerts
    })

# ══════════════════════════════════════
#  MONEY COACH — Claude AI
# ══════════════════════════════════════

def get_money_coach_investment_context(cur, user_id):
    cur.execute("""
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'investments'
        ) AS table_exists,
        EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'investments'
              AND column_name = 'user_id'
        ) AS has_user_id
    """)
    investment_meta = cur.fetchone() or {}

    if not investment_meta.get("table_exists"):
        return {
            "status": "not_connected",
            "message": "No real investments table is connected yet. Do not treat investment demo UI as reliable user portfolio data.",
            "holdings": []
        }

    if not investment_meta.get("has_user_id"):
        return {
            "status": "needs_user_scoping",
            "message": "Investments table exists but is not user-scoped yet, so Money Coach should not use it for personal advice.",
            "holdings": []
        }

    cur.execute("""
        SELECT to_jsonb(i) AS holding
        FROM investments i
        WHERE i.user_id = %s
        LIMIT 25
    """, (user_id,))
    holdings = [row["holding"] for row in cur.fetchall()]

    return {
        "status": "connected" if holdings else "empty",
        "message": "Using saved investment holdings." if holdings else "No saved investment holdings yet.",
        "holdings": serialize_for_prompt(holdings)
    }


def build_money_coach_data_used(context):
    investments = context.get("investments") or {}

    return {
        "transactions": len(context.get("recent_transactions") or []),
        "budgets": len(context.get("budget_status") or []),
        "goals": len(context.get("goals") or []),
        "recurring_payments": len(context.get("recurring_payments") or []),
        "investments": {
            "status": investments.get("status", "not_connected"),
            "count": len(investments.get("holdings") or [])
        }
    }


def save_money_coach_history(user_id, question, answer, mode, data_used):
    conn = None
    cur = None

    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO money_coach_history (user_id, question, answer, mode, data_used)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        """, (
            user_id,
            question,
            answer,
            mode,
            Json(data_used or {})
        ))
        history = cur.fetchone()
        conn.commit()
        return history[0] if history else None
    except Exception as e:
        print("Money Coach history save error:", e)
        if conn:
            conn.rollback()
        return None
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def save_money_coach_insight(cur, user_id, insight_key, title, body, source="money_coach"):
    cur.execute("""
        SELECT status
        FROM money_coach_insights
        WHERE user_id = %s
          AND insight_key = %s
        LIMIT 1
    """, (user_id, insight_key))
    existing = cur.fetchone()

    if existing and existing.get("status") == "resolved":
        return

    cur.execute("""
        INSERT INTO money_coach_insights (user_id, insight_key, title, body, source, status)
        VALUES (%s, %s, %s, %s, %s, 'open')
        ON CONFLICT (user_id, insight_key)
        DO UPDATE SET
            title = EXCLUDED.title,
            body = EXCLUDED.body,
            source = EXCLUDED.source,
            updated_at = CURRENT_TIMESTAMP
    """, (user_id, insight_key, title, body, source))


def sync_money_coach_insights(user_id, context):
    conn = None
    cur = None

    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        ccy = get_user_currency(user_id)

        monthly = context.get("current_month_summary") or {}
        net = money_coach_number(monthly.get("net"))
        if net < 0:
            save_money_coach_insight(
                cur,
                user_id,
                "negative_cash_flow",
                "Cash flow is negative this month",
                f"You have spent about {ccy} {abs(net):,.2f} more than your income this month."
            )

        over_budgets = [
            item for item in context.get("budget_status") or []
            if money_coach_number(item.get("over_budget_amount")) > 0
        ]
        if over_budgets:
            top = max(over_budgets, key=lambda item: money_coach_number(item.get("over_budget_amount")))
            category = str(top.get("category") or "A budget").strip()
            over = money_coach_number(top.get("over_budget_amount"))
            save_money_coach_insight(
                cur,
                user_id,
                f"budget_over_{category.lower()}",
                f"{category} is pressuring your budget",
                f"{category} is over by about {ccy} {over:,.2f}. Keep this visible until you adjust spending or the budget resets."
            )

        recurring = [
            item for item in context.get("recurring_payments") or []
            if money_coach_number(item.get("amount")) < 0 and item.get("next_date")
        ]
        for item in recurring[:3]:
            due = money_coach_parse_date(item.get("next_date"))
            if not due:
                continue

            days_left = (due - date.today()).days
            if 0 <= days_left <= 7:
                name = str(item.get("name") or "Upcoming payment").strip()
                amount = abs(money_coach_number(item.get("amount")))
                save_money_coach_insight(
                    cur,
                    user_id,
                    f"recurring_due_{name.lower()}",
                    f"{name} is due soon",
                    f"{name} is due in {days_left} day{'s' if days_left != 1 else ''} for about {ccy} {amount:,.2f}."
                )

        goals = context.get("goals") or []
        for goal in goals[:3]:
            target = money_coach_number(goal.get("target_amount"))
            saved = money_coach_number(goal.get("effective_saved_amount"))
            remaining = max(target - saved, 0)
            deadline = money_coach_parse_date(goal.get("deadline"))

            if not deadline or remaining <= 0:
                continue

            days_left = (deadline - date.today()).days
            if 0 <= days_left <= 14:
                name = str(goal.get("name") or "Goal").strip()
                save_money_coach_insight(
                    cur,
                    user_id,
                    f"goal_deadline_{name.lower()}",
                    f"{name} needs attention",
                    f"{name} still needs about {ccy} {remaining:,.2f} with {days_left} day{'s' if days_left != 1 else ''} left."
                )

        conn.commit()
    except Exception as e:
        print("Money Coach insight sync error:", e)
        if conn:
            conn.rollback()
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


DAILY_INSIGHT_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["insights"],
    "properties": {
        "insights": {
            "type": "array",
            "minItems": 3,
            "maxItems": 3,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["insight_type", "title", "body", "action_label", "tone"],
                "properties": {
                    "insight_type": {
                        "type": "string",
                        "enum": ["spending_alert", "subscription_detector", "goal_pacing"]
                    },
                    "title": {"type": "string"},
                    "body": {"type": "string"},
                    "action_label": {"type": "string"},
                    "tone": {
                        "type": "string",
                        "enum": ["alert", "warn", "positive", "info"]
                    }
                }
            }
        }
    }
}


def build_daily_insights_data(user_id, lookback_days=90):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT id, name, amount, category, account, date, source
        FROM transactions
        WHERE user_id = %s
          AND date >= CURRENT_DATE - (%s || ' days')::interval
        ORDER BY date DESC, id DESC
    """, (user_id, str(lookback_days)))
    transactions = rows_for_prompt(cur.fetchall())

    cur.execute("""
        SELECT id, category, amount, month, year, start_date, days, match_keyword
        FROM budgets
        WHERE user_id = %s
        ORDER BY year DESC NULLS LAST, month DESC NULLS LAST, created_at DESC
    """, (user_id,))
    budgets = rows_for_prompt(cur.fetchall())

    cur.execute("""
        SELECT id, name, target_amount, saved_amount, deadline, category, created_at
        FROM goals
        WHERE user_id = %s
        ORDER BY deadline NULLS LAST, created_at DESC
    """, (user_id,))
    goals = rows_for_prompt(cur.fetchall())

    cur.execute("""
        SELECT gc.goal_id, g.name AS goal_name, gc.amount, gc.note, gc.date, gc.source
        FROM goal_contributions gc
        JOIN goals g ON g.id = gc.goal_id
        WHERE g.user_id = %s
          AND gc.date >= CURRENT_DATE - (%s || ' days')::interval
        ORDER BY gc.date DESC, gc.id DESC
    """, (user_id, str(lookback_days)))
    goal_contributions = rows_for_prompt(cur.fetchall())

    cur.execute("""
        SELECT id, name, amount, category, account, frequency, next_date, last_paid_at, last_paid_for_date, is_active
        FROM recurring_payments
        WHERE user_id = %s
        ORDER BY is_active DESC, next_date ASC NULLS LAST
    """, (user_id,))
    recurring = rows_for_prompt(cur.fetchall())

    cur.close()
    conn.close()

    return {
        "today": date.today().isoformat(),
        "lookback_days": lookback_days,
        "currency": get_user_currency(user_id),
        "transactions": transactions,
        "budgets": budgets,
        "goals": goals,
        "goal_contributions": goal_contributions,
        "recurring_payments": recurring,
    }


def build_daily_insights_cache_text(user_id):
    data = build_daily_insights_data(user_id, lookback_days=90)
    return (
        "User full last-90-days FinTrack data (cached; use as the sole source of truth):\n"
        f"{json.dumps(data, default=str, ensure_ascii=False)}"
    )


def normalize_daily_insight(item):
    if not isinstance(item, dict):
        return None

    insight_type = str(item.get("insight_type") or item.get("type") or "").strip().lower()
    if insight_type not in {"spending_alert", "subscription_detector", "goal_pacing"}:
        return None

    title = str(item.get("title") or "").strip()[:80]
    body = str(item.get("body") or "").strip()[:240]
    action_label = str(item.get("action_label") or "").strip()[:40]
    tone = str(item.get("tone") or item.get("severity") or "info").strip().lower()
    if tone == "high":
        tone = "alert"
    elif tone == "medium":
        tone = "warn"
    elif tone == "low":
        tone = "info"
    if tone not in {"alert", "warn", "positive", "info"}:
        tone = "info"

    if not title or not body:
        return None

    if not action_label:
        action_label = "Review"

    return {
        "insight_type": insight_type,
        "title": title,
        "body": body,
        "action_label": action_label,
        "tone": tone,
    }


def fallback_daily_insight(insight_type):
    defaults = {
        "spending_alert": {
            "title": "Spending alert",
            "body": "No unusual spending spike stood out in your last 90 days.",
            "action_label": "Review spending",
            "tone": "info",
        },
        "subscription_detector": {
            "title": "Subscription detector",
            "body": "No inactive subscription pattern stood out in your recent transactions.",
            "action_label": "Review subscriptions",
            "tone": "info",
        },
        "goal_pacing": {
            "title": "Goal pacing",
            "body": "Add a savings goal to get pacing guidance against your target date.",
            "action_label": "Review goals",
            "tone": "info",
        },
    }
    item = defaults[insight_type].copy()
    item["insight_type"] = insight_type
    return item


def generate_daily_insights_with_claude(user_id):
    cache_text = build_daily_insights_cache_text(user_id)
    prompt = """Generate exactly 3 daily FinTrack insight cards from the cached last-90-days data above.

Return one card for each type:
1. spending_alert — compare this week's spending in a category against the user's normal recent average.
2. subscription_detector — detect repeat charges that may be unused or worth reviewing.
3. goal_pacing — compare current savings pace against a goal deadline or target.

Rules:
- Use only the cached user data. Never invent merchants, amounts, services, categories, goals, dates, or activity.
- Keep the user's currency code/symbol context. Do not convert currencies.
- If a type has no strong signal, still return that type with a truthful low-drama info card.
- Each body must be specific, plain-language, and <= 180 characters.
- Make the card actionable. Examples of body style:
  "You spent $94 on dining this week. Your average is $40."
  "We noticed Netflix charged you for 3 months but no recent activity. Cancel?"
  "At current rate, you'll hit your vacation goal in 8 months (target: 6 months). Save $200 more this month to stay on pace."
- Return JSON only."""

    response = create_claude_message(
        user_id=user_id,
        system_text="You generate concise, grounded personal-finance insight cards as structured JSON. You never invent data.",
        prompt_text=prompt,
        max_tokens=2200,
        json_schema=DAILY_INSIGHT_SCHEMA,
        cache_text=cache_text,
    )
    text = extract_claude_text(response)
    try:
        parsed = parse_claude_json_text(text)
    except json.JSONDecodeError as exc:
        print("Daily insights JSON parse error:", exc)
        parsed = {}
    raw_items = (parsed.get("insights") or parsed.get("cards")) if isinstance(parsed, dict) else []

    by_type = {}
    for item in raw_items or []:
        normalized = normalize_daily_insight(item)
        if normalized:
            by_type[normalized["insight_type"]] = normalized

    ordered_types = ["spending_alert", "subscription_detector", "goal_pacing"]
    return [by_type.get(kind) or fallback_daily_insight(kind) for kind in ordered_types]


def save_daily_insights(user_id, items, insight_date=None):
    insight_date = insight_date or date.today()
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    saved = []
    for item in items:
        normalized = normalize_daily_insight(item)
        if not normalized:
            continue

        cur.execute("""
            INSERT INTO insights
                (user_id, insight_date, insight_type, title, body, action_label, tone, status, payload)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'open', %s)
            ON CONFLICT (user_id, insight_date, insight_type)
            DO UPDATE SET
                title = EXCLUDED.title,
                body = EXCLUDED.body,
                action_label = EXCLUDED.action_label,
                tone = EXCLUDED.tone,
                status = 'open',
                payload = EXCLUDED.payload,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id, insight_date, insight_type, title, body, action_label, tone, status, created_at, updated_at
        """, (
            user_id,
            insight_date,
            normalized["insight_type"],
            normalized["title"],
            normalized["body"],
            normalized["action_label"],
            normalized["tone"],
            Json({"provider": "claude", "lookback_days": 90}),
        ))
        saved.append(dict(cur.fetchone()))

    conn.commit()
    cur.close()
    conn.close()
    return rows_for_prompt(saved)


def fetch_daily_insights(user_id, insight_date=None):
    insight_date = insight_date or date.today()
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, insight_date, insight_type, title, body, action_label, tone, status, created_at, updated_at
        FROM insights
        WHERE user_id = %s
          AND insight_date = %s
          AND status = 'open'
        ORDER BY CASE insight_type
            WHEN 'spending_alert' THEN 1
            WHEN 'subscription_detector' THEN 2
            WHEN 'goal_pacing' THEN 3
            ELSE 4
        END
    """, (user_id, insight_date))
    rows = rows_for_prompt(cur.fetchall())
    cur.close()
    conn.close()
    return rows


def run_daily_insights_scan(user_id, force=False):
    existing = fetch_daily_insights(user_id)
    if existing and len(existing) >= 3 and not force:
        return existing, False

    items = generate_daily_insights_with_claude(user_id)
    saved = save_daily_insights(user_id, items)
    return saved, True


def build_proactive_daily_context(user_id):
    """Snapshot for the daily proactive scan: last 24h activity, weekly category
    trend vs the prior 4 weeks, recurring payments with last related usage, and
    goal pacing. Used only for grounding — the model must not invent anything
    outside this payload."""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT name, amount, category, account, date
        FROM transactions
        WHERE user_id = %s
          AND date >= CURRENT_DATE - INTERVAL '1 day'
        ORDER BY date DESC, id DESC
        LIMIT 50
    """, (user_id,))
    last_24h = rows_for_prompt(cur.fetchall())

    cur.execute("""
        WITH weekly AS (
            SELECT
                COALESCE(NULLIF(TRIM(category), ''), 'Uncategorized') AS category,
                date_trunc('week', date) AS week,
                COALESCE(SUM(ABS(amount)), 0) AS spent
            FROM transactions
            WHERE user_id = %s
              AND amount < 0
              AND date >= CURRENT_DATE - INTERVAL '5 weeks'
            GROUP BY 1, 2
        )
        SELECT
            category,
            COALESCE(SUM(CASE WHEN week = date_trunc('week', CURRENT_DATE) THEN spent ELSE 0 END), 0) AS this_week,
            COALESCE(AVG(spent) FILTER (WHERE week <> date_trunc('week', CURRENT_DATE)), 0) AS avg_prev_4_weeks
        FROM weekly
        GROUP BY category
        HAVING COALESCE(SUM(CASE WHEN week = date_trunc('week', CURRENT_DATE) THEN spent ELSE 0 END), 0) > 0
            OR COALESCE(AVG(spent) FILTER (WHERE week <> date_trunc('week', CURRENT_DATE)), 0) > 0
        ORDER BY this_week DESC
        LIMIT 12
    """, (user_id,))
    category_trend = rows_for_prompt(cur.fetchall())

    cur.execute("""
        SELECT
            rp.name,
            rp.amount,
            rp.category,
            rp.frequency,
            rp.next_date,
            rp.last_paid_at,
            (
                SELECT MAX(t.date)
                FROM transactions t
                WHERE t.user_id = rp.user_id
                  AND t.amount < 0
                  AND (
                      LOWER(t.name) LIKE '%%' || LOWER(rp.name) || '%%'
                      OR LOWER(COALESCE(t.category, '')) = LOWER(COALESCE(rp.category, ''))
                  )
            ) AS last_related_use
        FROM recurring_payments rp
        WHERE rp.user_id = %s
          AND rp.is_active = TRUE
        ORDER BY rp.next_date ASC NULLS LAST
        LIMIT 12
    """, (user_id,))
    recurring = rows_for_prompt(cur.fetchall())

    cur.execute("""
        SELECT
            g.id,
            g.name,
            g.target_amount,
            COALESCE(g.saved_amount, 0) AS saved_amount,
            g.deadline,
            g.created_at
        FROM goals g
        WHERE g.user_id = %s
        ORDER BY g.deadline NULLS LAST, g.created_at DESC
        LIMIT 8
    """, (user_id,))
    goals = rows_for_prompt(cur.fetchall())

    cur.close()
    conn.close()

    return {
        "today": date.today().isoformat(),
        "currency": get_user_currency(user_id),
        "last_24h_transactions": last_24h,
        "category_trend": category_trend,
        "recurring_payments": recurring,
        "goals": goals,
    }


def last_daily_scan_at(cur, user_id):
    cur.execute("""
        SELECT MAX(updated_at) AS last_at
        FROM money_coach_insights
        WHERE user_id = %s
          AND source LIKE 'daily_scan%%'
    """, (user_id,))
    row = cur.fetchone() or {}
    return row.get("last_at")


def run_proactive_daily_scan(user_id, force=False):
    """Generate up to 3 proactive insights via Claude. Idempotent within the configured cooldown unless
    force=True. Returns the persisted insight list on a real run, [] when the
    model returned nothing, and None when skipped due to cooldown or error."""
    conn = None
    cur = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        if not force:
            last_at = last_daily_scan_at(cur, user_id)
            if last_at and (datetime.utcnow() - last_at) < timedelta(hours=MONEY_COACH_DAILY_SCAN_COOLDOWN_HOURS):
                return None

        context = build_proactive_daily_context(user_id)
        today_iso = context["today"]

        prompt = f"""You are FinTrack's proactive money coach. Surface 1-3 short insight cards
based ONLY on the data below. The user will see these on their dashboard, so each card
must be specific and decision-driven.

Today: {today_iso}
Default currency: {context['currency']}

Rules:
- Use ONLY the data provided. Never invent merchants, amounts, dates, recurring services, or goals.
- Prefer concrete numbers (amount, percent, days) over vague language.
- Flag a subscription as unused ONLY if it appears in recurring_payments AND last_related_use is null or older than 60 days.
- Flag a spending spike ONLY when this_week >= 1.4 * avg_prev_4_weeks AND avg_prev_4_weeks > 0.
- Celebrate a goal ONLY if saved_amount is meaningfully on pace or ahead based on deadline and created_at.
- If nothing in the last 24h is notable AND nothing in the snapshot warrants a card, return an empty array.
- Never produce more than 3 insights. Quality over quantity.
- Each title must be <= 60 characters. Each body must be <= 180 characters. Plain language, no emojis.
- "tone" is one of: "alert" (action needed), "warn" (heads up), "positive" (good news), "info".
- "key" must be lowercase snake_case and unique per insight.

Data:
{json.dumps(context, default=str)}
"""

        try:
            parsed = call_money_coach_ai(
                system_text="You generate concise, grounded, decision-focused finance insights. You never invent data.",
                user_text=prompt,
                max_tokens=1200,
                json_schema=DAILY_INSIGHT_SCHEMA,
                user_id=user_id,
            )
        except Exception as exc:
            print("Proactive daily scan error:", exc)
            return None

        items = []
        if isinstance(parsed, dict):
            items = parsed.get("insights") or []

        persisted = []
        for item in items[:3]:
            if not isinstance(item, dict):
                continue
            raw_key = (item.get("key") or "").strip().lower()
            title = (item.get("title") or "").strip()
            body = (item.get("body") or "").strip()
            tone = (item.get("tone") or "info").strip().lower()
            if tone not in {"alert", "warn", "positive", "info"}:
                tone = "info"
            if not raw_key or not title or not body:
                continue

            insight_key = f"daily_{today_iso}_{raw_key}"
            save_money_coach_insight(
                cur, user_id, insight_key, title, body, source=f"daily_scan_{tone}"
            )
            persisted.append({
                "key": insight_key,
                "title": title,
                "body": body,
                "tone": tone,
            })

        conn.commit()
        return persisted

    except Exception as exc:
        print("Proactive daily scan error:", exc)
        if conn:
            conn.rollback()
        return None
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def money_coach_number(value):
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0


def money_coach_parse_date(value):
    if isinstance(value, date):
        return value

    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value[:10]).date()
        except ValueError:
            return None

    return None


MONEY_COACH_CATEGORY_SYNONYM_GROUPS = [
    {
        "intent": "groceries",
        "categories": [
            "groceries", "grocery", "supermarket", "market", "food shopping",
            "food market", "food"
        ],
        "aliases": [
            "groceries", "grocery", "grocories", "groceris", "supermarket",
            "food shopping", "food shop", "market run", "home food",
            "cook at home", "ingredients", "food", "courses", "epicerie",
            "épicerie", "supermarche", "supermarché", "makla", "9adiya",
            "qadiya", "بقالة", "مشتريات", "سوبرماركت", "超市", "买菜"
        ],
    },
    {
        "intent": "dining",
        "categories": [
            "dining", "restaurant", "restaurants", "food", "takeout",
            "delivery", "coffee", "cafe", "cafes", "fast food"
        ],
        "aliases": [
            "dining", "dinner", "lunch", "brunch", "restaurant",
            "restaurants", "resturant", "resturants", "eating out",
            "eat out", "takeout", "take away", "delivery", "coffee",
            "cofee", "cafe", "cafes", "fast food", "going out",
            "night out", "date night", "nightlife", "drinks", "bar", "bars",
            "manger dehors", "sortir", "resto", "cafe", "café", "kharja",
            "khrouja", "makla barra", "برا", "مطعم", "قهوة", "اكل برا",
            "الأكل خارج", "餐厅", "外卖", "咖啡", "出去吃"
        ],
    },
    {
        "intent": "entertainment",
        "categories": [
            "entertainment", "fun", "movies", "cinema", "concerts",
            "games", "subscriptions", "netflix", "spotify"
        ],
        "aliases": [
            "entertainment", "fun", "movies", "movie", "cinema",
            "concert", "concerts", "games", "gaming", "subscriptions",
            "subscription", "netflix", "spotify", "going out",
            "night out", "date night", "nightlife", "weekend plans", "events",
            "sortir", "cinema", "cinéma", "concert", "soirée", "soiree",
            "kharja", "party", "حفلة", "سينما", "خروجة", "电影", "娱乐"
        ],
    },
    {
        "intent": "transport",
        "categories": [
            "transport", "transportation", "uber", "taxi", "fuel",
            "gas", "parking", "transit", "bus", "metro", "train"
        ],
        "aliases": [
            "transport", "transportation", "uber", "taxi", "cab",
            "fuel", "gas", "parking", "bus", "metro", "train",
            "transit", "commute", "ride", "rides", "getting there",
            "going out", "work commute", "commuting", "transport en commun",
            "trajet", "taxi", "indrive", "careem", "didichuxing", "滴滴",
            "地铁", "公交", "打车", "مواصلات", "طاكسي", "تنقل"
        ],
    },
    {
        "intent": "shopping",
        "categories": [
            "shopping", "clothes", "clothing", "fashion", "mall",
            "electronics", "self care", "personal care", "beauty"
        ],
        "aliases": [
            "shopping", "shop", "clothes", "clothing", "fashion",
            "mall", "electronics", "gadgets", "new clothes", "buy stuff",
            "self care", "personal care", "beauty", "salon", "haircut",
            "skincare", "soins", "beaute", "beauté", "hammam",
            "عناية", "حلاقة", "ملابس", "تسوق", "购物", "衣服", "美容"
        ],
    },
    {
        "intent": "housing",
        "categories": [
            "housing", "rent", "apartment", "mortgage", "home"
        ],
        "aliases": [
            "housing", "rent", "apartment", "flat", "mortgage",
            "home", "lease", "landlord", "home stuff", "house stuff",
            "household", "furniture", "home repair", "repairs", "maintenance",
            "maison", "appartement", "loyer", "dar", "كراء", "بيت",
            "منزل", "家", "房租", "房子"
        ],
    },
    {
        "intent": "utilities",
        "categories": [
            "utilities", "electric", "electricity", "water", "internet",
            "phone", "wifi", "gas bill", "bills"
        ],
        "aliases": [
            "utilities", "utility", "electric", "electricity", "water",
            "internet", "wifi", "phone", "mobile", "bill", "bills",
            "gas bill", "monthly bills", "factures", "facture", "eau",
            "electricite", "électricité", "internet", "فواتير", "فاتورة",
            "كهرباء", "ماء", "واي فاي", "账单", "水电", "电话费"
        ],
    },
    {
        "intent": "travel",
        "categories": [
            "travel", "trip", "vacation", "holiday", "flight", "hotel",
            "airbnb", "tourism"
        ],
        "aliases": [
            "travel", "trip", "vacation", "holiday", "flight", "flights",
            "hotel", "airbnb", "tourism", "thailand", "weekend trip",
            "plane ticket", "tickets", "voyage", "vacances", "billet",
            "avion", "hotel", "hôtel", "safar", "سفر", "رحلة", "طيارة",
            "فندق", "旅游", "旅行", "机票", "酒店"
        ],
    },
    {
        "intent": "health",
        "categories": [
            "health", "medical", "doctor", "medicine", "pharmacy",
            "gym", "fitness"
        ],
        "aliases": [
            "health", "medical", "doctor", "medicine", "pharmacy",
            "meds", "gym", "fitness", "workout", "clinic", "self care",
            "therapy", "dentist", "sante", "santé", "medecin", "médecin",
            "pharmacie", "tabib", "طبيب", "صيدلية", "دواء", "صحة",
            "健身", "医生", "药", "健康"
        ],
    },
    {
        "intent": "kids_school",
        "categories": [
            "kids", "children", "childcare", "school", "education",
            "tuition", "daycare", "family"
        ],
        "aliases": [
            "kids", "kid", "children", "child", "baby", "school",
            "tuition", "daycare", "education", "school supplies",
            "books", "uniform", "family", "les enfants", "ecole",
            "école", "cours", "مدرسة", "تعليم", "اطفال", "الأطفال",
            "حضانة", "学校", "孩子", "学费", "书本"
        ],
    },
    {
        "intent": "household",
        "categories": [
            "household", "home stuff", "home supplies", "furniture",
            "repairs", "maintenance", "home"
        ],
        "aliases": [
            "home stuff", "house stuff", "household", "home supplies",
            "cleaning", "furniture", "decor", "repair", "repairs",
            "maintenance", "ikea", "maison", "dar", "بيت", "منزل",
            "تصليح", "اثاث", "家具", "家用品", "维修"
        ],
    },
]

MONEY_COACH_BROAD_TERMS = {
    "food", "self care", "kids", "home", "shopping", "fun",
    "sortir", "kharja", "makla", "برا", "出去吃", "购物"
}

MONEY_COACH_HIGH_CONFIDENCE_TERMS = {
    "going out", "night out", "date night", "nightlife", "commute",
    "bills", "school", "home stuff", "trip", "vacation"
}


def normalize_money_coach_text(value):
    text = str(value or "").lower()
    text = re.sub(r"[^\w]+", " ", text, flags=re.UNICODE)
    text = text.replace("_", " ")
    return re.sub(r"\s+", " ", text).strip()


def money_coach_ngram_tokens(tokens, size):
    if size <= 0 or len(tokens) < size:
        return []

    return [" ".join(tokens[index:index + size]) for index in range(len(tokens) - size + 1)]


def money_coach_phrase_match(question_norm, question_tokens, phrase):
    phrase_norm = normalize_money_coach_text(phrase)

    if not phrase_norm:
        return False

    padded_question = f" {question_norm} "
    padded_phrase = f" {phrase_norm} "

    if padded_phrase in padded_question:
        return True

    phrase_tokens = phrase_norm.split()

    if len(phrase_tokens) == 1:
        phrase_token = phrase_tokens[0]

        if len(phrase_token) < 5:
            return False

        return any(
            len(token) >= 5 and SequenceMatcher(None, token, phrase_token).ratio() >= 0.84
            for token in question_tokens
        )

    phrase_len = len(phrase_tokens)

    return any(
        SequenceMatcher(None, ngram, phrase_norm).ratio() >= 0.88
        for ngram in money_coach_ngram_tokens(question_tokens, phrase_len)
    )


def money_coach_category_group_applies(category_norm, group):
    if not category_norm:
        return False

    padded_category = f" {category_norm} "

    for category_alias in group.get("categories", []):
        alias_norm = normalize_money_coach_text(category_alias)

        if not alias_norm:
            continue

        padded_alias = f" {alias_norm} "

        if category_norm == alias_norm or padded_alias in padded_category or padded_category in padded_alias:
            return True

    return False


def money_coach_category_terms(category, match_keyword=""):
    category_norm = normalize_money_coach_text(category)
    keyword_norm = normalize_money_coach_text(match_keyword)
    terms = set()
    intents = set()

    for source in (category_norm, keyword_norm):
        if source:
            terms.add(source)
            terms.update(token for token in source.split() if len(token) >= 3)

    for group in MONEY_COACH_CATEGORY_SYNONYM_GROUPS:
        applies_to_category = money_coach_category_group_applies(category_norm, group)
        applies_to_keyword = money_coach_category_group_applies(keyword_norm, group)

        if not applies_to_category and not applies_to_keyword:
            continue

        intents.add(group["intent"])
        terms.update(normalize_money_coach_text(term) for term in group.get("categories", []))
        terms.update(normalize_money_coach_text(term) for term in group.get("aliases", []))

    return {
        "terms": {term for term in terms if term},
        "intents": intents
    }


def money_coach_matched_term_confidence(term, category, match_keyword=""):
    term_norm = normalize_money_coach_text(term)
    category_norm = normalize_money_coach_text(category)
    keyword_norm = normalize_money_coach_text(match_keyword)

    if term_norm in {category_norm, keyword_norm}:
        return 0.96

    if term_norm in MONEY_COACH_HIGH_CONFIDENCE_TERMS:
        return 0.9

    if term_norm in MONEY_COACH_BROAD_TERMS:
        return 0.72

    if len(term_norm.split()) >= 2:
        return 0.88

    return 0.8


def money_coach_transaction_terms(name):
    name_norm = normalize_money_coach_text(name)
    terms = set()

    if not name_norm:
        return terms

    terms.add(name_norm)
    tokens = [
        token
        for token in name_norm.split()
        if len(token) >= 4 and token not in {"payment", "purchase", "transaction"}
    ]
    terms.update(tokens)
    terms.update(money_coach_ngram_tokens(tokens, 2))

    return terms


def build_money_coach_transaction_category_matches(question_norm, question_tokens, transactions):
    learned = {}

    for tx in transactions or []:
        category = str(tx.get("category") or "").strip()
        name = str(tx.get("name") or "").strip()

        if not category or not name:
            continue

        matched_terms = sorted(
            term
            for term in money_coach_transaction_terms(name)
            if money_coach_phrase_match(question_norm, question_tokens, term)
        )

        if not matched_terms:
            continue

        category_norm = normalize_money_coach_text(category)
        category_terms = money_coach_category_terms(category)
        learned_item = learned.setdefault(category_norm, {
            "category": category,
            "matched_terms": set(),
            "matched_intents": set(),
            "sample_names": set(),
            "count": 0
        })
        learned_item["matched_terms"].update(matched_terms)
        learned_item["matched_intents"].update(category_terms["intents"])
        learned_item["sample_names"].add(name)
        learned_item["count"] += 1

    return learned


def money_coach_learned_match_for_budget(category, category_terms, learned_categories):
    category_norm = normalize_money_coach_text(category)
    matches = []

    for learned_norm, learned in learned_categories.items():
        learned_intents = learned.get("matched_intents") or set()
        category_intents = category_terms.get("intents") or set()

        if (
            learned_norm == category_norm
            or learned_norm in category_terms.get("terms", set())
            or bool(learned_intents.intersection(category_intents))
        ):
            matches.append(learned)

    return matches


def money_coach_confidence_label(score):
    if score >= 0.85:
        return "high"
    if score >= 0.65:
        return "medium"
    return "low"


def build_money_coach_spending_guidance(question, budget_status, transactions=None, currency=None):
    currency = currency or DEFAULT_CURRENCY
    question_norm = normalize_money_coach_text(question)
    question_tokens = question_norm.split()
    learned_categories = build_money_coach_transaction_category_matches(
        question_norm,
        question_tokens,
        transactions or []
    )

    raw_matches = []

    for budget in budget_status or []:
        category = str(budget.get("category") or "").strip()
        category_terms = money_coach_category_terms(category, budget.get("match_keyword") or "")
        matched_terms = sorted(
            term
            for term in category_terms["terms"]
            if money_coach_phrase_match(question_norm, question_tokens, term)
        )
        learned_matches = money_coach_learned_match_for_budget(category, category_terms, learned_categories)

        if not matched_terms and not learned_matches:
            continue

        confidence_scores = [
            money_coach_matched_term_confidence(term, category, budget.get("match_keyword") or "")
            for term in matched_terms
        ]
        learned_sources = []

        for learned in learned_matches:
            learned_count = learned.get("count", 0)
            confidence_scores.append(0.94 if learned_count >= 2 else 0.82)
            learned_sources.append({
                "category": learned.get("category"),
                "matched_terms": sorted(learned.get("matched_terms") or [])[:5],
                "sample_names": sorted(learned.get("sample_names") or [])[:3],
                "count": learned_count
            })

        confidence_score = round(max(confidence_scores or [0.55]), 2)
        amount = money_coach_number(budget.get("amount"))
        spent = money_coach_number(budget.get("spent"))
        remaining = money_coach_number(budget.get("remaining"))
        over = money_coach_number(budget.get("over_budget_amount"))
        end_date = money_coach_parse_date(budget.get("end_date"))
        days_left = None

        if end_date:
            days_left = max((end_date - date.today()).days + 1, 0)

        daily_room = round(remaining / days_left, 2) if days_left and remaining > 0 else 0

        if over > 0:
            recommendation = f"Spend 0 more in {category} until this budget resets."
            status = "over_budget"
        elif remaining <= 0:
            recommendation = f"Spend 0 more in {category}; that budget is used up."
            status = "used_up"
        else:
            recommendation = f"Keep {category} spending at or below {currency} {remaining:,.2f} for the rest of this budget."
            status = "room_left"

        raw_matches.append({
            "category": category,
            "budget": round(amount, 2),
            "spent": round(spent, 2),
            "remaining": round(max(remaining, 0), 2),
            "over_budget_amount": round(max(over, 0), 2),
            "days_left": days_left,
            "daily_room": daily_room,
            "status": status,
            "recommendation": recommendation,
            "matched_terms": matched_terms[:5],
            "matched_intents": sorted(category_terms["intents"]),
            "learned_sources": learned_sources,
            "confidence_score": confidence_score,
            "confidence": money_coach_confidence_label(confidence_score)
        })

    grouped_matches = {}
    for item in raw_matches:
        grouped_matches.setdefault(item["category"].lower(), []).append(item)

    matched = []
    for items in grouped_matches.values():
        over_items = [item for item in items if item["status"] == "over_budget"]
        if over_items:
            chosen = max(over_items, key=lambda item: item["over_budget_amount"])
        else:
            chosen = min(items, key=lambda item: item["remaining"])

        chosen = dict(chosen)
        if len(items) > 1:
            chosen["note"] = f"Using the tightest of {len(items)} matched {chosen['category']} budgets."

        matched.append(chosen)

    matched.sort(key=lambda item: (-money_coach_number(item.get("confidence_score")), item["category"].lower()))
    confidence_score = round(max((money_coach_number(item.get("confidence_score")) for item in matched), default=0), 2)
    spending_split = [
        {
            "category": item["category"],
            "remaining": item["remaining"],
            "daily_room": item["daily_room"],
            "status": item["status"],
            "confidence": item["confidence"]
        }
        for item in matched
    ]
    split_summary = ""

    if len(spending_split) > 1:
        split_parts = [
            f"{item['category']}: {currency} {money_coach_number(item['remaining']):,.2f}"
            for item in spending_split
        ]
        split_summary = f"Matched budget split: {', '.join(split_parts)}."

    return {
        "matched_categories": matched,
        "total_remaining": round(sum(item["remaining"] for item in matched), 2),
        "has_over_budget_category": any(item["status"] == "over_budget" for item in matched),
        "confidence_score": confidence_score,
        "confidence": money_coach_confidence_label(confidence_score) if matched else "none",
        "spending_split": spending_split,
        "split_summary": split_summary,
        "learned_from_transactions": any(item.get("learned_sources") for item in matched),
        "instruction": "If matched_categories is not empty, answer with these exact category limits first. If spending_split has multiple rows, explain the split clearly."
    }


def is_money_coach_affordability_question(question):
    question_lower = (question or "").lower()
    return any(phrase in question_lower for phrase in [
        "can i afford",
        "can i buy",
        "should i buy",
        "safe to spend",
        "can i spend",
        "should i spend",
        "afford this",
        "buy this"
    ])


def extract_money_coach_requested_amount(question):
    question_text = str(question or "")
    matches = re.findall(r"(?:[$€£¥]|usd|eur|mad|rmb|cny)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)", question_text, flags=re.IGNORECASE)

    for match in matches:
        try:
            amount = float(match.replace(",", ""))
        except (TypeError, ValueError):
            continue

        if amount > 0:
            return amount

    return None


def build_money_coach_affordability(question, context):
    monthly = context.get("current_month_summary") or {}
    budget_status = context.get("budget_status") or []
    recurring = context.get("recurring_payments") or []
    goals = context.get("goals") or []
    spending_guidance = context.get("spending_guidance") or {}
    matched_categories = spending_guidance.get("matched_categories") or []

    requested_amount = extract_money_coach_requested_amount(question)
    net_cash = money_coach_number(monthly.get("net"))
    transaction_count = int(money_coach_number(monthly.get("transaction_count")))

    positive_budget_room = sum(
        max(money_coach_number(item.get("remaining")), 0)
        for item in budget_status
    )
    over_budget_total = sum(
        max(money_coach_number(item.get("over_budget_amount")), 0)
        for item in budget_status
    )
    matched_category_room = None

    if matched_categories:
        matched_category_room = sum(
            max(money_coach_number(item.get("remaining")), 0)
            for item in matched_categories
        )

    due_soon_items = []
    due_soon_total = 0

    for item in recurring or []:
        amount = money_coach_number(item.get("amount"))
        due = money_coach_parse_date(item.get("next_date"))

        if amount >= 0 or not due:
            continue

        days_left = (due - date.today()).days
        if 0 <= days_left <= 7:
            due_amount = abs(amount)
            due_soon_total += due_amount
            due_soon_items.append({
                "name": item.get("name") or "Upcoming payment",
                "amount": round(due_amount, 2),
                "days_left": days_left,
                "date": due.isoformat()
            })

    goal_pressure_items = []
    goal_reserve_total = 0

    for goal in goals or []:
        target = money_coach_number(goal.get("target_amount"))
        saved = money_coach_number(goal.get("effective_saved_amount"))
        remaining = max(target - saved, 0)
        deadline = money_coach_parse_date(goal.get("deadline"))

        if remaining <= 0 or not deadline:
            continue

        days_left = (deadline - date.today()).days
        if days_left < 0:
            weekly_reserve = remaining
        elif days_left <= 30:
            weekly_reserve = min(remaining, (remaining / max(days_left, 1)) * 7)
        else:
            weekly_reserve = 0

        if weekly_reserve > 0:
            goal_reserve_total += weekly_reserve
            goal_pressure_items.append({
                "name": goal.get("name") or "Goal",
                "remaining": round(remaining, 2),
                "days_left": days_left,
                "weekly_reserve": round(weekly_reserve, 2)
            })

    has_budget_data = bool(budget_status)
    has_any_financial_data = bool(transaction_count or budget_status or recurring or goals)
    base_room = max(net_cash, 0)

    if has_budget_data and positive_budget_room > 0:
        base_room = min(base_room, positive_budget_room)

    if matched_category_room is not None:
        base_room = min(base_room, matched_category_room)

    pressure_total = over_budget_total + due_soon_total + goal_reserve_total
    safe_to_spend = max(base_room - pressure_total, 0)
    requested_gap = None if requested_amount is None else round(safe_to_spend - requested_amount, 2)

    if not has_any_financial_data:
        decision = "insufficient_data"
        label = "Not enough data"
    elif requested_amount is None:
        decision = "amount_needed"
        label = "Need amount"
    elif safe_to_spend >= requested_amount:
        decision = "yes"
        label = "Yes"
    elif safe_to_spend <= 0:
        decision = "wait"
        label = "Wait"
    else:
        decision = "careful"
        label = "Careful"

    currency = user_currency()
    reasons = []

    if has_any_financial_data:
        reasons.append(f"Current month net cash flow is {currency} {net_cash:,.2f}.")

    if matched_category_room is not None:
        reasons.append(f"Matched category room is {currency} {matched_category_room:,.2f}.")
    elif has_budget_data:
        reasons.append(f"Budget room is {currency} {positive_budget_room:,.2f}.")

    if over_budget_total > 0:
        reasons.append(f"Over-budget pressure is {currency} {over_budget_total:,.2f}.")

    if due_soon_total > 0:
        reasons.append(f"Upcoming bills in the next 7 days total {currency} {due_soon_total:,.2f}.")

    if goal_reserve_total > 0:
        reasons.append(f"Goal deadline pressure needs about {currency} {goal_reserve_total:,.2f} this week.")

    return {
        "is_affordability_question": is_money_coach_affordability_question(question),
        "requested_amount": round(requested_amount, 2) if requested_amount is not None else None,
        "safe_to_spend": round(safe_to_spend, 2),
        "decision": decision,
        "label": label,
        "requested_gap": requested_gap,
        "currency": currency,
        "base_room": round(base_room, 2),
        "net_cash": round(net_cash, 2),
        "positive_budget_room": round(positive_budget_room, 2),
        "matched_category_room": round(matched_category_room, 2) if matched_category_room is not None else None,
        "over_budget_total": round(over_budget_total, 2),
        "due_soon_total": round(due_soon_total, 2),
        "goal_reserve_total": round(goal_reserve_total, 2),
        "due_soon_items": due_soon_items[:5],
        "goal_pressure_items": goal_pressure_items[:5],
        "reasons": reasons[:5],
        "instruction": "For affordability questions, use this safe_to_spend value before explaining anything else."
    }


def build_money_coach_safe_to_spend_snapshot(user_id):
    context = build_money_coach_insight_context(user_id)
    context["spending_guidance"] = build_money_coach_spending_guidance(
        "How much is safe to spend this week?",
        context.get("budget_status") or [],
        currency=(context.get("user_preferences") or {}).get("default_currency")
    )
    affordability = build_money_coach_affordability(
        "How much is safe to spend this week?",
        context
    )

    amount = money_coach_number(affordability.get("safe_to_spend"))
    decision = affordability.get("decision")

    if decision == "insufficient_data":
        status = "Needs data"
        note = "Add transactions, budgets, bills, or goals to sharpen this number."
    elif amount <= 0:
        status = "Wait"
        note = "After budgets, bills, and goals."
    elif amount < 100:
        status = "Careful"
        note = "After budgets, bills, and goals."
    else:
        status = "Looks safe"
        note = "After budgets, bills, and goals."

    return {
        "period": "this_week",
        "amount": round(amount, 2),
        "currency": affordability.get("currency") or user_currency(),
        "status": status,
        "note": note,
        "affordability": affordability,
        "breakdown": {
            "net_cash": affordability.get("net_cash", 0),
            "budget_room": affordability.get("positive_budget_room", 0),
            "over_budget_pressure": affordability.get("over_budget_total", 0),
            "bills_due_soon": affordability.get("due_soon_total", 0),
            "goal_deadline_pressure": affordability.get("goal_reserve_total", 0)
        }
    }


def build_money_coach_insight_context(user_id):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT
            COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS income,
            ABS(COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END), 0)) AS expenses,
            COALESCE(SUM(amount), 0) AS net,
            COUNT(*) AS transaction_count
        FROM transactions
        WHERE user_id = %s
          AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE)
    """, (user_id,))
    current_month_summary = serialize_for_prompt(dict(cur.fetchone() or {}))

    cur.execute("""
        WITH budget_periods AS (
            SELECT
                b.*,
                COALESCE(
                    b.start_date,
                    CASE
                        WHEN b.year IS NOT NULL AND b.month IS NOT NULL
                        THEN make_date(b.year, b.month, 1)
                        ELSE CURRENT_DATE
                    END
                ) AS period_start,
                COALESCE(b.days, 30) AS period_days
            FROM budgets b
            WHERE b.user_id = %s
        )
        SELECT
            bp.category,
            bp.amount,
            bp.match_keyword,
            bp.period_start,
            (bp.period_start + ((bp.period_days - 1) * INTERVAL '1 day'))::date AS end_date,
            bp.period_days AS days,
            COALESCE(SUM(ABS(t.amount)), 0) AS spent,
            GREATEST(bp.amount - COALESCE(SUM(ABS(t.amount)), 0), 0) AS remaining,
            GREATEST(COALESCE(SUM(ABS(t.amount)), 0) - bp.amount, 0) AS over_budget_amount
        FROM budget_periods bp
        LEFT JOIN transactions t
            ON (
                LOWER(t.category) = LOWER(bp.category)
                OR (
                    bp.match_keyword IS NOT NULL
                    AND TRIM(bp.match_keyword) <> ''
                    AND LOWER(t.name) LIKE '%%' || LOWER(TRIM(bp.match_keyword)) || '%%'
                )
            )
            AND t.amount < 0
            AND t.user_id = %s
            AND t.date >= bp.period_start
            AND t.date <= (bp.period_start + ((bp.period_days - 1) * INTERVAL '1 day'))::date
        GROUP BY bp.category, bp.amount, bp.match_keyword, bp.period_start, bp.period_days
        ORDER BY over_budget_amount DESC, spent DESC
        LIMIT 30
    """, (user_id, user_id))
    budget_status = rows_for_prompt(cur.fetchall())

    cur.execute("""
        SELECT name, amount, category, account, frequency, next_date, is_active, last_paid_at, last_paid_for_date
        FROM recurring_payments
        WHERE user_id = %s
          AND is_active = TRUE
        ORDER BY next_date ASC
        LIMIT 30
    """, (user_id,))
    recurring_payments = rows_for_prompt(cur.fetchall())

    cur.execute("""
        SELECT
            g.id,
            g.name,
            g.category,
            g.target_amount,
            COALESCE(g.saved_amount, 0) AS manual_saved_amount,
            COALESCE(linked.linked_savings_amount, 0) AS linked_savings_amount,
            COALESCE(g.saved_amount, 0) + COALESCE(linked.linked_savings_amount, 0) AS effective_saved_amount,
            g.deadline,
            g.auto_link_savings,
            g.created_at
        FROM goals g
        LEFT JOIN LATERAL (
            SELECT COALESCE(SUM(ABS(t.amount)), 0) AS linked_savings_amount
            FROM transactions t
            WHERE g.auto_link_savings = TRUE
              AND t.user_id = g.user_id
              AND (
                  LOWER(COALESCE(t.category, '')) = LOWER(COALESCE(g.category, ''))
                  OR LOWER(COALESCE(t.name, '')) LIKE '%%' || LOWER(COALESCE(g.name, '')) || '%%'
              )
              AND (
                  LOWER(COALESCE(t.account, '')) LIKE '%%sav%%'
                  OR LOWER(COALESCE(t.name, '')) LIKE '%%saving%%'
                  OR LOWER(COALESCE(t.category, '')) LIKE '%%saving%%'
              )
        ) linked ON TRUE
        WHERE g.user_id = %s
        ORDER BY g.created_at DESC
        LIMIT 20
    """, (user_id,))
    goals = rows_for_prompt(cur.fetchall())

    cur.close()
    conn.close()

    return {
        "current_month_summary": current_month_summary,
        "budget_status": budget_status,
        "recurring_payments": recurring_payments,
        "goals": goals
    }


def build_money_coach_fallback_answer(question, context, reason="Money Coach AI is not connected yet"):
    monthly = context.get("current_month_summary") or {}
    budget_status = context.get("budget_status") or []
    goals = context.get("goals") or []
    recurring = context.get("recurring_payments") or []
    investments = context.get("investments") or {}
    spending_guidance = context.get("spending_guidance") or {}
    matched_spending = spending_guidance.get("matched_categories") or []
    affordability = context.get("affordability") or {}
    currency = (
        affordability.get("currency")
        or (context.get("user_preferences") or {}).get("default_currency")
        or DEFAULT_CURRENCY
    )

    income = float(monthly.get("income") or 0)
    expenses = float(monthly.get("expenses") or 0)
    net = float(monthly.get("net") or 0)
    over_budget = [
        item for item in budget_status
        if float(item.get("over_budget_amount") or 0) > 0
    ]
    due_soon = [
        item for item in recurring
        if item.get("next_date") and float(item.get("amount") or 0) < 0
    ][:3]
    active_goals = [
        item for item in goals
        if float(item.get("target_amount") or 0) > float(item.get("effective_saved_amount") or 0)
    ]

    question_lower = question.lower()
    is_buying_question = is_money_coach_affordability_question(question)

    if affordability.get("is_affordability_question") and affordability.get("decision") != "insufficient_data":
        safe_to_spend = float(affordability.get("safe_to_spend") or 0)
        requested_amount = affordability.get("requested_amount")
        decision = affordability.get("decision")

        if decision == "amount_needed":
            short_answer = f"Tell me the amount first. Based on your current data, your safer spending room is about {currency} {safe_to_spend:,.2f}."
        elif decision == "yes":
            short_answer = f"Yes. This looks affordable because your safer spending room is about {currency} {safe_to_spend:,.2f}."
        elif decision == "careful":
            short_answer = f"Careful. Your safer spending room is only about {currency} {safe_to_spend:,.2f}, which is below {currency} {float(requested_amount or 0):,.2f}."
        else:
            short_answer = f"Wait. Your safer spending room is about {currency} {safe_to_spend:,.2f} right now."
    elif matched_spending:
        total_room = float(spending_guidance.get("total_remaining") or 0)
        split_summary = spending_guidance.get("split_summary") or ""
        if spending_guidance.get("has_over_budget_category"):
            short_answer = f"Wait. Spend 0 more in any category that is already over budget. Your matched categories have about {currency} {total_room:,.2f} total room left."
        elif split_summary:
            short_answer = f"Keep this under about {currency} {total_room:,.2f} total. {split_summary}"
        else:
            short_answer = f"Keep those categories under about {currency} {total_room:,.2f} total for the rest of their budget periods."
    elif not income and not expenses and not budget_status and not goals and not recurring:
        short_answer = "Wait. Add a few transactions, budgets, or goals first so FinTrack can give you a sharper answer."
    elif is_buying_question and (net <= 0 or over_budget):
        short_answer = "Wait. Your current data shows pressure from spending or budgets, so this purchase needs caution."
    elif is_buying_question:
        short_answer = "Yes, if it fits inside your remaining budget and does not slow your top goal."
    else:
        short_answer = "Here is the clearest read from your FinTrack data right now."

    why = []

    if affordability.get("is_affordability_question") and affordability.get("reasons"):
        why.extend(affordability.get("reasons")[:3])

    if matched_spending:
        confidence = spending_guidance.get("confidence")
        if spending_guidance.get("learned_from_transactions"):
            why.append("I matched this using your own transaction history, not just generic category names.")
        elif confidence in {"high", "medium", "low"}:
            why.append(f"Category match confidence is {confidence}.")

    for item in matched_spending[:3]:
        if item.get("status") == "over_budget":
            detail = f"{item.get('category')} is already over by about {currency} {float(item.get('over_budget_amount') or 0):,.2f}."
        else:
            detail = f"{item.get('category')} has about {currency} {float(item.get('remaining') or 0):,.2f} left, or about {currency} {float(item.get('daily_room') or 0):,.2f} per day."

        if item.get("note"):
            detail = f"{detail} {item.get('note')}"

        why.append(detail)

    if income or expenses:
        why.append(f"This month shows {currency} {income:,.2f} income, {currency} {expenses:,.2f} spent, and {currency} {net:,.2f} net.")

    if over_budget:
        top_over = over_budget[0]
        why.append(f"{top_over.get('category', 'One budget')} is over by about {currency} {float(top_over.get('over_budget_amount') or 0):,.2f}.")
    elif budget_status:
        why.append("Your active budgets do not show overspending in the current snapshot.")

    if active_goals:
        goal = active_goals[0]
        remaining = float(goal.get("target_amount") or 0) - float(goal.get("effective_saved_amount") or 0)
        why.append(f"Your next goal still needs about {currency} {max(remaining, 0):,.2f}.")

    if due_soon:
        why.append(f"You have upcoming recurring expenses like {due_soon[0].get('name', 'a payment')} to keep in mind.")

    if investments.get("status") not in {"connected", "empty"}:
        why.append("Investment data is not fully connected yet, so I am not using it for portfolio advice.")

    if not why:
        why.append(reason)

    moves = []

    if affordability.get("is_affordability_question"):
        decision = affordability.get("decision")
        safe_to_spend = float(affordability.get("safe_to_spend") or 0)

        if decision == "yes":
            moves.append(f"Keep the purchase under {currency} {safe_to_spend:,.2f} and leave bills/goals untouched.")
        elif decision == "amount_needed":
            moves.append("Ask again with the exact amount so I can compare it to your safe-to-spend number.")
        elif decision in {"wait", "careful"}:
            moves.append("Wait or reduce the amount until it fits below your safe-to-spend number.")

    for item in matched_spending[:3]:
        moves.append(item.get("recommendation"))

    if matched_spending and spending_guidance.get("confidence") == "low":
        moves.append("Confirm the category if this match does not feel right.")

    if over_budget:
        moves.append("Pause extra spending in the over-budget category before adding new purchases.")

    if due_soon:
        moves.append("Check upcoming recurring bills before deciding how much is safe to spend.")

    if active_goals:
        moves.append("Protect your top goal first, then spend from what remains.")

    if not moves:
        moves.append("Add one budget and one goal to make Money Coach more personalized.")

    moves.append("Educational guidance only, not financial advice.")

    return "\n".join([
        "Short answer:",
        short_answer,
        "",
        "Why:",
        *[f"- {item}" for item in why[:3]],
        "",
        "Smart next move:",
        *[f"- {item}" for item in moves[:3]],
    ])

# ──────────────────────────────────────────────────────────────────────────
#  MONEY COACH — system prompt + intent routing + structured output
# ──────────────────────────────────────────────────────────────────────────

COACH_SYSTEM_PROMPT = """You are Money Coach inside FinTrack — a sharp friend who happens to be great with money. You speak naturally, never like a textbook.

Hard rules:
1. Every reasoning bullet must cite a SPECIFIC dollar amount AND a SPECIFIC category name.
2. Never give generic advice. Don't say "review your budget" — say "cut dining by $200 this week."
3. For buying questions, lead with "Wait", "Yes", or "No" — never "It depends."
4. Compare every number to a baseline (last month, average, budget). Numbers in isolation are useless.
5. If the data is too sparse, ask ONE clarifying question instead of guessing.
6. Stay in the user's currency. Don't convert.
7. Maximum 140 words across all fields.
8. Sound like a sharp friend, not a finance professional.

GOOD EXAMPLE (target this quality):
Q: "Can I afford a $400 PlayStation?"
{
  "short_answer": "Wait two weeks.",
  "why": [
    {"point": "You spent $4,400 this month vs your $3,200 average — 38% over.", "category": "overall", "dollar_amount": 4400},
    {"point": "Your travel goal needs $1,500 more by May 21 (12 days away).", "category": "Travel Goal", "dollar_amount": 1500},
    {"point": "Dining is your biggest leak this month at $380.", "category": "Dining", "dollar_amount": 380}
  ],
  "smart_next_move": {
    "action": "Skip 3 restaurant meals this week, redirect $200 to your travel goal, then revisit the PlayStation in 2 weeks.",
    "category": "Dining",
    "dollar_amount": 200
  }
}

BAD EXAMPLE (NEVER produce this — every line is too vague):
{
  "short_answer": "Wait, you're overspending.",
  "why": [
    {"point": "Your expenses are high.", "category": "overall", "dollar_amount": 0},
    {"point": "You have a goal coming up.", "category": "goal", "dollar_amount": 0}
  ],
  "smart_next_move": {"action": "Review your budget and adjust categories.", "category": "overall", "dollar_amount": 0}
}
"""

COACH_INTENT_FOCUS = {
    "affordability": (
        "INTENT: affordability question ('can I afford X', 'should I buy X').\n"
        "Focus on:\n"
        "1. Current month net cash flow (income vs expenses so far).\n"
        "2. Available room in the most-relevant budget category.\n"
        "3. Upcoming recurring payments in the next 14 days.\n"
        "4. Goal deadlines that need money before this purchase makes sense.\n"
        "If affordability.safe_to_spend exists in the snapshot, treat that as the ground-truth limit and reference it directly.\n"
    ),
    "spending_analysis": (
        "INTENT: 'where did my money go?' question.\n"
        "Focus on:\n"
        "1. Top 3 spending categories this month with exact dollar totals.\n"
        "2. Which category grew the most vs last month.\n"
        "3. Any single transaction larger than 20% of monthly spending.\n"
        "Do NOT give a buying recommendation. Explain the pattern.\n"
    ),
    "optimization": (
        "INTENT: 'how can I save more?' question.\n"
        "Focus on:\n"
        "1. Recurring payments — flag any subscription that looks unused or excessive (cite the dollar amount).\n"
        "2. The single category where the user is most over budget, and by how much.\n"
        "3. One low-effort, high-dollar-impact action they can take this week.\n"
        "Lead with the biggest dollar saving. Cite the exact amount they would save.\n"
    ),
    "goal_pacing": (
        "INTENT: 'am I on track for my goal?' question.\n"
        "Focus on:\n"
        "1. Identify which goal the user means (from the goals list).\n"
        "2. Current saved vs target, with the gap in dollars.\n"
        "3. Days remaining and required monthly contribution.\n"
        "4. Projected hit date at current saving pace vs the deadline.\n"
        "Lead the short_answer with 'On pace', 'Behind by N weeks', or 'Ahead'.\n"
    ),
    "general": (
        "INTENT: general money question.\n"
        "Focus on:\n"
        "1. The single most relevant slice of the snapshot for what was asked.\n"
        "2. One dollar-anchored observation comparing to a baseline.\n"
        "3. One concrete next step the user can take this week.\n"
    ),
}

COACH_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "short_answer": {"type": "string"},
        "why": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "point": {"type": "string"},
                    "category": {"type": "string"},
                    "dollar_amount": {"type": "number"}
                },
                "required": ["point", "category", "dollar_amount"],
                "additionalProperties": False
            }
        },
        "smart_next_move": {
            "type": "object",
            "properties": {
                "action": {"type": "string"},
                "category": {"type": "string"},
                "dollar_amount": {"type": "number"}
            },
            "required": ["action", "category", "dollar_amount"],
            "additionalProperties": False
        }
    },
    "required": ["short_answer", "why", "smart_next_move"],
    "additionalProperties": False
}


def detect_money_coach_intent(question):
    """Return the most-likely intent for routing to a focused prompt."""
    q = (question or "").lower()

    if any(p in q for p in [
        "can i afford", "can i buy", "should i buy", "is it ok to buy",
        "is it okay to buy", "afford", "puis-je acheter", "puis je acheter"
    ]):
        return "affordability"

    if any(p in q for p in [
        "where did", "money go", "what did i spend", "broke",
        "où est passé", "ou est passe", "where is my money"
    ]):
        return "spending_analysis"

    if any(p in q for p in [
        "save more", "how do i save", "how can i save", "reduce", "cut my",
        "cut spending", "économiser", "economiser", "réduire", "reduire"
    ]):
        return "optimization"

    if any(p in q for p in [
        "on track", "on pace", "pacing", "ahead of", "behind on",
        "goal progress", "atteindre mon objectif"
    ]) or ("goal" in q and any(p in q for p in ["my", "this", "the"])):
        return "goal_pacing"

    return "general"


def render_coach_response_to_text(parsed):
    """Convert the structured JSON response back to the plain-text format
    the existing frontend already renders."""
    if not isinstance(parsed, dict):
        return str(parsed or "").strip()

    short = (parsed.get("short_answer") or "").strip()
    why_items = parsed.get("why") or []
    smart = parsed.get("smart_next_move") or {}

    why_lines = []
    for item in why_items:
        if isinstance(item, dict):
            point = (item.get("point") or "").strip()
            if point:
                why_lines.append(f"• {point}")
        elif item:
            why_lines.append(f"• {str(item).strip()}")

    if isinstance(smart, dict):
        smart_text = (smart.get("action") or "").strip()
    else:
        smart_text = str(smart or "").strip()

    return (
        f"Short answer:\n{short}\n\n"
        f"Why:\n" + ("\n".join(why_lines) if why_lines else "—") + "\n\n"
        f"Smart next move:\n{smart_text}"
    ).strip()


def _build_money_coach_request(user_id, question):
    """Heavy-lift context build shared by /money-coach (JSON) and
    /money-coach/stream (SSE). Returns dict with: context, prompt,
    data_used, affordability."""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT name, amount, category, account, date
        FROM transactions
        WHERE user_id = %s
        ORDER BY date DESC
        LIMIT 80
    """, (user_id,))
    transactions = rows_for_prompt(cur.fetchall())

    cur.execute("""
        SELECT
            COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS income,
            ABS(COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END), 0)) AS expenses,
            COALESCE(SUM(amount), 0) AS net,
            COUNT(*) AS transaction_count
        FROM transactions
        WHERE user_id = %s
          AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE)
    """, (user_id,))
    current_month_summary = serialize_for_prompt(dict(cur.fetchone() or {}))

    cur.execute("""
        SELECT category, ABS(SUM(amount)) AS spent
        FROM transactions
        WHERE amount < 0
          AND user_id = %s
          AND date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY category
        ORDER BY spent DESC
        LIMIT 8
    """, (user_id,))
    top_spending = rows_for_prompt(cur.fetchall())

    cur.execute("""
        WITH budget_periods AS (
            SELECT
                b.*,
                COALESCE(
                    b.start_date,
                    CASE
                        WHEN b.year IS NOT NULL AND b.month IS NOT NULL
                        THEN make_date(b.year, b.month, 1)
                        ELSE CURRENT_DATE
                    END
                ) AS period_start,
                COALESCE(b.days, 30) AS period_days
            FROM budgets b
            WHERE b.user_id = %s
        )
        SELECT
            bp.category,
            bp.amount,
            bp.match_keyword,
            bp.period_start,
            (bp.period_start + ((bp.period_days - 1) * INTERVAL '1 day'))::date AS end_date,
            bp.period_days AS days,
            COALESCE(SUM(ABS(t.amount)), 0) AS spent,
            GREATEST(bp.amount - COALESCE(SUM(ABS(t.amount)), 0), 0) AS remaining,
            GREATEST(COALESCE(SUM(ABS(t.amount)), 0) - bp.amount, 0) AS over_budget_amount
        FROM budget_periods bp
        LEFT JOIN transactions t
            ON (
                LOWER(t.category) = LOWER(bp.category)
                OR (
                    bp.match_keyword IS NOT NULL
                    AND TRIM(bp.match_keyword) <> ''
                    AND LOWER(t.name) LIKE '%%' || LOWER(TRIM(bp.match_keyword)) || '%%'
                )
            )
            AND t.amount < 0
            AND t.user_id = %s
            AND t.date >= bp.period_start
            AND t.date <= (bp.period_start + ((bp.period_days - 1) * INTERVAL '1 day'))::date
        GROUP BY bp.category, bp.amount, bp.match_keyword, bp.period_start, bp.period_days
        ORDER BY over_budget_amount DESC, spent DESC
        LIMIT 30
    """, (user_id, user_id))
    budget_status = rows_for_prompt(cur.fetchall())
    spending_guidance = build_money_coach_spending_guidance(
        question,
        budget_status,
        transactions,
        currency=get_user_currency(user_id),
    )

    cur.execute("""
        SELECT
            g.id,
            g.name,
            g.category,
            g.target_amount,
            COALESCE(g.saved_amount, 0) AS manual_saved_amount,
            COALESCE(linked.linked_savings_amount, 0) AS linked_savings_amount,
            COALESCE(g.saved_amount, 0) + COALESCE(linked.linked_savings_amount, 0) AS effective_saved_amount,
            g.deadline,
            g.auto_link_savings,
            g.created_at
        FROM goals g
        LEFT JOIN LATERAL (
            SELECT COALESCE(SUM(ABS(t.amount)), 0) AS linked_savings_amount
            FROM transactions t
            WHERE g.auto_link_savings = TRUE
              AND t.user_id = g.user_id
              AND (
                  LOWER(COALESCE(t.category, '')) = LOWER(COALESCE(g.category, ''))
                  OR LOWER(COALESCE(t.name, '')) LIKE '%%' || LOWER(COALESCE(g.name, '')) || '%%'
              )
              AND (
                  LOWER(COALESCE(t.account, '')) LIKE '%%sav%%'
                  OR LOWER(COALESCE(t.name, '')) LIKE '%%saving%%'
                  OR LOWER(COALESCE(t.category, '')) LIKE '%%saving%%'
              )
        ) linked ON TRUE
        WHERE g.user_id = %s
        ORDER BY g.created_at DESC
        LIMIT 20
    """, (user_id,))
    goals = rows_for_prompt(cur.fetchall())

    cur.execute("""
        SELECT name, amount, category, account, frequency, next_date, is_active, last_paid_at, last_paid_for_date
        FROM recurring_payments
        WHERE user_id = %s
          AND is_active = TRUE
        ORDER BY next_date ASC
        LIMIT 30
    """, (user_id,))
    recurring_payments = rows_for_prompt(cur.fetchall())

    cur.execute("""
        SELECT question, answer, mode, created_at
        FROM money_coach_history
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT 6
    """, (user_id,))
    recent_coach_history = rows_for_prompt(cur.fetchall())

    cur.execute("""
        SELECT id, name, subscription_status, trial_started_at, trial_ends_at, created_at,
               preferred_currency, preferred_language
        FROM users
        WHERE id = %s
    """, (user_id,))
    user_profile = serialize_for_prompt(dict(cur.fetchone() or {}))

    investments = get_money_coach_investment_context(cur, user_id)

    cur.close()
    conn.close()

    money_coach_context = {
        "user_preferences": {
            "profile": user_profile,
            "default_currency": user_profile.get("preferred_currency") or DEFAULT_CURRENCY,
            "saved_app_preferences": {
                "preferred_currency": user_profile.get("preferred_currency"),
                "preferred_language": user_profile.get("preferred_language"),
            }
        },
        "current_month_summary": current_month_summary,
        "recent_transactions": transactions,
        "top_spending_last_30_days": top_spending,
        "budget_status": budget_status,
        "spending_guidance": spending_guidance,
        "goals": goals,
        "recurring_payments": recurring_payments,
        "recent_coach_history": recent_coach_history,
        "investments": investments
    }
    affordability = build_money_coach_affordability(question, money_coach_context)
    money_coach_context["affordability"] = affordability
    data_used = build_money_coach_data_used(money_coach_context)

    if anthropic_client is None:
        fallback_answer = build_money_coach_fallback_answer(
            question,
            money_coach_context,
            "Claude is not connected yet, so this is local FinTrack guidance."
        )
        history_id = save_money_coach_history(user_id, question, fallback_answer, "fallback", data_used)
        sync_money_coach_insights(user_id, money_coach_context)

        return jsonify({
            "history_id": history_id,
            "answer": fallback_answer,
            "mode": "fallback",
            "data_used": data_used,
            "affordability": affordability,
            "disclaimer": "Educational guidance only, not financial advice."
        }), 200

    prompt = f"""
You are Money Coach inside FinTrack, a personal finance app.

Your job:
Give practical, specific advice using ONLY the user's FinTrack data below.

Important rules:
- Do not invent income, savings, budgets, goals, recurring payments, investments, or user preferences.
- Use recent Coach history only to preserve context. Do not repeat old advice unless it is still relevant.
- If FinTrack financial snapshot.affordability.is_affordability_question is true, use affordability.safe_to_spend and affordability.decision before any AI judgment.
- Never say a purchase is affordable if affordability.decision is "wait", "careful", or "insufficient_data".
- If affordability.requested_amount exists, compare it directly against affordability.safe_to_spend.
- If FinTrack financial snapshot.spending_guidance.matched_categories has items, use those exact category limits first.
- For "how much should I spend on..." questions, name each matched category and give the remaining amount or say spend 0 more if it is over budget.
- If spending_guidance.spending_split has multiple rows, explain the total and the category split in plain language.
- If spending_guidance.learned_from_transactions is true, say FinTrack recognized this from the user's own transaction history.
- If spending_guidance.confidence is "low", ask one short clarifying question before giving a firm recommendation.
- If the user asks "can I buy..." or "can I afford...", answer based on:
  1. current month net cash flow
  2. available budget room and overspent categories
  3. upcoming recurring payments
  4. goal deadlines and remaining amounts
- If data is missing, say what is missing, but still give a useful cautious answer.
- If the user mentions a currency like RMB, CNY, USD, MAD, EUR, keep that currency in your answer.
- Do not convert currencies unless exchange rates are provided.
- Use the user's default currency only when the question does not specify a currency.
- If investment data status is not "connected", do not give portfolio-specific advice. Say investment data is not connected yet.
- Be clear and human, not robotic.
- Avoid saying "I don't have enough information" as the main answer unless absolutely necessary.
- Keep answers short unless user asks for deep analysis.
- Use natural everyday language.
- Never mention raw negative numbers like -3000. Say spent 3000 instead.
- Avoid repeating the same category name too many times.
- If user asks a yes/no buying question, start with yes / no / wait.
- Focus on decision-making, not generic warnings.
- Use a supportive tone like a premium advisor.
- This is educational guidance, not financial advice. Keep that language short and calm.

User question:
{question}

FinTrack financial snapshot:
{money_coach_context}

Answer with exactly these sections:

Short answer:
[clear yes / no / wait answer in 1-2 lines]

Why:
[2-3 short bullets]

Smart next move:
[1-3 useful actions]

Keep total answer under 140 words unless asked for more.
"""

    try:
        answer = call_money_coach_ai(
            system_text="You are a careful personal finance coach. You explain money clearly, practically, and without jargon.",
            user_text=prompt,
            max_tokens=2500,
            user_id=user_id,
        )

        history_id = save_money_coach_history(user_id, question, answer, "ai", data_used)
        sync_money_coach_insights(user_id, money_coach_context)

        return jsonify({
            "history_id": history_id,
            "answer": answer,
            "mode": "ai",
            "data_used": data_used,
            "affordability": affordability,
            "disclaimer": "Educational guidance only, not financial advice."
        })

    except Exception as e:
        print("Money Coach error:", e)
        fallback_answer = build_money_coach_fallback_answer(
            question,
            money_coach_context,
            "Money Coach AI could not answer right now, so this is local FinTrack guidance."
        )
        history_id = save_money_coach_history(user_id, question, fallback_answer, "fallback", data_used)
        sync_money_coach_insights(user_id, money_coach_context)

        return jsonify({
            "history_id": history_id,
            "answer": fallback_answer,
            "mode": "fallback",
            "data_used": data_used,
            "affordability": affordability,
            "disclaimer": "Educational guidance only, not financial advice."
        }), 200


def _build_money_coach_request(user_id, question):
    """Shared prep used by both the JSON endpoint and the streaming endpoint.
    Builds the financial snapshot, affordability, data_used, and the final
    prompt string. Returns (money_coach_context, data_used, affordability, prompt)."""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT name, amount, category, account, date
        FROM transactions
        WHERE user_id = %s
        ORDER BY date DESC
        LIMIT 80
    """, (user_id,))
    transactions = rows_for_prompt(cur.fetchall())

    cur.execute("""
        SELECT
            COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS income,
            ABS(COALESCE(SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END), 0)) AS expenses,
            COALESCE(SUM(amount), 0) AS net,
            COUNT(*) AS transaction_count
        FROM transactions
        WHERE user_id = %s
          AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE)
    """, (user_id,))
    current_month_summary = serialize_for_prompt(dict(cur.fetchone() or {}))

    cur.execute("""
        SELECT category, ABS(SUM(amount)) AS spent
        FROM transactions
        WHERE amount < 0
          AND user_id = %s
          AND date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY category
        ORDER BY spent DESC
        LIMIT 8
    """, (user_id,))
    top_spending = rows_for_prompt(cur.fetchall())

    cur.execute("""
        WITH budget_periods AS (
            SELECT
                b.*,
                COALESCE(
                    b.start_date,
                    CASE
                        WHEN b.year IS NOT NULL AND b.month IS NOT NULL
                        THEN make_date(b.year, b.month, 1)
                        ELSE CURRENT_DATE
                    END
                ) AS period_start,
                COALESCE(b.days, 30) AS period_days
            FROM budgets b
            WHERE b.user_id = %s
        )
        SELECT
            bp.category,
            bp.amount,
            bp.match_keyword,
            bp.period_start,
            (bp.period_start + ((bp.period_days - 1) * INTERVAL '1 day'))::date AS end_date,
            bp.period_days AS days,
            COALESCE(SUM(ABS(t.amount)), 0) AS spent,
            GREATEST(bp.amount - COALESCE(SUM(ABS(t.amount)), 0), 0) AS remaining,
            GREATEST(COALESCE(SUM(ABS(t.amount)), 0) - bp.amount, 0) AS over_budget_amount
        FROM budget_periods bp
        LEFT JOIN transactions t
            ON (
                LOWER(t.category) = LOWER(bp.category)
                OR (
                    bp.match_keyword IS NOT NULL
                    AND TRIM(bp.match_keyword) <> ''
                    AND LOWER(t.name) LIKE '%%' || LOWER(TRIM(bp.match_keyword)) || '%%'
                )
            )
            AND t.amount < 0
            AND t.user_id = %s
            AND t.date >= bp.period_start
            AND t.date <= (bp.period_start + ((bp.period_days - 1) * INTERVAL '1 day'))::date
        GROUP BY bp.category, bp.amount, bp.match_keyword, bp.period_start, bp.period_days
        ORDER BY over_budget_amount DESC, spent DESC
        LIMIT 30
    """, (user_id, user_id))
    budget_status = rows_for_prompt(cur.fetchall())
    spending_guidance = build_money_coach_spending_guidance(
        question,
        budget_status,
        transactions,
        currency=get_user_currency(user_id),
    )

    cur.execute("""
        SELECT
            g.id,
            g.name,
            g.category,
            g.target_amount,
            COALESCE(g.saved_amount, 0) AS manual_saved_amount,
            COALESCE(linked.linked_savings_amount, 0) AS linked_savings_amount,
            COALESCE(g.saved_amount, 0) + COALESCE(linked.linked_savings_amount, 0) AS effective_saved_amount,
            g.deadline,
            g.auto_link_savings,
            g.created_at
        FROM goals g
        LEFT JOIN LATERAL (
            SELECT COALESCE(SUM(ABS(t.amount)), 0) AS linked_savings_amount
            FROM transactions t
            WHERE g.auto_link_savings = TRUE
              AND t.user_id = g.user_id
              AND (
                  LOWER(COALESCE(t.category, '')) = LOWER(COALESCE(g.category, ''))
                  OR LOWER(COALESCE(t.name, '')) LIKE '%%' || LOWER(COALESCE(g.name, '')) || '%%'
              )
              AND (
                  LOWER(COALESCE(t.account, '')) LIKE '%%sav%%'
                  OR LOWER(COALESCE(t.name, '')) LIKE '%%saving%%'
                  OR LOWER(COALESCE(t.category, '')) LIKE '%%saving%%'
              )
        ) linked ON TRUE
        WHERE g.user_id = %s
        ORDER BY g.created_at DESC
        LIMIT 20
    """, (user_id,))
    goals = rows_for_prompt(cur.fetchall())

    cur.execute("""
        SELECT name, amount, category, account, frequency, next_date, is_active, last_paid_at, last_paid_for_date
        FROM recurring_payments
        WHERE user_id = %s
          AND is_active = TRUE
        ORDER BY next_date ASC
        LIMIT 30
    """, (user_id,))
    recurring_payments = rows_for_prompt(cur.fetchall())

    cur.execute("""
        SELECT question, answer, mode, created_at
        FROM money_coach_history
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT 6
    """, (user_id,))
    recent_coach_history = rows_for_prompt(cur.fetchall())

    cur.execute("""
        SELECT id, name, subscription_status, trial_started_at, trial_ends_at, created_at,
               preferred_currency, preferred_language
        FROM users
        WHERE id = %s
    """, (user_id,))
    user_profile = serialize_for_prompt(dict(cur.fetchone() or {}))

    investments = get_money_coach_investment_context(cur, user_id)

    cur.close()
    conn.close()

    money_coach_context = {
        "user_preferences": {
            "profile": user_profile,
            "default_currency": user_profile.get("preferred_currency") or DEFAULT_CURRENCY,
            "saved_app_preferences": {
                "preferred_currency": user_profile.get("preferred_currency"),
                "preferred_language": user_profile.get("preferred_language"),
            }
        },
        "current_month_summary": current_month_summary,
        "recent_transactions": transactions,
        "top_spending_last_30_days": top_spending,
        "budget_status": budget_status,
        "spending_guidance": spending_guidance,
        "goals": goals,
        "recurring_payments": recurring_payments,
        "recent_coach_history": recent_coach_history,
        "investments": investments
    }
    affordability = build_money_coach_affordability(question, money_coach_context)
    money_coach_context["affordability"] = affordability
    data_used = build_money_coach_data_used(money_coach_context)

    prompt = f"""
You are Money Coach inside FinTrack, a personal finance app.

Your job:
Give practical, specific advice using ONLY the user's FinTrack data below.

Important rules:
- Do not invent income, savings, budgets, goals, recurring payments, investments, or user preferences.
- Use recent Coach history only to preserve context. Do not repeat old advice unless it is still relevant.
- If FinTrack financial snapshot.affordability.is_affordability_question is true, use affordability.safe_to_spend and affordability.decision before any AI judgment.
- Never say a purchase is affordable if affordability.decision is "wait", "careful", or "insufficient_data".
- If affordability.requested_amount exists, compare it directly against affordability.safe_to_spend.
- If FinTrack financial snapshot.spending_guidance.matched_categories has items, use those exact category limits first.
- For "how much should I spend on..." questions, name each matched category and give the remaining amount or say spend 0 more if it is over budget.
- If spending_guidance.spending_split has multiple rows, explain the total and the category split in plain language.
- If spending_guidance.learned_from_transactions is true, say FinTrack recognized this from the user's own transaction history.
- If spending_guidance.confidence is "low", ask one short clarifying question before giving a firm recommendation.
- If the user asks "can I buy..." or "can I afford...", answer based on:
  1. current month net cash flow
  2. available budget room and overspent categories
  3. upcoming recurring payments
  4. goal deadlines and remaining amounts
- If data is missing, say what is missing, but still give a useful cautious answer.
- If the user mentions a currency like RMB, CNY, USD, MAD, EUR, keep that currency in your answer.
- Do not convert currencies unless exchange rates are provided.
- Use the user's default currency only when the question does not specify a currency.
- If investment data status is not "connected", do not give portfolio-specific advice. Say investment data is not connected yet.
- Be clear and human, not robotic.
- Avoid saying "I don't have enough information" as the main answer unless absolutely necessary.
- Keep answers short unless user asks for deep analysis.
- Use natural everyday language.
- Never mention raw negative numbers like -3000. Say spent 3000 instead.
- Avoid repeating the same category name too many times.
- If user asks a yes/no buying question, start with yes / no / wait.
- Focus on decision-making, not generic warnings.
- Use a supportive tone like a premium advisor.
- This is educational guidance, not financial advice. Keep that language short and calm.

User question:
{question}

FinTrack financial snapshot:
{money_coach_context}

Answer with exactly these sections:

Short answer:
[clear yes / no / wait answer in 1-2 lines]

Why:
[2-3 short bullets]

Smart next move:
[1-3 useful actions]

Keep total answer under 140 words unless asked for more.
"""

    return money_coach_context, data_used, affordability, prompt


def _sse_event(event_type, payload):
    """Format a Server-Sent Event line. We use a single channel where every
    chunk is `{"type": ..., ...}` so the frontend has one consistent parser."""
    body = {"type": event_type}
    if isinstance(payload, dict):
        body.update(payload)
    return f"data: {json.dumps(body, default=str)}\n\n"


@app.route('/api/money-coach', methods=['POST'])
@login_required
@require_active_subscription
def money_coach():
    data = request.json or {}
    question = (data.get('question') or '').strip()
    user_id = current_user_id()

    if not question:
        return jsonify({"error": "Question is required"}), 400

    try:
        money_coach_context, data_used, affordability, prompt = _build_money_coach_request(user_id, question)
    except Exception as exc:
        print("Money Coach prep error:", exc)
        return jsonify({"error": "Money Coach could not prepare context"}), 500

    if anthropic_client is None:
        fallback_answer = build_money_coach_fallback_answer(
            question,
            money_coach_context,
            "Claude is not connected yet, so this is local FinTrack guidance."
        )
        history_id = save_money_coach_history(user_id, question, fallback_answer, "fallback", data_used)
        sync_money_coach_insights(user_id, money_coach_context)

        return jsonify({
            "history_id": history_id,
            "answer": fallback_answer,
            "mode": "fallback",
            "data_used": data_used,
            "affordability": affordability,
            "disclaimer": "Educational guidance only, not financial advice."
        }), 200

    try:
        answer = call_money_coach_ai(
            system_text="You are a careful personal finance coach. You explain money clearly, practically, and without jargon.",
            user_text=prompt,
            max_tokens=2500,
            user_id=user_id,
        )
        history_id = save_money_coach_history(user_id, question, answer, "ai", data_used)
        sync_money_coach_insights(user_id, money_coach_context)

        return jsonify({
            "history_id": history_id,
            "answer": answer,
            "mode": "ai",
            "data_used": data_used,
            "affordability": affordability,
            "disclaimer": "Educational guidance only, not financial advice."
        }), 200
    except Exception as exc:
        print("Money Coach error:", exc)
        fallback_answer = build_money_coach_fallback_answer(
            question,
            money_coach_context,
            "Money Coach AI could not answer right now, so this is local FinTrack guidance."
        )
        history_id = save_money_coach_history(user_id, question, fallback_answer, "fallback", data_used)
        sync_money_coach_insights(user_id, money_coach_context)

        return jsonify({
            "history_id": history_id,
            "answer": fallback_answer,
            "mode": "fallback",
            "data_used": data_used,
            "affordability": affordability,
            "disclaimer": "Educational guidance only, not financial advice."
        }), 200


@app.route('/api/money-coach/stream', methods=['POST'])
@login_required
@require_active_subscription
def money_coach_stream():
    """Streaming variant of /api/money-coach. Emits Server-Sent Events:
      - {"type": "ready"}                         -- prep done, model about to speak
      - {"type": "delta", "text": "..."}          -- a chunk of answer text
      - {"type": "done", "history_id", "mode", "data_used", "affordability"}
      - {"type": "error", "message": "..."}       -- terminal error
      - {"type": "fallback", "answer": "..."}     -- when AI is unavailable;
        the whole local guidance answer in one event (followed by "done").
    """
    data = request.json or {}
    question = (data.get('question') or '').strip()
    user_id = current_user_id()

    if not question:
        return jsonify({"error": "Question is required"}), 400

    try:
        money_coach_context, data_used, affordability, prompt = _build_money_coach_request(user_id, question)
    except Exception as exc:
        print("Money Coach stream prep error:", exc)
        return jsonify({"error": "Money Coach could not prepare context"}), 500

    def emit_fallback(reason):
        fallback_answer = build_money_coach_fallback_answer(question, money_coach_context, reason)
        history_id = save_money_coach_history(user_id, question, fallback_answer, "fallback", data_used)
        sync_money_coach_insights(user_id, money_coach_context)
        yield _sse_event("fallback", {"answer": fallback_answer})
        yield _sse_event("done", {
            "history_id": history_id,
            "mode": "fallback",
            "data_used": data_used,
            "affordability": affordability,
            "disclaimer": "Educational guidance only, not financial advice.",
        })

    @stream_with_context
    def generate():
        yield _sse_event("ready", {})

        if anthropic_client is None:
            yield from emit_fallback("Money Coach AI is not connected yet, so this is local FinTrack guidance.")
            return

        kwargs = {
            "model": CLAUDE_MODEL,
            "max_tokens": 2500,
            "system": "You are a careful personal finance coach. You explain money clearly, practically, and without jargon.",
            "messages": build_claude_cached_messages(user_id, prompt),
            "output_config": claude_output_config(),
        }
        thinking = claude_thinking_config()
        if thinking:
            kwargs["thinking"] = thinking

        collected = []
        try:
            with anthropic_client.messages.stream(**kwargs) as stream:
                for text in stream.text_stream:
                    if not text:
                        continue
                    collected.append(text)
                    yield _sse_event("delta", {"text": text})
                final_message = stream.get_final_message()

            log_claude_call(user_id, CLAUDE_MODEL, getattr(final_message, "usage", None))

            answer = "".join(collected).strip()
            if not answer:
                yield from emit_fallback("Money Coach AI returned an empty response.")
                return

            history_id = save_money_coach_history(user_id, question, answer, "ai", data_used)
            sync_money_coach_insights(user_id, money_coach_context)

            yield _sse_event("done", {
                "history_id": history_id,
                "mode": "ai",
                "data_used": data_used,
                "affordability": affordability,
                "disclaimer": "Educational guidance only, not financial advice.",
            })

        except anthropic.APIError as exc:
            print(f"Claude streaming error, falling back: {exc}")
            yield from emit_fallback("Money Coach AI could not answer right now, so this is local FinTrack guidance.")
        except Exception as exc:
            print("Money Coach streaming error:", exc)
            yield from emit_fallback("Money Coach AI could not answer right now, so this is local FinTrack guidance.")

    return Response(generate(), mimetype="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
    })


@app.route('/api/money-coach/safe-to-spend', methods=['GET'])
@login_required
@require_active_subscription
def get_money_coach_safe_to_spend():
    return jsonify(build_money_coach_safe_to_spend_snapshot(current_user_id())), 200


def _recurring_dates_in_window(start_date, window_days, base_date, frequency):
    """Project a single recurring entry's expected occurrences across the
    forecast window, walking by its frequency."""
    if not base_date:
        return []
    if isinstance(base_date, str):
        base_date = money_coach_parse_date(base_date)
        if not base_date:
            return []

    freq = (frequency or "").strip().lower()
    step_days = {
        "weekly": 7,
        "biweekly": 14,
        "monthly": 30,
        "quarterly": 91,
        "yearly": 365,
    }.get(freq, 30)

    end = start_date + timedelta(days=window_days)
    current = base_date
    # Advance to first occurrence within or after start window.
    while current < start_date:
        current = current + timedelta(days=step_days)
    out = []
    safety = 0
    while current <= end and safety < 12:
        out.append(current)
        current = current + timedelta(days=step_days)
        safety += 1
    return out


def build_cash_flow_forecast(user_id, days=30):
    """Deterministic next-30-day cash flow forecast.
    Returns the full daily balance trajectory plus a summary of inflection
    points (zero crossing, minimum, end balance) and the named events that
    move the line (recurring income/bills)."""
    days = max(7, min(60, int(days or 30)))

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT COALESCE(SUM(amount), 0) AS balance
        FROM transactions
        WHERE user_id = %s
    """, (user_id,))
    start_balance = float((cur.fetchone() or {}).get("balance") or 0)

    # Compute daily-discretionary using the MEDIAN of daily expense totals
    # over the last 60 days (excluding recurring source). Median ignores
    # one-off big purchases that would otherwise overstate the burn rate.
    cur.execute("""
        SELECT
            date::date AS day,
            COALESCE(SUM(ABS(amount)), 0) AS expense
        FROM transactions
        WHERE user_id = %s
          AND amount < 0
          AND COALESCE(source, '') <> 'recurring'
          AND date >= CURRENT_DATE - INTERVAL '60 days'
        GROUP BY 1
        ORDER BY 1
    """, (user_id,))
    daily_expense_rows = cur.fetchall()

    cur.execute("""
        SELECT name, amount, frequency, next_date
        FROM recurring_payments
        WHERE user_id = %s
          AND is_active = TRUE
          AND next_date IS NOT NULL
        ORDER BY next_date
    """, (user_id,))
    recurring_rows = cur.fetchall()

    cur.close()
    conn.close()

    today = date.today()

    # Compute the daily discretionary spend as the MINIMUM of the 30-day and
    # 60-day averages. This is "fewer false alarms" math: if the recent month
    # is quieter than the prior month, trust the recent one; if a single old
    # outlier is inflating the 60-day mean, the 30-day window wins.
    days_with_spend = {row["day"]: float(row["expense"] or 0) for row in daily_expense_rows}
    sum_30 = sum(days_with_spend.get(today - timedelta(days=i + 1), 0.0) for i in range(30))
    sum_60 = sum(days_with_spend.get(today - timedelta(days=i + 1), 0.0) for i in range(60))
    avg_30 = sum_30 / 30.0
    avg_60 = sum_60 / 60.0
    daily_discretionary = round(min(avg_30, avg_60), 2)

    # Expand recurring entries across the forecast window.
    events_by_date = {}
    for row in recurring_rows:
        occurrences = _recurring_dates_in_window(today, days, row.get("next_date"), row.get("frequency"))
        for occ in occurrences:
            iso = occ.isoformat()
            events_by_date.setdefault(iso, []).append({
                "name": row.get("name") or "Recurring",
                "amount": float(row.get("amount") or 0),
                "frequency": row.get("frequency") or "monthly",
            })

    balance = start_balance
    daily = [{"date": today.isoformat(), "balance": round(balance, 2)}]
    events = []
    minimum_balance = balance
    minimum_date = today
    zero_crossing_date = None

    for offset in range(1, days + 1):
        day = today + timedelta(days=offset)
        iso = day.isoformat()

        for evt in events_by_date.get(iso, []):
            amt = evt["amount"]
            balance += amt
            events.append({
                "date": iso,
                "type": "income" if amt > 0 else "expense",
                "label": evt["name"],
                "amount": round(amt, 2),
                "frequency": evt["frequency"],
            })

        balance -= daily_discretionary

        daily.append({"date": iso, "balance": round(balance, 2)})

        if balance < minimum_balance:
            minimum_balance = balance
            minimum_date = day
        if zero_crossing_date is None and balance < 0:
            zero_crossing_date = day

    end_balance = balance

    forecast = {
        "currency": get_user_currency(user_id),
        "days": days,
        "today": today.isoformat(),
        "start_balance": round(start_balance, 2),
        "end_balance": round(end_balance, 2),
        "minimum_balance": round(minimum_balance, 2),
        "minimum_date": minimum_date.isoformat(),
        "zero_crossing_date": zero_crossing_date.isoformat() if zero_crossing_date else None,
        "daily_discretionary": daily_discretionary,
        "events": events,
        "daily": daily,
    }
    return forecast


@app.route('/api/money-coach/cash-flow-forecast', methods=['GET'])
@login_required
@require_active_subscription
def get_cash_flow_forecast():
    try:
        days = int(request.args.get("days") or 30)
    except (TypeError, ValueError):
        days = 30
    return jsonify(build_cash_flow_forecast(current_user_id(), days=days)), 200


@app.route('/api/money-coach/what-if', methods=['POST'])
@login_required
@require_active_subscription
def what_if_simulation():
    payload = request.json or {}
    try:
        raw_amount = float(payload.get("amount") or 0)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid amount"}), 400
    amount = abs(raw_amount)
    if amount <= 0:
        return jsonify({"error": "Amount must be positive"}), 400

    label = (payload.get("label") or "").strip() or "this purchase"
    category = (payload.get("category") or "").strip()
    raw_when = payload.get("when")
    purchase_date = money_coach_parse_date(raw_when) if raw_when else date.today()
    if not purchase_date:
        purchase_date = date.today()

    user_id = current_user_id()
    base = build_cash_flow_forecast(user_id, days=30)

    today = date.today()
    if purchase_date < today:
        purchase_date = today
    offset = (purchase_date - today).days
    if offset > base["days"]:
        offset = base["days"]

    # Build simulated daily series.
    simulated_daily = []
    sim_balance = base["start_balance"]
    sim_min = base["start_balance"]
    sim_min_date = today
    sim_zero = None
    daily_disc = base["daily_discretionary"]
    events_by_date = {}
    for evt in base["events"]:
        events_by_date.setdefault(evt["date"], []).append(evt)

    for i in range(base["days"] + 1):
        day = today + timedelta(days=i)
        iso = day.isoformat()
        if i > 0:
            for evt in events_by_date.get(iso, []):
                sim_balance += evt["amount"]
            sim_balance -= daily_disc
        if i == offset:
            sim_balance -= amount
        simulated_daily.append({"date": iso, "balance": round(sim_balance, 2)})
        if sim_balance < sim_min:
            sim_min = sim_balance
            sim_min_date = day
        if sim_zero is None and sim_balance < 0:
            sim_zero = day

    sim_end = sim_balance

    headroom_after_purchase = sim_min
    if sim_min < 0:
        verdict = "no"
    elif sim_end < amount * 0.20 or sim_min < amount * 0.10:
        verdict = "wait"
    else:
        verdict = "yes"

    return jsonify({
        "verdict": verdict,
        "amount": round(amount, 2),
        "label": label,
        "category": category,
        "when": purchase_date.isoformat(),
        "currency": get_user_currency(user_id),
        "base": {
            "end_balance": base["end_balance"],
            "minimum_balance": base["minimum_balance"],
            "minimum_date": base["minimum_date"],
            "zero_crossing_date": base["zero_crossing_date"],
        },
        "simulated": {
            "end_balance": round(sim_end, 2),
            "minimum_balance": round(sim_min, 2),
            "minimum_date": sim_min_date.isoformat(),
            "zero_crossing_date": sim_zero.isoformat() if sim_zero else None,
            "headroom_after_purchase": round(headroom_after_purchase, 2),
            "daily": simulated_daily,
        },
        "deltas": {
            "end_balance":     round(sim_end - base["end_balance"], 2),
            "minimum_balance": round(sim_min - base["minimum_balance"], 2),
        }
    }), 200


@app.route('/api/money-coach/history', methods=['GET'])
@login_required
@require_active_subscription
def get_money_coach_history():
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT id, question, answer, mode, feedback, feedback_at, data_used, created_at
        FROM money_coach_history
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT 12
    """, (current_user_id(),))
    rows = rows_for_prompt(cur.fetchall())

    cur.close()
    conn.close()

    return jsonify(rows), 200


@app.route('/api/money-coach/history/<int:history_id>/feedback', methods=['POST'])
@login_required
@require_active_subscription
def update_money_coach_feedback(history_id):
    data = request.json or {}
    feedback = (data.get("feedback") or "").strip().lower()

    if feedback not in {"helpful", "not_helpful"}:
        return jsonify({"error": "Feedback must be helpful or not_helpful"}), 400

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        UPDATE money_coach_history
        SET feedback = %s,
            feedback_at = CURRENT_TIMESTAMP
        WHERE id = %s
          AND user_id = %s
    """, (feedback, history_id, current_user_id()))

    if cur.rowcount == 0:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({"error": "Money Coach answer not found"}), 404

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "Feedback saved", "feedback": feedback}), 200


@app.route('/api/money-coach/insights', methods=['GET'])
@login_required
@require_active_subscription
def get_money_coach_insights():
    user_id = current_user_id()
    sync_money_coach_insights(user_id, build_money_coach_insight_context(user_id))

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT id, title, body, source, status, created_at, updated_at
        FROM money_coach_insights
        WHERE user_id = %s
          AND status = 'open'
        ORDER BY updated_at DESC
        LIMIT 8
    """, (user_id,))
    rows = rows_for_prompt(cur.fetchall())

    cur.close()
    conn.close()

    return jsonify(rows), 200


@app.route('/api/money-coach/daily-scan', methods=['POST'])
@login_required
@require_active_subscription
def trigger_money_coach_daily_scan():
    user_id = current_user_id()
    payload = request.json or {}
    force = request_bool(payload.get("force"), default=False)
    if not force:
        rows = fetch_daily_insights(user_id)
        return jsonify({
            "ran": False,
            "generated": [],
            "insights": rows,
        }), 200

    try:
        rows, ran = run_daily_insights_scan(user_id, force=force)
    except Exception as exc:
        print("Daily insights scan error:", exc)
        rows = fetch_daily_insights(user_id)
        ran = False

    return jsonify({
        "ran": ran,
        "generated": rows if ran else [],
        "insights": rows,
    }), 200


@app.route('/api/insights/daily', methods=['GET'])
@login_required
@require_active_subscription
def get_daily_insights():
    user_id = current_user_id()
    rows = fetch_daily_insights(user_id)
    return jsonify({"insights": rows}), 200


@app.route('/api/insights/daily-scan', methods=['POST'])
@login_required
@require_active_subscription
def trigger_daily_insights_scan():
    user_id = current_user_id()
    payload = request.json or {}
    force = request_bool(payload.get("force"), default=False)
    if not force:
        rows = fetch_daily_insights(user_id)
        return jsonify({
            "ran": False,
            "insights": rows,
        }), 200

    try:
        rows, ran = run_daily_insights_scan(user_id, force=force)
    except Exception as exc:
        print("Daily insights scan error:", exc)
        rows = fetch_daily_insights(user_id)
        ran = False

    return jsonify({
        "ran": ran,
        "insights": rows,
    }), 200


@app.route('/api/insights/<int:insight_id>/resolve', methods=['POST'])
@login_required
@require_active_subscription
def resolve_daily_insight(insight_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        UPDATE insights
        SET status = 'resolved',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
          AND user_id = %s
    """, (insight_id, current_user_id()))

    if cur.rowcount == 0:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({"error": "Insight not found"}), 404

    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"message": "Insight resolved"}), 200


@app.route('/api/money-coach/insights/<int:insight_id>/resolve', methods=['POST'])
@login_required
@require_active_subscription
def resolve_money_coach_insight(insight_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        UPDATE money_coach_insights
        SET status = 'resolved',
            resolved_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
          AND user_id = %s
    """, (insight_id, current_user_id()))

    if cur.rowcount == 0:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({"error": "Insight not found"}), 404

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "Insight resolved"}), 200


@app.route('/api/investment-copilot', methods=['POST'])
@login_required
def investment_copilot():
    data = request.json or {}
    question = (data.get('question') or '').strip()
    holdings = data.get('holdings') or []
    goals = data.get('goals') or []
    alerts = data.get('alerts') or []

    if not question:
        return jsonify({"error": "Question is required"}), 400

    prompt = f"""
You are the AI Investment Copilot inside FinTrack.

Use ONLY the user's portfolio data below. Do not invent holdings, prices, goals, or returns.
Give a direct, practical answer. This is educational guidance, not financial advice.
If the user asks whether to sell, answer with a clear stance like "wait", "review", or "trim carefully" and explain why.
Keep the answer short and decision-focused.

User question:
{question}

Current holdings:
{holdings}

Goals:
{goals}

Current portfolio alerts:
{alerts}

Answer with exactly:
Short answer:
[1-2 lines]

Why:
[2-3 bullets]

Next move:
[1-2 actions]
"""

    try:
        response = create_claude_message(
            user_id=current_user_id(),
            system_text="You are a careful portfolio copilot. Be practical, concise, and avoid jargon. Do not provide guarantees.",
            prompt_text=prompt,
            max_tokens=420,
        )

        return jsonify({"answer": extract_claude_text(response)})
    except Exception as e:
        print("Investment Copilot error:", e)
        return jsonify({
            "answer": "Short answer:\nReview before acting.\n\nWhy:\n- I can see your holdings, but the AI service is unavailable right now.\n- Use allocation, performance, risk, and tax panels before making a sell decision.\n\nNext move:\nCheck concentration, tax impact, and upcoming earnings before trading."
        })

# ══════════════════════════════════════
#  RECURRING PAYMENTS
# ══════════════════════════════════════

def normalize_recurring_amount(raw_amount, payment_type=None):
    try:
        amount = Decimal(str(raw_amount))
    except (InvalidOperation, TypeError):
        return None

    normalized_type = (payment_type or '').strip().lower()

    if normalized_type == 'expense':
        return -abs(amount)

    if normalized_type == 'income':
        return abs(amount)

    return amount


def repair_recurring_transaction_signs(cur, user_id):
    cur.execute("""
        UPDATE transactions t
        SET amount = CASE
                WHEN rp.amount < 0 THEN -ABS(t.amount)
                ELSE ABS(t.amount)
            END,
            category = rp.category
        FROM recurring_payments rp
        WHERE t.source = 'recurring'
          AND t.user_id = %s
          AND rp.user_id = %s
          AND LOWER(t.name) = LOWER(rp.name)
          AND LOWER(t.account) = LOWER(rp.account)
          AND ABS(t.amount) = ABS(rp.amount)
          AND (
              (rp.amount < 0 AND t.amount > 0)
              OR (rp.amount > 0 AND t.amount < 0)
              OR LOWER(COALESCE(t.category, '')) <> LOWER(COALESCE(rp.category, ''))
          )
    """, (user_id, user_id))


SUBSCRIPTION_SUMMARY_CACHE = {}
SUBSCRIPTION_SUMMARY_TTL_HOURS = env_int("SUBSCRIPTION_SUMMARY_TTL_HOURS", 6)

SUBSCRIPTION_FREQUENCY_BUCKETS = [
    ("weekly",    5,   9,   4.345),
    ("biweekly",  12,  16,  2.172),
    ("monthly",   27,  33,  1.0),
    ("quarterly", 85,  95,  1.0 / 3.0),
    ("yearly",    355, 375, 1.0 / 12.0),
]

_SUBSCRIPTION_NAME_NOISE_RE = re.compile(r"[\W_]+", re.UNICODE)


def _normalize_subscription_name(raw):
    cleaned = _SUBSCRIPTION_NAME_NOISE_RE.sub(" ", str(raw or "")).strip().lower()
    return cleaned[:64]


def _display_subscription_name(raw):
    raw = str(raw or "").strip()
    if not raw:
        return "Unnamed merchant"
    # Preserve the user's casing if it looks intentional; otherwise title-case.
    if raw == raw.lower() or raw == raw.upper():
        return raw.title()
    return raw


def _classify_subscription_frequency(gaps_days):
    """Return (frequency_label, monthly_multiplier) for a list of gap-day values,
    or (None, None) if no bucket matches consistently."""
    if not gaps_days:
        return None, None

    sorted_gaps = sorted(gaps_days)
    median_gap = sorted_gaps[len(sorted_gaps) // 2]

    for label, low, high, monthly_multiplier in SUBSCRIPTION_FREQUENCY_BUCKETS:
        if low <= median_gap <= high:
            in_band = sum(1 for g in gaps_days if low <= g <= high)
            if in_band / len(gaps_days) >= 0.6:
                return label, monthly_multiplier
    return None, None


def detect_subscription_candidates(user_id, lookback_days=180):
    """Scan the user's expense transactions and surface candidates that look
    like real subscriptions: same-ish merchant, same-ish amount, regular cadence.
    Returns a list of dicts ready to send to the frontend. Pure deterministic —
    no AI here."""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT id, name, amount, category, account, date
        FROM transactions
        WHERE user_id = %s
          AND amount < 0
          AND date >= CURRENT_DATE - (%s || ' days')::interval
        ORDER BY name ASC, date ASC
    """, (user_id, str(lookback_days)))
    rows = cur.fetchall()

    cur.execute("""
        SELECT LOWER(TRIM(name)) AS normalized_name
        FROM recurring_payments
        WHERE user_id = %s
          AND is_active = TRUE
    """, (user_id,))
    known_recurring_names = {
        (row.get("normalized_name") or "").strip()
        for row in cur.fetchall()
        if row.get("normalized_name")
    }

    cur.close()
    conn.close()

    # Bucket by normalized merchant + similar amount.
    buckets = {}
    for row in rows:
        amount = abs(float(row.get("amount") or 0))
        if amount <= 0:
            continue
        norm_name = _normalize_subscription_name(row.get("name"))
        if not norm_name:
            continue
        # Round amount to nearest dollar to group near-identical charges.
        amount_key = round(amount)
        key = (norm_name, amount_key)
        buckets.setdefault(key, []).append({
            "raw_name": row.get("name"),
            "amount": amount,
            "category": row.get("category"),
            "account": row.get("account"),
            "date": row.get("date"),
        })

    today = date.today()
    candidates = []

    for (norm_name, _amount_key), entries in buckets.items():
        if len(entries) < 2:
            continue

        entries.sort(key=lambda item: item["date"])
        gaps = [
            (entries[i]["date"] - entries[i - 1]["date"]).days
            for i in range(1, len(entries))
        ]
        gaps = [g for g in gaps if g > 0]
        frequency, monthly_multiplier = _classify_subscription_frequency(gaps)
        if not frequency:
            continue

        amounts = [item["amount"] for item in entries]
        median_amount = sorted(amounts)[len(amounts) // 2]

        last_charge = entries[-1]["date"]
        first_charge = entries[0]["date"]
        days_since_last_charge = (today - last_charge).days
        monthly_cost = round(median_amount * monthly_multiplier, 2)
        display_name = _display_subscription_name(entries[-1]["raw_name"])

        candidates.append({
            "merchant": display_name,
            "merchant_key": norm_name,
            "amount": round(median_amount, 2),
            "frequency": frequency,
            "monthly_cost": monthly_cost,
            "occurrences": len(entries),
            "first_seen": first_charge.isoformat() if hasattr(first_charge, "isoformat") else str(first_charge),
            "last_seen": last_charge.isoformat() if hasattr(last_charge, "isoformat") else str(last_charge),
            "days_since_last_charge": days_since_last_charge,
            "category": entries[-1].get("category") or "",
            "account": entries[-1].get("account") or "",
            "already_tracked": norm_name in known_recurring_names,
        })

    candidates.sort(key=lambda item: item["monthly_cost"], reverse=True)
    return candidates


SUPPORTED_SUMMARY_LANGS = {"en", "fr", "es"}


def _normalize_summary_lang(value):
    lang = (str(value or "en").strip().lower())[:2]
    return lang if lang in SUPPORTED_SUMMARY_LANGS else "en"


def _subscription_summary_cache_get(user_id, lang):
    record = SUBSCRIPTION_SUMMARY_CACHE.get((user_id, lang))
    if not record:
        return None
    saved_at, payload = record
    if (datetime.utcnow() - saved_at) > timedelta(hours=SUBSCRIPTION_SUMMARY_TTL_HOURS):
        return None
    return payload


def _subscription_summary_cache_set(user_id, lang, payload):
    SUBSCRIPTION_SUMMARY_CACHE[(user_id, lang)] = (datetime.utcnow(), payload)


_SUBSCRIPTION_RULE_TEMPLATES = {
    "en": {
        "empty": (
            "We did not detect any recurring same-amount charges in the last 6 months. "
            "Import more transactions or wait for another billing cycle to see subscriptions here."
        ),
        "totals_one": "You have about {n} subscription totaling ~{currency} {total}/mo.",
        "totals_many": "You have about {n} subscriptions totaling ~{currency} {total}/mo.",
        "stale": "'{name}' ({currency} {amount}) was last charged {days} days ago — review whether you still use it.",
        "stale_one": "'{name}' ({currency} {amount}) was last charged 1 day ago — review whether you still use it.",
    },
    "fr": {
        "empty": (
            "Nous n'avons détecté aucun prélèvement récurrent du même montant au cours des 6 derniers mois. "
            "Importez plus de transactions ou attendez le prochain cycle de facturation pour voir vos abonnements ici."
        ),
        "totals_one": "Vous avez environ {n} abonnement pour un total d'environ {currency} {total}/mois.",
        "totals_many": "Vous avez environ {n} abonnements pour un total d'environ {currency} {total}/mois.",
        "stale": "« {name} » ({currency} {amount}) a été prélevé pour la dernière fois il y a {days} jours — vérifiez si vous l'utilisez toujours.",
        "stale_one": "« {name} » ({currency} {amount}) a été prélevé pour la dernière fois il y a 1 jour — vérifiez si vous l'utilisez toujours.",
    },
    "es": {
        "empty": (
            "No detectamos cargos recurrentes del mismo importe en los últimos 6 meses. "
            "Importa más transacciones o espera al próximo ciclo de facturación para ver tus suscripciones aquí."
        ),
        "totals_one": "Tienes alrededor de {n} suscripción por un total de ~{currency} {total}/mes.",
        "totals_many": "Tienes alrededor de {n} suscripciones por un total de ~{currency} {total}/mes.",
        "stale": "«{name}» ({currency} {amount}) se cobró por última vez hace {days} días — revisa si todavía la usas.",
        "stale_one": "«{name}» ({currency} {amount}) se cobró por última vez hace 1 día — revisa si todavía la usas.",
    },
}


def _subscription_rule_summary(candidates, total_monthly, total_active, lang="en", stale_threshold_days=60, currency=None):
    tpl = _SUBSCRIPTION_RULE_TEMPLATES.get(lang, _SUBSCRIPTION_RULE_TEMPLATES["en"])
    currency = currency or DEFAULT_CURRENCY

    if not candidates:
        return tpl["empty"]

    totals_tpl = tpl["totals_one"] if total_active == 1 else tpl["totals_many"]
    parts = [totals_tpl.format(
        n=total_active,
        currency=currency,
        total=f"{total_monthly:,.2f}",
    )]

    stale = [c for c in candidates if c["days_since_last_charge"] >= stale_threshold_days]
    if stale:
        top = stale[0]
        days = int(top["days_since_last_charge"])
        stale_tpl = tpl["stale_one"] if days == 1 else tpl["stale"]
        parts.append(stale_tpl.format(
            name=top["merchant"],
            currency=currency,
            amount=f"{top['amount']:,.2f}",
            days=days,
        ))
    return " ".join(parts)


_SUBSCRIPTION_AI_LANG_INSTRUCTION = {
    "en": "Respond in English.",
    "fr": "Réponds en français. Le paragraphe entier doit être en français naturel et clair.",
    "es": "Responde en español. Todo el párrafo debe estar en español natural y claro.",
}


def generate_subscription_summary(user_id, candidates, lang="en", force=False):
    """One short paragraph summarizing the user's subscription picture. Cached
    per (user, language) for SUBSCRIPTION_SUMMARY_TTL_HOURS to avoid burning
    Claude tokens on every page load."""
    lang = _normalize_summary_lang(lang)
    currency = get_user_currency(user_id)
    total_active = len(candidates)
    total_monthly = round(sum(c["monthly_cost"] for c in candidates), 2)

    rule_summary = _subscription_rule_summary(candidates, total_monthly, total_active, lang=lang, currency=currency)

    if not force:
        cached = _subscription_summary_cache_get(user_id, lang)
        if (
            cached
            and cached.get("currency") == currency
            and cached.get("active_count") == total_active
            and abs(cached.get("total_monthly", 0) - total_monthly) < 0.01
        ):
            return cached["summary"], "cached"
        return rule_summary, "rule"

    if not candidates:
        return rule_summary, "rule"

    trimmed = [
        {
            "merchant": c["merchant"],
            "amount": c["amount"],
            "frequency": c["frequency"],
            "monthly_cost": c["monthly_cost"],
            "occurrences": c["occurrences"],
            "days_since_last_charge": c["days_since_last_charge"],
            "last_seen": c["last_seen"],
        }
        for c in candidates[:12]
    ]

    lang_instruction = _SUBSCRIPTION_AI_LANG_INSTRUCTION.get(lang, _SUBSCRIPTION_AI_LANG_INSTRUCTION["en"])

    prompt = f"""You are FinTrack's subscription detector.

Write a single short paragraph (max 60 words) helping the user audit their subscriptions.
Use ONLY the data below — do not invent merchants, amounts, or usage signals.

Rules:
- Open with the count and approximate monthly total.
- Call out at most one specific subscription that looks unused (days_since_last_charge >= 60), naming it and its amount.
- If nothing looks unused, encourage the user to review the most expensive one instead.
- Plain language, no emojis, no bullet lists.
- Currency: {currency}.
- {lang_instruction}

Detected subscriptions:
{json.dumps(trimmed, default=str)}

Totals:
- active_count: {total_active}
- total_monthly: {total_monthly}
"""

    try:
        ai_text = call_money_coach_ai(
            system_text="You write concise, grounded subscription audit summaries. You never invent merchants or numbers. You always respond in the language the user requests.",
            user_text=prompt,
            max_tokens=400,
            user_id=user_id,
        )
        ai_text = (ai_text or "").strip()
        if not ai_text:
            raise ValueError("Empty subscription summary from AI")

        _subscription_summary_cache_set(user_id, lang, {
            "summary": ai_text,
            "active_count": total_active,
            "total_monthly": total_monthly,
            "currency": currency,
        })
        return ai_text, "ai"
    except Exception as exc:
        print("Subscription summary AI error:", exc)
        _subscription_summary_cache_set(user_id, lang, {
            "summary": rule_summary,
            "active_count": total_active,
            "total_monthly": total_monthly,
            "currency": currency,
        })
        return rule_summary, "rule"


@app.route('/api/subscriptions/detected', methods=['GET'])
@login_required
def get_detected_subscriptions():
    user_id = current_user_id()
    force = request_bool(request.args.get("force"), default=False)
    lang = _normalize_summary_lang(request.args.get("lang"))
    stale_days_param = request.args.get("stale_days")
    try:
        stale_days = max(7, int(stale_days_param)) if stale_days_param else 60
    except (TypeError, ValueError):
        stale_days = 60

    candidates = detect_subscription_candidates(user_id)
    summary, summary_mode = generate_subscription_summary(user_id, candidates, lang=lang, force=force)

    total_active = len(candidates)
    total_monthly = round(sum(c["monthly_cost"] for c in candidates), 2)

    cancel_candidates = [
        c for c in candidates if c["days_since_last_charge"] >= stale_days
    ]

    return jsonify({
        "subscriptions": candidates,
        "cancel_candidates": cancel_candidates,
        "summary": summary,
        "summary_mode": summary_mode,
        "active_count": total_active,
        "total_monthly": total_monthly,
        "currency": get_user_currency(user_id),
        "stale_threshold_days": stale_days,
    }), 200


@app.route('/api/recurring', methods=['GET'])
@login_required
def get_recurring():
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        DELETE FROM recurring_payments rp
        USING recurring_payments keep
        WHERE rp.id > keep.id
          AND rp.user_id = %s
          AND keep.user_id = %s
          AND LOWER(rp.name) = LOWER(keep.name)
          AND rp.amount = keep.amount
          AND LOWER(rp.category) = LOWER(keep.category)
          AND LOWER(rp.account) = LOWER(keep.account)
          AND LOWER(rp.frequency) = LOWER(keep.frequency)
          AND rp.next_date = keep.next_date
    """, (current_user_id(), current_user_id()))
    conn.commit()

    repair_recurring_transaction_signs(cur, current_user_id())
    conn.commit()

    cur.execute("""
        SELECT *
             , (
                   last_paid_at IS NOT NULL
                   AND next_date > CURRENT_DATE
               ) AS completed_this_cycle
        FROM recurring_payments
        WHERE user_id = %s
        ORDER BY next_date ASC
    """, (current_user_id(),))

    rows = cur.fetchall()
    cur.close()
    conn.close()

    return jsonify(rows)


@app.route('/api/recurring', methods=['POST'])
@login_required
def add_recurring():
    data = request.json or {}

    name = (data.get('name') or '').strip()
    amount = normalize_recurring_amount(data.get('amount'), data.get('type'))
    category = (data.get('category') or 'Other').strip()
    account = (data.get('account') or 'Recurring').strip()
    frequency = (data.get('frequency') or 'monthly').strip()
    next_date = data.get('next_date')

    if not name or amount is None or not next_date:
        return jsonify({"error": "Name, amount, and next date are required"}), 400

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT id
        FROM recurring_payments
        WHERE LOWER(name) = LOWER(%s)
          AND user_id = %s
          AND amount = %s
          AND LOWER(category) = LOWER(%s)
          AND LOWER(account) = LOWER(%s)
          AND LOWER(frequency) = LOWER(%s)
          AND next_date = %s
        ORDER BY id ASC
    """, (
        name,
        current_user_id(),
        amount,
        category,
        account,
        frequency,
        next_date
    ))

    existing_rows = cur.fetchall()

    if existing_rows:
        keep_id = existing_rows[0]["id"]
        duplicate_ids = [row["id"] for row in existing_rows[1:]]

        if duplicate_ids:
            cur.execute("""
                DELETE FROM recurring_payments
                WHERE id = ANY(%s)
                  AND user_id = %s
            """, (duplicate_ids, current_user_id()))
            conn.commit()

        cur.close()
        conn.close()

        return jsonify({
            "message": "Recurring payment already exists",
            "id": keep_id,
            "mode": "existing",
            "merged_duplicates": len(duplicate_ids)
        }), 200

    cur.execute("""
        INSERT INTO recurring_payments
            (user_id, name, amount, category, account, frequency, next_date, is_active)
        VALUES
            (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        current_user_id(),
        name,
        amount,
        category,
        account,
        frequency,
        next_date,
        True
    ))

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "Recurring payment created"}), 201


@app.route('/api/recurring/<int:recurring_id>', methods=['PUT'])
@login_required
def update_recurring(recurring_id):
    data = request.json or {}

    name = (data.get('name') or '').strip()
    amount = normalize_recurring_amount(data.get('amount'), data.get('type'))
    category = (data.get('category') or 'Other').strip()
    account = (data.get('account') or 'Recurring').strip()
    frequency = (data.get('frequency') or 'monthly').strip()
    next_date = data.get('next_date')

    if not name or amount is None or not next_date:
        return jsonify({"error": "Name, amount, and next date are required"}), 400

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        UPDATE recurring_payments
        SET name = %s,
            amount = %s,
            category = %s,
            account = %s,
            frequency = %s,
            next_date = %s
        WHERE id = %s
          AND user_id = %s
        RETURNING *
    """, (
        name,
        amount,
        category,
        account,
        frequency,
        next_date,
        recurring_id,
        current_user_id()
    ))

    updated = cur.fetchone()

    if not updated:
        cur.close()
        conn.close()
        return jsonify({"error": "Recurring payment not found"}), 404

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({
        "message": "Recurring payment updated",
        "recurring": updated
    }), 200


@app.route('/api/recurring/<int:recurring_id>', methods=['DELETE'])
@login_required
def delete_recurring(recurring_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("DELETE FROM recurring_payments WHERE id = %s AND user_id = %s", (recurring_id, current_user_id()))

    if cur.rowcount == 0:
        cur.close()
        conn.close()
        return jsonify({"error": "Recurring payment not found"}), 404

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "Recurring payment deleted"}), 200


@app.route('/api/recurring/<int:recurring_id>/history', methods=['GET'])
@login_required
def get_recurring_history(recurring_id):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT id
        FROM recurring_payments
        WHERE id = %s
          AND user_id = %s
    """, (recurring_id, current_user_id()))

    if not cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({"error": "Recurring payment not found"}), 404

    cur.execute("""
        SELECT
            rph.id,
            rph.amount,
            rph.paid_for_date,
            rph.action_type,
            rph.created_at,
            t.name AS transaction_name,
            t.category AS transaction_category,
            t.account AS transaction_account
        FROM recurring_payment_history rph
        LEFT JOIN transactions t
          ON t.id = rph.transaction_id
         AND t.user_id = rph.user_id
        WHERE rph.user_id = %s
          AND rph.recurring_id = %s
        ORDER BY rph.paid_for_date DESC, rph.created_at DESC
    """, (current_user_id(), recurring_id))

    rows = cur.fetchall()
    cur.close()
    conn.close()

    return jsonify(rows), 200


@app.route('/api/recurring/<int:recurring_id>/mark-paid', methods=['POST'])
@login_required
def mark_recurring_paid(recurring_id):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT *,
               (next_date <= (CURRENT_DATE + INTERVAL '7 days')::date) AS is_due_soon
        FROM recurring_payments
        WHERE id = %s
          AND user_id = %s
    """, (recurring_id, current_user_id()))
    item = cur.fetchone()

    if not item:
        cur.close()
        conn.close()
        return jsonify({"error": "Recurring payment not found"}), 404

    if not item.get("is_due_soon"):
        cur.close()
        conn.close()
        return jsonify({"error": "Recurring payment is not due yet"}), 400

    transaction_amount = normalize_recurring_amount(item["amount"])

    if transaction_amount is None:
        cur.close()
        conn.close()
        return jsonify({"error": "Recurring payment amount is invalid"}), 400

    paid_for_date = item["next_date"]

    cur.execute("""
        SELECT id
        FROM recurring_payment_history
        WHERE user_id = %s
          AND recurring_id = %s
          AND paid_for_date = %s
        LIMIT 1
    """, (current_user_id(), recurring_id, paid_for_date))

    if cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({
            "message": "Recurring item already recorded for this cycle",
            "mode": "already_recorded"
        }), 200

    # Create real transaction
    cur.execute("""
        INSERT INTO transactions (user_id, name, amount, category, account, date, source)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        current_user_id(),
        item["name"],
        transaction_amount,
        item["category"],
        item["account"],
        item["next_date"],
        "recurring"
    ))
    transaction = cur.fetchone()

    # Calculate next due date
    frequency = (item["frequency"] or "monthly").lower()

    if frequency == "weekly":
        interval = "7 days"
    elif frequency == "biweekly":
        interval = "14 days"
    elif frequency == "yearly":
        interval = "1 year"
    else:
        interval = "1 month"

    cur.execute("""
        INSERT INTO recurring_payment_history
            (user_id, recurring_id, transaction_id, amount, paid_for_date, action_type)
        VALUES
            (%s, %s, %s, %s, %s, %s)
    """, (
        current_user_id(),
        recurring_id,
        transaction["id"] if transaction else None,
        transaction_amount,
        paid_for_date,
        "received" if transaction_amount > 0 else "paid"
    ))

    cur.execute("""
        UPDATE recurring_payments
        SET next_date = next_date + %s::interval,
            last_paid_at = CURRENT_TIMESTAMP,
            last_paid_for_date = %s
        WHERE id = %s
          AND user_id = %s
    """, (interval, paid_for_date, recurring_id, current_user_id()))

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "Recurring item marked successfully"}), 200


# ══════════════════════════════════════
#  NIGHTLY INSIGHTS SCHEDULER (APScheduler)
# ══════════════════════════════════════

INSIGHTS_CRON_ENABLED = env_bool("INSIGHTS_CRON_ENABLED", True)
INSIGHTS_CRON_HOUR = env_int("INSIGHTS_CRON_HOUR", 5)
INSIGHTS_CRON_MINUTE = env_int("INSIGHTS_CRON_MINUTE", 30)
INSIGHTS_CRON_USER_LIMIT = env_int("INSIGHTS_CRON_USER_LIMIT", 500)
INSIGHTS_CRON_TIMEZONE = os.getenv("INSIGHTS_CRON_TIMEZONE", "UTC")
INSIGHTS_CRON_ADMIN_TOKEN = os.getenv("INSIGHTS_CRON_ADMIN_TOKEN", "")
TRIAL_EMAILS_ENABLED = env_bool("TRIAL_EMAILS_ENABLED", True)
TRIAL_EMAILS_USER_LIMIT = env_int("TRIAL_EMAILS_USER_LIMIT", 500)

_insights_scheduler = None


def _trial_email_user_rows():
    conn = None
    cur = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT id, email, name, first_name, last_name, preferred_currency,
                   subscription_status, trial_started_at, trial_ends_at,
                   stripe_customer_id, stripe_subscription_id, created_at,
                   CASE
                       WHEN trial_ends_at > NOW()
                        AND trial_ends_at <= NOW() + INTERVAL '3 days'
                        THEN 'trial_decision'
                       WHEN trial_ends_at <= NOW()
                        AND trial_ends_at >= NOW() - INTERVAL '7 days'
                        THEN 'trial_ended'
                   END AS email_event
            FROM users
            WHERE subscription_status = 'trial'
              AND trial_ends_at IS NOT NULL
              AND (
                    (trial_ends_at > NOW() AND trial_ends_at <= NOW() + INTERVAL '3 days')
                 OR (trial_ends_at <= NOW() AND trial_ends_at >= NOW() - INTERVAL '7 days')
              )
            ORDER BY trial_ends_at ASC
            LIMIT %s
        """, (TRIAL_EMAILS_USER_LIMIT,))
        return [dict(row) for row in cur.fetchall()]
    except Exception as exc:
        print("[email-cron] trial email query failed:", exc)
        return []
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def run_trial_email_job():
    if not TRIAL_EMAILS_ENABLED:
        return {"sent": 0, "skipped": 0, "failed": 0, "disabled": True}

    started = datetime.utcnow()
    sent = 0
    skipped = 0
    failed = 0

    for user in _trial_email_user_rows():
        event = user.get("email_event")
        if event == "trial_decision":
            result = send_transactional_email_once(user, "trial_decision", trial_decision_email)
        elif event == "trial_ended":
            result = send_transactional_email_once(user, "trial_ended", trial_ended_email)
        else:
            skipped += 1
            continue

        if result.get("status") == "sent":
            sent += 1
        elif result.get("status") == "failed":
            failed += 1
        else:
            skipped += 1

    elapsed = (datetime.utcnow() - started).total_seconds()
    print(f"[email-cron] trial emails sent={sent} skipped={skipped} failed={failed} in {elapsed:.1f}s")
    return {"sent": sent, "skipped": skipped, "failed": failed, "elapsed_seconds": elapsed}


def _nightly_eligible_user_ids():
    """Return ids of users we should refresh insights for nightly:
    everyone who has logged in or had any activity in the last 30 days."""
    conn = None
    cur = None
    try:
        conn = get_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT u.id
            FROM users u
            WHERE EXISTS (
                SELECT 1 FROM transactions t
                WHERE t.user_id = u.id
                  AND t.date >= CURRENT_DATE - INTERVAL '30 days'
            )
               OR EXISTS (
                SELECT 1 FROM money_coach_history h
                WHERE h.user_id = u.id
                  AND h.created_at >= NOW() - INTERVAL '30 days'
            )
            ORDER BY u.id
            LIMIT %s
        """, (INSIGHTS_CRON_USER_LIMIT,))
        return [row["id"] for row in cur.fetchall()]
    except Exception as exc:
        print("Nightly insights eligible-users query failed:", exc)
        return []
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def run_nightly_insights_job():
    """Refresh proactive insights for every active user.
    Designed to be idempotent — each per-user call respects the cooldown set in
    MONEY_COACH_DAILY_SCAN_COOLDOWN_HOURS unless force=True. We pass force=True
    here since this IS the nightly refresh."""
    started = datetime.utcnow()
    user_ids = _nightly_eligible_user_ids()
    if not user_ids:
        print(f"[insights-cron] no eligible users at {started.isoformat()}Z")
        return {"ran": 0, "skipped": 0, "errors": 0}

    ran = 0
    skipped = 0
    errors = 0

    for user_id in user_ids:
        try:
            result = run_proactive_daily_scan(user_id, force=True)
            if result is None:
                skipped += 1
            else:
                ran += 1
            # Best-effort: keep the deterministic rule-based insights fresh too.
            try:
                sync_money_coach_insights(user_id, build_money_coach_insight_context(user_id))
            except Exception as exc:
                print(f"[insights-cron] rule-based sync failed for user {user_id}:", exc)
        except Exception as exc:
            errors += 1
            print(f"[insights-cron] scan failed for user {user_id}:", exc)

    elapsed = (datetime.utcnow() - started).total_seconds()
    print(
        f"[insights-cron] done in {elapsed:.1f}s — "
        f"users={len(user_ids)} ran={ran} skipped={skipped} errors={errors}"
    )
    return {"ran": ran, "skipped": skipped, "errors": errors, "elapsed_seconds": elapsed}


def start_insights_scheduler():
    """Boot the BackgroundScheduler exactly once per process.
    Flask's debug reloader spawns a parent + child process; only the child
    (WERKZEUG_RUN_MAIN=true) should run jobs to avoid double-firing."""
    global _insights_scheduler

    if not INSIGHTS_CRON_ENABLED and not TRIAL_EMAILS_ENABLED:
        print("[scheduler] disabled via INSIGHTS_CRON_ENABLED=false and TRIAL_EMAILS_ENABLED=false")
        return None

    debug_mode = env_bool("FLASK_DEBUG", not IS_PRODUCTION)
    if debug_mode and os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        # We are in the parent reloader process; the child will start the scheduler.
        return None

    if _insights_scheduler is not None:
        return _insights_scheduler

    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
    except ImportError:
        print("[insights-cron] APScheduler not installed; nightly insights are disabled")
        return None

    scheduler = BackgroundScheduler(timezone=INSIGHTS_CRON_TIMEZONE)

    if INSIGHTS_CRON_ENABLED:
        scheduler.add_job(
            run_nightly_insights_job,
            CronTrigger(hour=INSIGHTS_CRON_HOUR, minute=INSIGHTS_CRON_MINUTE),
            id="nightly_insights",
            name="FinTrack nightly insights refresh",
            replace_existing=True,
            coalesce=True,
            max_instances=1,
            misfire_grace_time=60 * 30,
        )

    if TRIAL_EMAILS_ENABLED:
        scheduler.add_job(
            run_trial_email_job,
            CronTrigger(hour=9, minute=0),
            id="trial_emails",
            name="FinTrack trial lifecycle emails",
            replace_existing=True,
            coalesce=True,
            max_instances=1,
            misfire_grace_time=60 * 30,
        )

    scheduler.start()
    _insights_scheduler = scheduler

    import atexit
    atexit.register(lambda: scheduler.shutdown(wait=False))

    print(
        f"[scheduler] scheduled jobs in {INSIGHTS_CRON_TIMEZONE}: "
        f"insights={'on' if INSIGHTS_CRON_ENABLED else 'off'}, "
        f"trial_emails={'on' if TRIAL_EMAILS_ENABLED else 'off'}"
    )
    return scheduler


@app.route('/api/admin/run-nightly-insights', methods=['POST'])
def admin_run_nightly_insights():
    """Manual trigger for testing / disaster recovery. Protected by a shared
    token (INSIGHTS_CRON_ADMIN_TOKEN). Returns the job summary."""
    if not INSIGHTS_CRON_ADMIN_TOKEN:
        return jsonify({"error": "Admin token is not configured on this server."}), 503
    provided = request.headers.get("X-Admin-Token") or (request.get_json(silent=True) or {}).get("token")
    if provided != INSIGHTS_CRON_ADMIN_TOKEN:
        return jsonify({"error": "Forbidden"}), 403
    summary = run_nightly_insights_job()
    return jsonify(summary), 200


@app.route('/api/admin/run-trial-emails', methods=['POST'])
def admin_run_trial_emails():
    if not INSIGHTS_CRON_ADMIN_TOKEN:
        return jsonify({"error": "Admin token is not configured on this server."}), 503
    provided = request.headers.get("X-Admin-Token") or (request.get_json(silent=True) or {}).get("token")
    if provided != INSIGHTS_CRON_ADMIN_TOKEN:
        return jsonify({"error": "Forbidden"}), 403
    summary = run_trial_email_job()
    return jsonify(summary), 200


# ── RUN ──
backfill_email_canonical()
start_insights_scheduler()

if __name__ == '__main__':
    app.run(
        debug=env_bool("FLASK_DEBUG", not IS_PRODUCTION),
        host=os.getenv("FLASK_HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "5001"))
    )
