import psycopg2
from psycopg2.extras import RealDictCursor

# Connection settings
DB_CONFIG = {
    "dbname":   "fintrack",
    "user":     "mac",        # your Mac username
    "password": "",
    "host":     "localhost",
    "port":     "5432"
}

def get_connection():
    """Get a database connection"""
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
            created_at TIMESTAMP DEFAULT NOW(),
            subscription_status TEXT DEFAULT 'trial',
            trial_started_at TIMESTAMP DEFAULT NOW()
        );
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
