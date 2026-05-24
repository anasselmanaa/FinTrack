import uuid
from datetime import datetime
from types import SimpleNamespace

import pytest

import app as fintrack


@pytest.fixture
def client():
    fintrack.art.config["TESTING"] = True
    with fintrack.art.test_client() as test_client:
        yield test_client


def cleanup_user(user_id):
    conn = fintrack.get_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
    conn.commit()
    cur.close()
    conn.close()


def register_and_login(client):
    email = f"billing-{uuid.uuid4().hex}@test.local"
    password = "test-password-123"

    register_response = client.post(
        "/auth/register",
        json={"name": "Billing Test", "email": email, "password": password},
    )
    assert register_response.status_code == 201

    login_response = client.post(
        "/auth/login",
        json={"email": email, "password": password},
    )
    assert login_response.status_code == 200
    return login_response.get_json()["user"]["id"]


def test_cancel_subscription_requires_second_click_confirmation(client):
    user_id = register_and_login(client)
    try:
        response = client.post("/api/billing/cancel-subscription", json={})
        assert response.status_code == 400
        assert "confirm" in response.get_json()["error"].lower()
    finally:
        cleanup_user(user_id)


def test_cancel_subscription_schedules_stripe_period_end(client, monkeypatch):
    user_id = register_and_login(client)
    period_end = int(datetime(2026, 6, 22).timestamp())

    conn = fintrack.get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        UPDATE users
        SET subscription_status = 'active',
            stripe_customer_id = 'cus_test_cancel',
            stripe_subscription_id = 'sub_test_cancel'
        WHERE id = %s
        """,
        (user_id,),
    )
    conn.commit()
    cur.close()
    conn.close()

    class FakeSubscriptionApi:
        modified = False

        @staticmethod
        def retrieve(subscription_id):
            assert subscription_id == "sub_test_cancel"
            return {
                "id": subscription_id,
                "customer": "cus_test_cancel",
                "status": "active",
                "cancel_at_period_end": False,
                "current_period_end": period_end,
            }

        @classmethod
        def modify(cls, subscription_id, cancel_at_period_end):
            assert subscription_id == "sub_test_cancel"
            assert cancel_at_period_end is True
            cls.modified = True
            return {
                "id": subscription_id,
                "customer": "cus_test_cancel",
                "status": "active",
                "cancel_at_period_end": True,
                "current_period_end": period_end,
            }

    monkeypatch.setattr(fintrack, "STRIPE_SECRET_KEY", "stripe-test-secret")
    monkeypatch.setattr(fintrack, "stripe", SimpleNamespace(Subscription=FakeSubscriptionApi))

    try:
        response = client.post("/api/billing/cancel-subscription", json={"confirm": True})
        data = response.get_json()

        assert response.status_code == 200
        assert FakeSubscriptionApi.modified is True
        assert data["user"]["subscription_status"] == "active"
        assert data["user"]["subscription_cancel_at_period_end"] is True
        assert data["user"]["stripe_subscription_id"] == "sub_test_cancel"

        conn = fintrack.get_connection()
        cur = conn.cursor()
        cur.execute(
            """
            SELECT subscription_cancel_at_period_end, subscription_current_period_end
            FROM users
            WHERE id = %s
            """,
            (user_id,),
        )
        cancel_at_period_end, current_period_end = cur.fetchone()
        cur.close()
        conn.close()

        assert cancel_at_period_end is True
        assert current_period_end is not None
    finally:
        cleanup_user(user_id)
