import os
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))

DATABASE_URL = os.getenv("DATABASE_URL")

# Local development fallback. Production should use DATABASE_URL.
DB_CONFIG = {
    "dbname":   os.getenv("DB_NAME", "fintrack"),
    "user":     os.getenv("DB_USER", "mac"),
    "password": os.getenv("DB_PASSWORD", ""),
    "host":     os.getenv("DB_HOST", "localhost"),
    "port":     os.getenv("DB_PORT", "5432")
}

def get_connection():
    """Get a database connection"""
    if DATABASE_URL:
        return psycopg2.connect(DATABASE_URL)

    return psycopg2.connect(**DB_CONFIG)

def init_db():
    """Create all tables if they don't exist"""
    conn = get_connection()
    cur  = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            profile_image_url TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            subscription_status TEXT DEFAULT 'trial',
            trial_started_at TIMESTAMP DEFAULT NOW()
        );
    """)

    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_currency TEXT")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language TEXT")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end BOOLEAN DEFAULT FALSE")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_canceled_at TIMESTAMP")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_goal TEXT")
    # Google OAuth: users who sign in with Google have a google_id and no
    # password_hash. Existing email/password users get a google_id later if
    # they choose to link their Google account.
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT")
    cur.execute("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL")
    cur.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx
        ON users (google_id)
        WHERE google_id IS NOT NULL
    """)
    # Canonical email form used for anti-abuse duplicate checks. Gmail-aware:
    # 'anas+x@gmail.com' and 'a.n.a.s@gmail.com' both canonicalize to 'anas@gmail.com'.
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_canonical TEXT")
    cur.execute("CREATE INDEX IF NOT EXISTS users_email_canonical_idx ON users (email_canonical)")

    # Permanent record of every email that has ever held a FinTrack account.
    # On account deletion, we write the canonical-hash here so the email can
    # never reopen a fresh 14-day trial. Hashed (not plaintext) to be
    # defensible under "right to be forgotten" / PIPEDA / GDPR.
    cur.execute("""
        CREATE TABLE IF NOT EXISTS previously_used_emails (
            id SERIAL PRIMARY KEY,
            email_canonical_hash TEXT NOT NULL UNIQUE,
            original_user_id INTEGER,
            trial_ended_at TIMESTAMP,
            deleted_at TIMESTAMP DEFAULT NOW(),
            reason TEXT DEFAULT 'deleted'
        )
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS previously_used_emails_hash_idx
        ON previously_used_emails (email_canonical_hash)
    """)
    cur.execute("""
        UPDATE users
        SET trial_ends_at = COALESCE(trial_started_at, created_at, NOW()) + INTERVAL '14 days'
        WHERE trial_ends_at IS NULL
    """)
    cur.execute("ALTER TABLE users ALTER COLUMN trial_ends_at SET DEFAULT (NOW() + INTERVAL '14 days')")
    cur.execute("""
        CREATE INDEX IF NOT EXISTS users_stripe_customer_idx
        ON users (stripe_customer_id)
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS users_stripe_subscription_idx
        ON users (stripe_subscription_id)
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id          SERIAL PRIMARY KEY,
            user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
            name        VARCHAR(255) NOT NULL,
            amount      DECIMAL(10,2) NOT NULL,
            category    VARCHAR(100),
            account     VARCHAR(100),
            date        DATE NOT NULL,
            source      VARCHAR(50),   -- 'wechat', 'alipay', 'manual'
            created_at  TIMESTAMP DEFAULT NOW()
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS budgets (
            id          SERIAL PRIMARY KEY,
            user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
            category    VARCHAR(100) NOT NULL,
            amount      DECIMAL(10,2) NOT NULL,
            month       INTEGER,
            year        INTEGER,
            start_date  DATE,
            days        INTEGER DEFAULT 30,
            created_at  TIMESTAMP DEFAULT NOW()
        );
    """)

    cur.execute("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS start_date DATE")
    cur.execute("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS days INTEGER DEFAULT 30")
    cur.execute("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS match_keyword TEXT")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS goals (
            id            SERIAL PRIMARY KEY,
            user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
            name          VARCHAR(255) NOT NULL,
            target_amount DECIMAL(10,2) NOT NULL,
            saved_amount  DECIMAL(10,2) DEFAULT 0,
            deadline      DATE,
            icon          VARCHAR(10),
            category      TEXT DEFAULT 'Savings',
            auto_link_savings BOOLEAN DEFAULT TRUE,
            created_at    TIMESTAMP DEFAULT NOW()
        );
    """)

    cur.execute("ALTER TABLE goals ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Savings'")
    cur.execute("ALTER TABLE goals ADD COLUMN IF NOT EXISTS auto_link_savings BOOLEAN DEFAULT TRUE")
    cur.execute("ALTER TABLE goals ALTER COLUMN auto_link_savings SET DEFAULT TRUE")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS goal_contributions (
            id SERIAL PRIMARY KEY,
            goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
            amount DECIMAL(10,2) NOT NULL,
            note TEXT,
            date DATE NOT NULL DEFAULT CURRENT_DATE,
            source TEXT NOT NULL DEFAULT 'manual',
            created_at TIMESTAMP DEFAULT NOW()
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS recurring_payments (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            amount NUMERIC NOT NULL,
            category TEXT DEFAULT 'Other',
            account TEXT DEFAULT 'Recurring',
            frequency TEXT NOT NULL DEFAULT 'monthly',
            next_date DATE NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE")
    cur.execute("ALTER TABLE budgets ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE")
    cur.execute("ALTER TABLE goals ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE")
    cur.execute("ALTER TABLE recurring_payments ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE")
    cur.execute("ALTER TABLE recurring_payments ADD COLUMN IF NOT EXISTS last_paid_at TIMESTAMP")
    cur.execute("ALTER TABLE recurring_payments ADD COLUMN IF NOT EXISTS last_paid_for_date DATE")

    # Accounts a user has set up explicitly (Visa, BMO Checking, Cash, etc.).
    # Coexists with the implicit accounts that fall out of the .account field
    # on transactions — the dashboard merges both sources. type is metadata
    # for grouping/icons; can be null. Unique per user so users can't have
    # two "Cash" accounts that fight for transactions.
    cur.execute("""
        CREATE TABLE IF NOT EXISTS accounts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            type TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE (user_id, name)
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS accounts_user_id_idx ON accounts (user_id)")

    # Coupons — issued by the owner to grant special access. Right now only
    # kind='lifetime' is supported (sets subscription_status='lifetime' on
    # the redeeming user, which the rest of the app treats as paid). The
    # times_used counter + max_uses cap let us issue limited-run codes too.
    cur.execute("""
        CREATE TABLE IF NOT EXISTS coupons (
            code TEXT PRIMARY KEY,
            kind TEXT NOT NULL DEFAULT 'lifetime',
            max_uses INTEGER,
            times_used INTEGER NOT NULL DEFAULT 0,
            note TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS coupon_redemptions (
            id SERIAL PRIMARY KEY,
            coupon_code TEXT NOT NULL REFERENCES coupons(code) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            redeemed_at TIMESTAMP DEFAULT NOW(),
            UNIQUE (coupon_code, user_id)
        )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS coupon_redemptions_user_idx ON coupon_redemptions (user_id)")

    # Seed a first lifetime coupon so the owner has something to share on
    # day one. ON CONFLICT DO NOTHING means re-running init_db() never
    # clobbers a coupon that's already been edited / had its max_uses set.
    cur.execute("""
        INSERT INTO coupons (code, kind, max_uses, note)
        VALUES ('FINTRACK-VIP', 'lifetime', NULL, 'Initial lifetime code — share privately')
        ON CONFLICT (code) DO NOTHING
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS recurring_payment_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            recurring_id INTEGER NOT NULL REFERENCES recurring_payments(id) ON DELETE CASCADE,
            transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
            amount NUMERIC NOT NULL,
            paid_for_date DATE NOT NULL,
            action_type TEXT NOT NULL DEFAULT 'paid',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS money_coach_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            mode TEXT DEFAULT 'ai',
            feedback TEXT,
            feedback_at TIMESTAMP,
            data_used JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("ALTER TABLE money_coach_history ADD COLUMN IF NOT EXISTS feedback TEXT")
    cur.execute("ALTER TABLE money_coach_history ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMP")

    cur.execute("""
        CREATE INDEX IF NOT EXISTS money_coach_history_user_created_idx
        ON money_coach_history (user_id, created_at DESC)
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS money_coach_insights (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            insight_key TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            source TEXT DEFAULT 'money_coach',
            status TEXT DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP,
            UNIQUE (user_id, insight_key)
        )
    """)

    cur.execute("""
        CREATE INDEX IF NOT EXISTS money_coach_insights_user_status_idx
        ON money_coach_insights (user_id, status, updated_at DESC)
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS insights (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            insight_date DATE NOT NULL DEFAULT CURRENT_DATE,
            insight_type TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            action_label TEXT,
            tone TEXT DEFAULT 'info',
            status TEXT DEFAULT 'open',
            payload JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (user_id, insight_date, insight_type)
        )
    """)

    cur.execute("ALTER TABLE insights ADD COLUMN IF NOT EXISTS action_label TEXT")
    cur.execute("ALTER TABLE insights ADD COLUMN IF NOT EXISTS tone TEXT DEFAULT 'info'")
    cur.execute("ALTER TABLE insights ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open'")
    cur.execute("ALTER TABLE insights ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb")

    cur.execute("""
        CREATE INDEX IF NOT EXISTS insights_user_date_status_idx
        ON insights (user_id, insight_date DESC, status, updated_at DESC)
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS claude_calls_log (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            model TEXT NOT NULL,
            input_tokens INTEGER NOT NULL DEFAULT 0,
            output_tokens INTEGER NOT NULL DEFAULT 0,
            cost_usd NUMERIC(12, 8) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE INDEX IF NOT EXISTS claude_calls_log_user_created_idx
        ON claude_calls_log (user_id, created_at DESC)
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS email_events (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            event_key TEXT NOT NULL,
            recipient TEXT NOT NULL,
            provider TEXT NOT NULL DEFAULT 'resend',
            provider_message_id TEXT,
            status TEXT NOT NULL DEFAULT 'queued',
            error TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            sent_at TIMESTAMP,
            UNIQUE (user_id, event_key)
        )
    """)

    cur.execute("""
        CREATE INDEX IF NOT EXISTS email_events_user_created_idx
        ON email_events (user_id, created_at DESC)
    """)

    cur.execute("""
        CREATE INDEX IF NOT EXISTS email_events_status_created_idx
        ON email_events (status, created_at DESC)
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE INDEX IF NOT EXISTS password_reset_tokens_user_created_idx
        ON password_reset_tokens (user_id, created_at DESC)
    """)

    cur.execute("""
        CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_idx
        ON password_reset_tokens (expires_at)
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS email_verification_tokens (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            used_at TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE INDEX IF NOT EXISTS email_verification_tokens_user_created_idx
        ON email_verification_tokens (user_id, created_at DESC)
    """)

    cur.execute("""
        CREATE INDEX IF NOT EXISTS email_verification_tokens_expires_idx
        ON email_verification_tokens (expires_at)
    """)

    cur.execute("""
        DELETE FROM recurring_payments rp
        USING recurring_payments keep
        WHERE rp.id > keep.id
          AND COALESCE(rp.user_id, 0) = COALESCE(keep.user_id, 0)
          AND LOWER(rp.name) = LOWER(keep.name)
          AND rp.amount = keep.amount
          AND LOWER(rp.category) = LOWER(keep.category)
          AND LOWER(rp.account) = LOWER(keep.account)
          AND LOWER(rp.frequency) = LOWER(keep.frequency)
          AND rp.next_date = keep.next_date
    """)

    cur.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS recurring_payments_unique_schedule_idx
        ON recurring_payments (
            (COALESCE(user_id, 0)),
            (LOWER(name)),
            amount,
            (LOWER(category)),
            (LOWER(account)),
            (LOWER(frequency)),
            next_date
        )
    """)

    cur.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS recurring_payment_history_unique_cycle_idx
        ON recurring_payment_history (user_id, recurring_id, paid_for_date)
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            icon TEXT NOT NULL DEFAULT '🏷️',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        INSERT INTO categories (name, icon)
        VALUES
            ('Income', '💰'),
            ('Groceries', '🛒'),
            ('Entertainment', '🎬'),
            ('Transport', '🚗'),
            ('Utilities', '⚡'),
            ('Housing', '🏠'),
            ('Dining', '🍽️'),
            ('Health', '💊'),
            ('Shopping', '🛍️'),
            ('Other', '🏷️')
        ON CONFLICT (name) DO NOTHING
    """)

    conn.commit()
    cur.close()
    conn.close()
    print("✅ Database tables created!")

if __name__ == "__main__":
    init_db()
