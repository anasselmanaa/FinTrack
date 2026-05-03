from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, current_user, login_required, login_user, logout_user
from database import get_connection, init_db
from psycopg2.extras import RealDictCursor
from pathlib import Path
from dotenv import load_dotenv
from groq import Groq
from decimal import Decimal, InvalidOperation
import bcrypt
import pandas as pd
import io
import json
import os

load_dotenv(Path(__file__).with_name(".env"))

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("Missing GROQ_API_KEY in backend/.env")

groq_client = Groq(api_key=GROQ_API_KEY)
app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-me")
CORS(app, resources={r"/api/*": {"origins": "*"}, r"/auth/*": {"origins": "*"}}, supports_credentials=True)
DEV_AUTO_LOGIN = os.getenv("FINTRACK_DEV_AUTO_LOGIN", "true").lower() == "true"
DEV_USER_EMAIL = os.getenv("FINTRACK_DEV_USER_EMAIL", "dev@fintrack.local")

login_manager = LoginManager()
login_manager.init_app(app)


class User(UserMixin):
    def __init__(self, row):
        self.id = str(row["id"])
        self.email = row["email"]
        self.name = row["name"]
        self.subscription_status = row.get("subscription_status", "trial")
        self.trial_started_at = row.get("trial_started_at")
        self.created_at = row.get("created_at")


@login_manager.user_loader
def load_user(user_id):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, email, name, subscription_status, trial_started_at, created_at
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


def public_user_payload(row):
    return {
        "id": row["id"],
        "email": row["email"],
        "name": row["name"],
        "subscription_status": row.get("subscription_status", "trial"),
        "trial_started_at": row.get("trial_started_at"),
        "created_at": row.get("created_at"),
    }


def ensure_dev_user():
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, email, name, subscription_status, trial_started_at, created_at
        FROM users
        WHERE email = %s
    """, (DEV_USER_EMAIL,))
    user = cur.fetchone()

    if not user:
        password_hash = bcrypt.hashpw(os.urandom(24), bcrypt.gensalt()).decode('utf-8')
        cur.execute("""
            INSERT INTO users (name, email, password_hash)
            VALUES (%s, %s, %s)
            RETURNING id, email, name, subscription_status, trial_started_at, created_at
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
    if not DEV_AUTO_LOGIN:
        return

    if not request.path.startswith("/api/"):
        return

    if current_user.is_authenticated:
        return

    user = ensure_dev_user()
    attach_orphan_demo_data(user["id"])
    login_user(User(user))


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

# ══════════════════════════════════════
#  AUTH
# ══════════════════════════════════════

@app.route('/auth/register', methods=['POST'])
def register():
    data = request.json or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not name or not email or not password:
        return jsonify({"error": "Name, email, and password are required"}), 400

    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT id FROM users WHERE email = %s", (email,))
    if cur.fetchone():
        cur.close()
        conn.close()
        return jsonify({"error": "Email is already registered"}), 409

    cur.execute("""
        INSERT INTO users (name, email, password_hash)
        VALUES (%s, %s, %s)
        RETURNING id, email, name, subscription_status, trial_started_at, created_at
    """, (name, email, password_hash))

    user = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "Registration successful", "user": public_user_payload(user)}), 201


