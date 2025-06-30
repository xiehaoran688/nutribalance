# user_management.py: handles user database operations and user-related utilities for the NutriBalance app
import sqlite3
import json
from flask import current_app, g
from werkzeug.security import generate_password_hash, check_password_hash

# Get a SQLite database connection, storing it in the application context
def get_db():
    # Check if a database connection already exists in 'g'
    if 'db' not in g:
        g.db = sqlite3.connect(current_app.config['DB_NAME'])
        g.db.row_factory = sqlite3.Row
    return g.db

# Close the database connection at the end of the request
def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

# Initialize the database with required tables if they don't exist
def init_db():
    # Create 'users', 'feedback', and 'user_data' tables
    db = get_db()
    db.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        dob TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        entries TEXT,
        targets TEXT
    );
    """)
    db.commit()

# Insert a new user with hashed password into the users table
def insert_user(username, password, dob):
    # Hash the plain-text password for security
    db = get_db()
    hashed = generate_password_hash(password)
    try:
        db.execute(
            "INSERT INTO users(username, password, dob) VALUES (?, ?, ?)",
            (username, hashed, dob)
        )
        db.commit()
    except sqlite3.IntegrityError:
        raise

# Verify a user's credentials by checking the password hash
def verify_user(username, password):
    # Retrieve stored password hash for the given username
    db = get_db()
    row = db.execute(
        "SELECT password FROM users WHERE username = ?", (username,)
    ).fetchone()
    return bool(row and check_password_hash(row['password'], password))

# Insert user feedback into the feedback table
def add_feedback(content):
    db = get_db()
    db.execute("INSERT INTO feedback(content) VALUES (?)", (content,))
    db.commit()

# Fetch all feedback entries in reverse order (newest first)
def get_feedback():
    db = get_db()
    rows = db.execute("SELECT content FROM feedback ORDER BY id DESC").fetchall()
    return [r['content'] for r in rows]

# Load stored user entries and targets as Python objects
def get_user_data(username):
    db = get_db()
    row = db.execute(
        "SELECT entries, targets FROM user_data WHERE username = ?", (username,)
    ).fetchone()
    if row:
        entries = json.loads(row['entries'] or "[]")
        targets = json.loads(row['targets'] or "{}")
        return {"entries": entries, "targets": targets}
    return {"entries": [], "targets": {}}

# Save or update user-specific data (entries and targets) in JSON format
def save_user_data(username, entries, targets):
    db = get_db()
    db.execute(
        """
        INSERT INTO user_data(username, entries, targets)
        VALUES (?, ?, ?)
        ON CONFLICT(username) DO UPDATE SET
          entries = excluded.entries,
          targets = excluded.targets
        """,
        (username, json.dumps(entries), json.dumps(targets))
    )
    db.commit()