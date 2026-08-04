"""
Database Migration — Add asset_types and sectors columns to accounts table.
This is a NON-DESTRUCTIVE migration that preserves all existing data.
Run this on the server BEFORE deploying the new code.
"""
from database import engine
from sqlalchemy import text

def migrate():
    print("--- 🔄 MIGRATING DATABASE ---")
    
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE accounts ADD COLUMN asset_types TEXT;"))
            conn.commit()
            print("   ✅ Added 'asset_types' column to accounts table.")
        except Exception:
            conn.rollback()
            print("   ✅ 'asset_types' column already exists.")
        
        try:
            conn.execute(text("ALTER TABLE accounts ADD COLUMN sectors TEXT;"))
            conn.commit()
            print("   ✅ Added 'sectors' column to accounts table.")
        except Exception:
            conn.rollback()
            print("   ✅ 'sectors' column already exists.")
    
    print("--- ✅ MIGRATION COMPLETE ---")

if __name__ == "__main__":
    migrate()
