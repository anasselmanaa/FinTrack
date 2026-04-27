from database import get_connection

conn = get_connection()
cur  = conn.cursor()

transactions = [
    ('Salary Deposit',     4210.00,  'Income',        'Main Checking', '2026-04-21', 'manual'),
    ('Whole Foods',        -156.42,  'Groceries',     'Rewards Card',  '2026-04-21', 'manual'),
    ('Netflix',            -15.99,   'Entertainment', 'Rewards Card',  '2026-04-20', 'manual'),
    ('Uber Ride',          -24.50,   'Transport',     'Main Checking', '2026-04-20', 'manual'),
    ('Electric Bill',      -145.00,  'Utilities',     'Main Checking', '2026-04-19', 'manual'),
    ('Rent Payment',       -1800.00, 'Housing',       'Main Checking', '2026-04-18', 'manual'),
    ('Starbucks',          -7.50,    'Dining',        'Rewards Card',  '2026-04-18', 'manual'),
    ('Freelance Payment',  850.00,   'Income',        'Main Checking', '2026-04-16', 'manual'),
    ('Spotify',            -9.99,    'Entertainment', 'Rewards Card',  '2026-04-15', 'manual'),
    ('Bonus Payment',      2000.00,  'Income',        'Main Checking', '2026-04-10', 'manual'),
]

for tx in transactions:
    cur.execute("""
        INSERT INTO transactions (name, amount, category, account, date, source)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, tx)

conn.commit()
cur.close()
conn.close()
print("Done! Added " + str(len(transactions)) + " transactions!")