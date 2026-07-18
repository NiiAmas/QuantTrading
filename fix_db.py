"""
Database Reset Utility — Use this to reset tables when schema changes.
WARNING: This will DROP and recreate tables, losing all data.
"""
from database import engine
from sqlalchemy import text
from init_db import Base

def reset_tables():
    print("--- 🛠️ FIXING DATABASE SCHEMA ---")
    
    with engine.connect() as conn:
        # Drop all existing tables
        print("   🗑️  Dropping all old tables...")
        conn.execute(text("DROP TABLE IF EXISTS trades CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS portfolio_assets CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS trade_signals CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS news_articles CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS bitcoin_prices CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS accounts CASCADE;"))
        conn.execute(text("DROP TABLE IF EXISTS users CASCADE;"))
        conn.commit()
        print("   ✅ Old tables removed.")

    # Re-create with new schema
    print("   🏗️  Creating tables with production schema...")
    Base.metadata.create_all(bind=engine)
    print("   ✅ All tables ready with new fields!")

if __name__ == "__main__":
    reset_tables()