import uuid
from datetime import date, timedelta

import pytest

import app as fintrack


@pytest.fixture(autouse=True)
def money_coach_test_state(monkeypatch):
    monkeypatch.setattr(fintrack, "anthropic_client", None)
    monkeypatch.setattr(fintrack, "MONEY_COACH_RATE_LIMIT_COUNT", 8)
    monkeypatch.setattr(fintrack, "MONEY_COACH_RATE_LIMIT_WINDOW", 60)
    fintrack.money_coach_rate_bucket.clear()

    yield

    fintrack.money_coach_rate_bucket.clear()


@pytest.fixture
def client():
    fintrack.art.config["TESTING"] = True

    with fintrack.art.test_client() as test_client:
        yield test_client


@pytest.fixture
def logged_in_user(client):
    email = f"money-coach-{uuid.uuid4().hex}@test.local"
    password = "test-password-123"

    register_response = client.post(
        "/auth/register",
        json={
            "name": "Money Coach Test",
            "email": email,
            "password": password,
        },
    )
    assert register_response.status_code == 201

    login_response = client.post(
        "/auth/login",
        json={
            "email": email,
            "password": password,
        },
    )
    assert login_response.status_code == 200

    user_id = login_response.get_json()["user"]["id"]

    yield client, user_id

    cleanup_user(user_id)


def cleanup_user(user_id):
    conn = fintrack.get_connection()
    cur = conn.cursor()

    for table in (
        "money_coach_insights",
        "money_coach_history",
        "recurring_payment_history",
        "recurring_payments",
        "transactions",
        "budgets",
        "goals",
    ):
        cur.execute(f"DELETE FROM {table} WHERE user_id = %s", (user_id,))

    cur.execute("DELETE FROM users WHERE id = %s", (user_id,))

    conn.commit()
    cur.close()
    conn.close()


def insert_transaction(user_id, name, amount, category, account="Checking", tx_date=None):
    conn = fintrack.get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO transactions (user_id, name, amount, category, account, date, source)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (user_id, name, amount, category, account, tx_date or date.today(), "test"),
    )

    conn.commit()
    cur.close()
    conn.close()


def insert_budget(user_id, category, amount, start_date=None, days=30, match_keyword=""):
    conn = fintrack.get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO budgets (user_id, category, amount, start_date, days, month, year, match_keyword)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (user_id, category, amount, start_date or date.today(), days, None, None, match_keyword),
    )

    conn.commit()
    cur.close()
    conn.close()


def insert_recurring(user_id, name, amount, next_date=None, category="Bills"):
    conn = fintrack.get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO recurring_payments
            (user_id, name, amount, category, account, frequency, next_date, is_active)
        VALUES
            (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (user_id, name, amount, category, "Checking", "monthly", next_date or date.today(), True),
    )

    conn.commit()
    cur.close()
    conn.close()


def insert_goal(user_id, name, target_amount, saved_amount, deadline=None, category="Savings"):
    conn = fintrack.get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO goals
            (user_id, name, target_amount, saved_amount, deadline, icon, category, auto_link_savings)
        VALUES
            (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            user_id,
            name,
            target_amount,
            saved_amount,
            deadline or (date.today() + timedelta(days=14)),
            "🎯",
            category,
            True,
        ),
    )

    conn.commit()
    cur.close()
    conn.close()


def ask_money_coach(client, question):
    return client.post("/api/money-coach", json={"question": question})


def test_missing_claude_uses_local_affordability_fallback(logged_in_user):
    client, user_id = logged_in_user
    insert_transaction(user_id, "Salary", 1000, "Income")
    insert_budget(user_id, "Dining", 300)

    response = ask_money_coach(client, "Can I afford $100 for dinner?")
    body = response.get_json()

    assert response.status_code == 200
    assert body["mode"] == "fallback"
    assert body["affordability"]["is_affordability_question"] is True
    assert body["affordability"]["requested_amount"] == 100
    assert body["affordability"]["safe_to_spend"] >= 100
    assert "Educational guidance only" in body["disclaimer"]


def test_money_coach_rate_limit_returns_clean_429(logged_in_user, monkeypatch):
    client, _ = logged_in_user
    monkeypatch.setattr(fintrack, "MONEY_COACH_RATE_LIMIT_COUNT", 1)
    fintrack.money_coach_rate_bucket.clear()

    first_response = ask_money_coach(client, "Can I afford $10?")
    second_response = ask_money_coach(client, "Can I afford $20?")
    body = second_response.get_json()

    assert first_response.status_code == 200
    assert second_response.status_code == 429
    assert "retry_after" in body
    assert "Try again" in body["error"]


