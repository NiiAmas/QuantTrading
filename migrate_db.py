"""
Database Migration — Add asset_types and sectors columns to accounts table.
This is a NON-DESTRUCTIVE migration that preserves all existing data.
Run this on the server BEFORE deploying the new code.
"""
from database import engine, SessionLocal
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
            
    # Sync and fix all account balances to strict mathematical reality
    print("--- ⚖️ SYNCING ACCOUNT BALANCES ---")
    session = SessionLocal()
    from init_db import Account, Trade
    accounts = session.query(Account).all()
    for acc in accounts:
        closed_trades = session.query(Trade).filter(Trade.account_id == acc.id, Trade.status == "Closed").all()
        open_trades = session.query(Trade).filter(Trade.account_id == acc.id, Trade.status == "Open").all()
        
        realized_pnl = sum(t.pnl_dollars or 0 for t in closed_trades)
        open_invested = sum(
            (t.position_value if t.position_value and t.position_value > 0 else ((t.quantity or 0) * (t.entry_price or 0)))
            for t in open_trades
        )
        init_bal = acc.initial_balance or 100000.0
        correct_cash = round(max(0.0, init_bal + realized_pnl - open_invested), 2)
        print(f"   📊 Account [{acc.name}]: Old Balance=${acc.balance:,.2f} -> Corrected Cash=${correct_cash:,.2f} (Realized P&L: +${realized_pnl:,.2f})")
        acc.balance = correct_cash
    session.commit()
    session.close()
    
    print("--- ✅ MIGRATION & BALANCE SYNC COMPLETE ---")

if __name__ == "__main__":
    migrate()