@app.route('/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, email, password_hash, name, subscription_status, trial_started_at, created_at
        FROM users
        WHERE email = %s
    """, (email,))
    user = cur.fetchone()
    cur.close()
    conn.close()

    if not user or not bcrypt.checkpw(password.encode('utf-8'), user["password_hash"].encode('utf-8')):
        return jsonify({"error": "Invalid email or password"}), 401

    login_user(User(user))

    return jsonify({"message": "Login successful", "user": public_user_payload(user)}), 200


@app.route('/auth/logout', methods=['POST'])
def logout():
    logout_user()
    return jsonify({"message": "Logout successful"}), 200


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
            "created_at": current_user.created_at,
        }
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
                    AND LOWER(t.name) LIKE '%' || LOWER(TRIM(bp.match_keyword)) || '%'
                )
            )
            AND t.amount < 0
            AND t.user_id = %s
            AND t.date >= bp.period_start
            AND t.date <= (bp.period_start + ((bp.period_days - 1) * INTERVAL '1 day'))::date
        GROUP BY
            bp.id,
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

    return jsonify(rows)

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
                  OR LOWER(COALESCE(t.name, '')) LIKE '%' || LOWER(COALESCE(g.name, '')) || '%'
              )
              AND (
                  LOWER(COALESCE(t.account, '')) LIKE '%sav%'
                  OR LOWER(COALESCE(t.name, '')) LIKE '%saving%'
                  OR LOWER(COALESCE(t.category, '')) LIKE '%saving%'
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
                  OR LOWER(COALESCE(t.name, '')) LIKE '%' || LOWER(COALESCE(g.name, '')) || '%'
              )
              AND (
                  LOWER(COALESCE(t.account, '')) LIKE '%sav%'
                  OR LOWER(COALESCE(t.name, '')) LIKE '%saving%'
                  OR LOWER(COALESCE(t.category, '')) LIKE '%saving%'
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
    auto_link_savings = data.get('auto_link_savings')
    auto_link_savings = True if auto_link_savings is None else bool(auto_link_savings)

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
    auto_link_savings = data.get('auto_link_savings')
    auto_link_savings = True if auto_link_savings is None else bool(auto_link_savings)

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
            item.get("date") or "",
            item.get("created_at") or ""
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
              LOWER(COALESCE(account, '')) LIKE '%sav%'
              OR LOWER(COALESCE(name, '')) LIKE '%saving%'
              OR LOWER(COALESCE(category, '')) LIKE '%saving%'
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

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You are a concise personal finance coach. Give practical, specific, supportive advice."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.25,
            max_tokens=220
        )

        answer = (response.choices[0].message.content or "").strip()
        json_start = answer.find("{")
        json_end = answer.rfind("}")

        if json_start != -1 and json_end != -1:
            parsed = json.loads(answer[json_start:json_end + 1])
            cards = parsed.get("cards", [])
        else:
            cards = []

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
#  MONEY COACH — Groq AI
# ══════════════════════════════════════

@app.route('/api/money-coach', methods=['POST'])
@login_required
def money_coach():
    data = request.json or {}
    question = (data.get('question') or '').strip()

    if not question:
        return jsonify({"error": "Question is required"}), 400

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT name, amount, category, account, date
        FROM transactions
        WHERE user_id = %s
        ORDER BY date DESC
        LIMIT 80
    """, (current_user_id(),))
    transactions = cur.fetchall()

    cur.execute("""
        SELECT category, amount, start_date, days, created_at
        FROM budgets
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT 30
    """, (current_user_id(),))
    budgets = cur.fetchall()

    cur.close()
    conn.close()

    prompt = f"""
You are Money Coach inside FinTrack, a personal finance app.

Your job:
Give practical, specific advice using ONLY the user's FinTrack data below.

Important rules:
- Do not invent income, savings, budgets, or transactions.
- If the user asks "can I buy..." or "can I afford...", answer based on:
  1. available budget room
  2. overspent categories
  3. recent spending pressure
- If data is missing, say what is missing, but still give a useful cautious answer.
- If the user mentions a currency like RMB, CNY, USD, MAD, EUR, keep that currency in your answer.
- Do not convert currencies unless exchange rates are provided.
- Be clear and human, not robotic.
- Avoid saying "I don't have enough information" as the main answer unless absolutely necessary.
- Keep answers short unless user asks for deep analysis.
- Use natural everyday language.
- Never mention raw negative numbers like -3000. Say spent 3000 instead.
- Avoid repeating the same category name too many times.
- If user asks a yes/no buying question, start with yes / no / wait.
- Focus on decision-making, not generic warnings.
- Use a supportive tone like a premium advisor.

User question:
{question}

Recent transactions:
{transactions}

Budgets:
{budgets}

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
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You are a careful personal finance coach. You explain money clearly, practically, and without jargon."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.2,
            max_tokens=600
        )

        answer = response.choices[0].message.content

        return jsonify({
            "answer": answer
        })

    except Exception as e:
        print("Money Coach error:", e)
        return jsonify({
            "error": "Money Coach could not answer right now"
        }), 500


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
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You are a careful portfolio copilot. Be practical, concise, and avoid jargon. Do not provide guarantees."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.2,
            max_tokens=420
        )

        return jsonify({"answer": response.choices[0].message.content})
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


@app.route('/api/recurring/<int:recurring_id>/mark-paid', methods=['POST'])
@login_required
def mark_recurring_paid(recurring_id):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT * FROM recurring_payments WHERE id = %s AND user_id = %s", (recurring_id, current_user_id()))
    item = cur.fetchone()

    if not item:
        cur.close()
        conn.close()
        return jsonify({"error": "Recurring payment not found"}), 404

    transaction_amount = normalize_recurring_amount(item["amount"])

    if transaction_amount is None:
        cur.close()
        conn.close()
        return jsonify({"error": "Recurring payment amount is invalid"}), 400

    # Create real transaction
    cur.execute("""
        INSERT INTO transactions (user_id, name, amount, category, account, date, source)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (
        current_user_id(),
        item["name"],
        transaction_amount,
        item["category"],
        item["account"],
        item["next_date"],
        "recurring"
    ))

    # Calculate next due date
    if item["frequency"].lower() == "weekly":
        interval = "7 days"
    elif item["frequency"].lower() == "biweekly":
        interval = "14 days"
    elif item["frequency"].lower() == "yearly":
        interval = "1 year"
    else:
        interval = "1 month"

    cur.execute("""
        UPDATE recurring_payments
        SET next_date = next_date + %s::interval
        WHERE id = %s
          AND user_id = %s
    """, (interval, recurring_id, current_user_id()))

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "Recurring item marked successfully"}), 200

# ── RUN ──
if __name__ == '__main__':
    app.run(debug=True, port=5001)