def test_affordability_handles_empty_data_cautiously(logged_in_user):
    client, _ = logged_in_user

    response = ask_money_coach(client, "Can I afford $100?")
    body = response.get_json()

    assert response.status_code == 200
    assert body["affordability"]["decision"] == "insufficient_data"
    assert body["affordability"]["safe_to_spend"] == 0
    assert "Add a few transactions" in body["answer"]


def test_budget_overrun_blocks_extra_category_spending(logged_in_user):
    client, user_id = logged_in_user
    insert_transaction(user_id, "Salary", 1000, "Income")
    insert_budget(user_id, "Dining", 100)
    insert_transaction(user_id, "Restaurant", -150, "Dining")

    response = ask_money_coach(client, "Can I afford $50 eating out?")
    body = response.get_json()

    assert response.status_code == 200
    assert body["affordability"]["decision"] == "wait"
    assert body["affordability"]["safe_to_spend"] == 0
    assert body["affordability"]["over_budget_total"] >= 50
    assert "Wait" in body["answer"]


def test_recurring_bill_due_reduces_safe_to_spend(logged_in_user):
    client, user_id = logged_in_user
    insert_transaction(user_id, "Salary", 1000, "Income")
    insert_recurring(user_id, "Rent", -900, next_date=date.today())

    response = ask_money_coach(client, "Can I afford $200?")
    body = response.get_json()

    assert response.status_code == 200
    assert body["affordability"]["due_soon_total"] == 900
    assert body["affordability"]["safe_to_spend"] <= 100
    assert body["affordability"]["decision"] in {"careful", "wait"}


def test_near_goal_deadline_reduces_safe_to_spend(logged_in_user):
    client, user_id = logged_in_user
    insert_transaction(user_id, "Salary", 1000, "Income")
    insert_goal(
        user_id,
        "Thailand Trip",
        target_amount=1000,
        saved_amount=100,
        deadline=date.today() + timedelta(days=7),
        category="Travel",
    )

    response = ask_money_coach(client, "Can I afford $500?")
    body = response.get_json()

    assert response.status_code == 200
    assert body["affordability"]["goal_reserve_total"] > 0
    assert body["affordability"]["decision"] in {"careful", "wait"}
    assert "Goal deadline pressure" in body["answer"]


def test_safe_to_spend_endpoint_uses_budgets_bills_and_goals(logged_in_user):
    client, user_id = logged_in_user
    insert_transaction(user_id, "Salary", 1000, "Income")
    insert_budget(user_id, "Dining", 300)
    insert_recurring(user_id, "Phone bill", -100, next_date=date.today())
    insert_goal(
        user_id,
        "Emergency Fund",
        target_amount=100,
        saved_amount=0,
        deadline=date.today() + timedelta(days=7),
        category="Savings",
    )

    response = client.get("/api/money-coach/safe-to-spend")
    body = response.get_json()

    assert response.status_code == 200
    assert body["period"] == "this_week"
    assert body["amount"] == 100
    assert body["status"] == "Looks safe"
    assert body["note"] == "After budgets, bills, and goals."
    assert body["breakdown"]["budget_room"] == 300
    assert body["breakdown"]["bills_due_soon"] == 100
    assert body["breakdown"]["goal_deadline_pressure"] == 100


def test_spending_guidance_understands_going_out_as_multiple_categories():
    guidance = fintrack.build_money_coach_spending_guidance(
        "How much can I spend going out this weekend?",
        [
            {"category": "Dining", "amount": 300, "spent": 120, "remaining": 180, "over_budget_amount": 0},
            {"category": "Entertainment", "amount": 200, "spent": 50, "remaining": 150, "over_budget_amount": 0},
            {"category": "Coffee", "amount": 80, "spent": 20, "remaining": 60, "over_budget_amount": 0},
            {"category": "Transport", "amount": 120, "spent": 40, "remaining": 80, "over_budget_amount": 0},
            {"category": "Rent", "amount": 1000, "spent": 1000, "remaining": 0, "over_budget_amount": 0},
        ],
    )

    categories = {item["category"] for item in guidance["matched_categories"]}

    assert {"Dining", "Entertainment", "Coffee", "Transport"}.issubset(categories)
    assert "Rent" not in categories
    assert guidance["confidence"] == "high"
    assert guidance["total_remaining"] == 470
    assert "Dining: USD 180.00" in guidance["split_summary"]
    assert "Entertainment: USD 150.00" in guidance["split_summary"]


