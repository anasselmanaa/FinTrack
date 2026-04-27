from flask import Flask, request, jsonify
from flask_cors import CORS
from database import get_connection, init_db
from psycopg2.extras import RealDictCursor
from pathlib import Path
from dotenv import load_dotenv
from groq import Groq
import pandas as pd
import io
import os

load_dotenv(Path(__file__).with_name(".env"))

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("Missing GROQ_API_KEY in backend/.env")

groq_client = Groq(api_key=GROQ_API_KEY)
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=False)

# ── START UP ──
init_db()

# ══════════════════════════════════════
#  TRANSACTIONS
# ══════════════════════════════════════

@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM transactions ORDER BY date DESC")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(rows)

@app.route('/api/transactions', methods=['POST'])
def add_transaction():
    data = request.json
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute("""
        INSERT INTO transactions (name, amount, category, account, date, source)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (data['name'], data['amount'], data['category'],
          data['account'], data['date'], data.get('source', 'manual')))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"message": "Transaction added!"}), 201

@app.route('/api/transactions/<int:tx_id>', methods=['DELETE'])
def delete_transaction(tx_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("DELETE FROM transactions WHERE id = %s", (tx_id,))
    deleted_count = cur.rowcount

    conn.commit()
    cur.close()
    conn.close()

    if deleted_count == 0:
        return jsonify({"error": "Transaction not found"}), 404

    return jsonify({"message": "Transaction deleted successfully"}), 200

@app.route('/api/transactions/<int:tx_id>', methods=['PUT'])
def update_transaction(tx_id):
    data = request.json

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
        WHERE id = %s
    """, (
        data['name'],
        data['amount'],
        data['category'],
        data['account'],
        data['date'],
        data.get('source', 'manual'),
        tx_id
    ))

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "Transaction updated!"})

@app.route('/api/transactions', methods=['DELETE'])
def delete_all_transactions():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("DELETE FROM transactions")
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
def upload_csv():
    file    = request.files['file']
    content = file.read().decode('utf-8-sig')  # handles BOM characters
    df      = pd.read_csv(io.StringIO(content))

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

    # Save to database
    conn = get_connection()
    cur  = conn.cursor()
    count = 0
    for tx in transactions:
        cur.execute("""
            INSERT INTO transactions (name, amount, category, account, date, source)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (tx['name'], tx['amount'], tx['category'],
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
    """)

    rows = cur.fetchall()
    cur.close()
    conn.close()

    return jsonify(rows)

@app.route('/api/budgets', methods=['POST'])
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
        ORDER BY id ASC
    """, (category, start_date, days))

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
        """, (
            amount,
            None,
            None,
            (data.get('match_keyword') or '').strip(),
            keep_id
        ))

        if duplicate_ids:
            cur.execute("""
                DELETE FROM budgets
                WHERE id = ANY(%s)
            """, (duplicate_ids,))

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
        INSERT INTO budgets (category, amount, start_date, days, month, year, match_keyword)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (
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
        WHERE id = %s
    """, (
        data['category'],
        data['amount'],
        data.get('start_date'),
        data.get('days', 30),
        None,
        None,
        (data.get('match_keyword') or '').strip(),
        budget_id
    ))

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "Budget updated!"}), 200

@app.route('/api/budgets/<int:budget_id>', methods=['DELETE'])
def delete_budget(budget_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("DELETE FROM budgets WHERE id = %s", (budget_id,))
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
def get_goals():
    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM goals ORDER BY deadline")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(rows)

@app.route('/api/goals', methods=['POST'])
def add_goal():
    data = request.json
    conn = get_connection()
    cur  = conn.cursor()
    cur.execute("""
        INSERT INTO goals (name, target_amount, saved_amount, deadline, icon)
        VALUES (%s, %s, %s, %s, %s)
    """, (data['name'], data['target_amount'],
          data.get('saved_amount', 0), data.get('deadline'), data.get('icon', '🎯')))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"message": "Goal created!"}), 201

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
def get_dashboard():
    conn = get_connection()
    cur  = conn.cursor(cursor_factory=RealDictCursor)

    # Total balance
    cur.execute("SELECT COALESCE(SUM(amount), 0) as total FROM transactions")
    total_balance = float(cur.fetchone()['total'])

    # Monthly income
    cur.execute("""
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE amount > 0
        AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE)
    """)
    monthly_income = float(cur.fetchone()['total'])

    # Monthly expenses
    cur.execute("""
        SELECT COALESCE(SUM(amount), 0) as total FROM transactions
        WHERE amount < 0
        AND date_trunc('month', date) = date_trunc('month', CURRENT_DATE)
    """)
    monthly_expenses = float(cur.fetchone()['total'])

    # Recent transactions
    cur.execute("SELECT * FROM transactions ORDER BY date DESC LIMIT 6")
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

# ══════════════════════════════════════
#  MONEY COACH — Groq AI
# ══════════════════════════════════════

@app.route('/api/money-coach', methods=['POST'])
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
        ORDER BY date DESC
        LIMIT 80
    """)
    transactions = cur.fetchall()

    cur.execute("""
        SELECT category, amount, start_date, days, created_at
        FROM budgets
        ORDER BY created_at DESC
        LIMIT 30
    """)
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

# ══════════════════════════════════════
#  RECURRING PAYMENTS
# ══════════════════════════════════════

@app.route('/api/recurring', methods=['GET'])
def get_recurring():
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT *
        FROM recurring_payments
        ORDER BY next_date ASC
    """)

    rows = cur.fetchall()
    cur.close()
    conn.close()

    return jsonify(rows)


@app.route('/api/recurring', methods=['POST'])
def add_recurring():
    data = request.json or {}

    name = (data.get('name') or '').strip()
    amount = data.get('amount')
    category = (data.get('category') or 'Other').strip()
    account = (data.get('account') or 'Recurring').strip()
    frequency = (data.get('frequency') or 'monthly').strip()
    next_date = data.get('next_date')

    if not name or amount is None or not next_date:
        return jsonify({"error": "Name, amount, and next date are required"}), 400

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO recurring_payments
            (name, amount, category, account, frequency, next_date, is_active)
        VALUES
            (%s, %s, %s, %s, %s, %s, %s)
    """, (
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


@app.route('/api/recurring/<int:recurring_id>/mark-paid', methods=['POST'])
def mark_recurring_paid(recurring_id):
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT * FROM recurring_payments WHERE id = %s", (recurring_id,))
    item = cur.fetchone()

    if not item:
        cur.close()
        conn.close()
        return jsonify({"error": "Recurring payment not found"}), 404

    # Create real transaction
    cur.execute("""
        INSERT INTO transactions (name, amount, category, account, date, source)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (
        item["name"],
        item["amount"],
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
    """, (interval, recurring_id))

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "Recurring item marked successfully"}), 200

# ── RUN ──
if __name__ == '__main__':
    app.run(debug=True, port=5000)