def test_spending_guidance_handles_typos_and_custom_keywords():
    guidance = fintrack.build_money_coach_spending_guidance(
        "Can I spend 70 on grocories and my weekend trip?",
        [
            {"category": "Groceries", "amount": 250, "spent": 100, "remaining": 150, "over_budget_amount": 0},
            {
                "category": "Thailand",
                "match_keyword": "travel",
                "amount": 500,
                "spent": 200,
                "remaining": 300,
                "over_budget_amount": 0,
            },
            {"category": "Utilities", "amount": 150, "spent": 50, "remaining": 100, "over_budget_amount": 0},
        ],
    )

    categories = {item["category"] for item in guidance["matched_categories"]}

    assert categories == {"Groceries", "Thailand"}
    assert guidance["total_remaining"] == 450


def test_spending_guidance_learns_from_user_transaction_names():
    guidance = fintrack.build_money_coach_spending_guidance(
        "How much can I spend at Starbucks this week?",
        [
            {"category": "Dining", "amount": 300, "spent": 120, "remaining": 180, "over_budget_amount": 0},
            {"category": "Groceries", "amount": 250, "spent": 100, "remaining": 150, "over_budget_amount": 0},
        ],
        transactions=[
            {"name": "Starbucks", "amount": -6.25, "category": "Dining"},
            {"name": "Starbucks Reserve", "amount": -8.10, "category": "Dining"},
            {"name": "Whole Foods", "amount": -42.00, "category": "Groceries"},
        ],
    )

    assert guidance["learned_from_transactions"] is True
    assert guidance["confidence"] == "high"
    assert [item["category"] for item in guidance["matched_categories"]] == ["Dining"]
    assert guidance["matched_categories"][0]["learned_sources"][0]["count"] == 2


def test_spending_guidance_supports_real_life_phrases_and_languages():
    guidance = fintrack.build_money_coach_spending_guidance(
        "I need commute, self care, bills, kids school, and home stuff money.",
        [
            {"category": "Transport", "amount": 120, "spent": 40, "remaining": 80, "over_budget_amount": 0},
            {"category": "Health", "amount": 150, "spent": 20, "remaining": 130, "over_budget_amount": 0},
            {"category": "Utilities", "amount": 200, "spent": 50, "remaining": 150, "over_budget_amount": 0},
            {"category": "School", "amount": 300, "spent": 90, "remaining": 210, "over_budget_amount": 0},
            {"category": "Household", "amount": 180, "spent": 80, "remaining": 100, "over_budget_amount": 0},
        ],
    )

    categories = {item["category"] for item in guidance["matched_categories"]}

    assert categories == {"Transport", "Health", "Utilities", "School", "Household"}
    assert guidance["total_remaining"] == 670

    french_guidance = fintrack.build_money_coach_spending_guidance(
        "Je veux sortir et manger dehors.",
        [
            {"category": "Dining", "amount": 300, "spent": 100, "remaining": 200, "over_budget_amount": 0},
            {"category": "Entertainment", "amount": 120, "spent": 20, "remaining": 100, "over_budget_amount": 0},
        ],
    )

    assert {item["category"] for item in french_guidance["matched_categories"]} == {"Dining", "Entertainment"}


def test_spending_guidance_marks_broad_food_questions_as_medium_confidence():
    guidance = fintrack.build_money_coach_spending_guidance(
        "How much should I spend on food?",
        [
            {"category": "Groceries", "amount": 250, "spent": 100, "remaining": 150, "over_budget_amount": 0},
            {"category": "Dining", "amount": 200, "spent": 60, "remaining": 140, "over_budget_amount": 0},
        ],
    )

    assert guidance["confidence"] == "medium"
    assert {item["category"] for item in guidance["matched_categories"]} == {"Groceries", "Dining"}
    assert guidance["total_remaining"] == 290


def test_daily_scan_endpoint_does_not_generate_without_force(logged_in_user, monkeypatch):
    client, _ = logged_in_user

    def fail_if_called(_user_id):
        raise AssertionError("Daily scan should not call Claude unless force=true")

    monkeypatch.setattr(fintrack, "generate_daily_insights_with_claude", fail_if_called)

    response = client.post("/api/insights/daily-scan", json={})
    body = response.get_json()

    assert response.status_code == 200
    assert body["ran"] is False


def test_subscription_summary_uses_rules_without_force(logged_in_user, monkeypatch):
    _, user_id = logged_in_user

    def fail_if_called(*_args, **_kwargs):
        raise AssertionError("Subscription summary should not call Claude unless force=true")

    monkeypatch.setattr(fintrack, "call_money_coach_ai", fail_if_called)

    summary, mode = fintrack.generate_subscription_summary(
        user_id,
        [{
            "merchant": "Netflix",
            "amount": 15.99,
            "frequency": "monthly",
            "monthly_cost": 15.99,
            "occurrences": 3,
            "days_since_last_charge": 20,
        }],
        lang="en",
        force=False,
    )

    assert mode == "rule"
    assert "subscription" in summary.lower()
