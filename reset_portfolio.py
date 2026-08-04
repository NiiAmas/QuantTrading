import os
from database import SessionLocal
from init_db import PortfolioAsset, Trade
from trade_executor import _classify_asset

def run_reset():
    session = SessionLocal()
    try:
        print("🧹 Wiping current portfolio_assets table...")
        session.query(PortfolioAsset).delete()
        session.commit()
        
        print("🔍 Scanning historical trades to rebuild genuine spot holdings...")
        # Get all OPEN LONG trades on Crypto and Stocks
        open_longs = session.query(Trade).filter(
            Trade.status == "Open",
            Trade.trade_type == "Long"
        ).all()
        
        rebuilt = 0
        
        for trade in open_longs:
            asset_class = _classify_asset(trade.symbol)
            if asset_class in ("Crypto", "Stock"):
                # Check if we already created an asset for this account/symbol
                asset = session.query(PortfolioAsset).filter(
                    PortfolioAsset.account_id == trade.account_id,
                    PortfolioAsset.symbol == trade.symbol
                ).first()
                
                if asset:
                    # Average in
                    total_shares = asset.shares + trade.quantity
                    total_cost = (asset.shares * asset.avg_price) + (trade.quantity * trade.entry_price)
                    asset.avg_price = total_cost / total_shares if total_shares > 0 else trade.entry_price
                    asset.shares = total_shares
                    asset.current_price = trade.current_price
                else:
                    new_asset = PortfolioAsset(
                        account_id=trade.account_id,
                        symbol=trade.symbol,
                        asset_class=asset_class,
                        shares=trade.quantity,
                        avg_price=trade.entry_price,
                        current_price=trade.current_price
                    )
                    session.add(new_asset)
                rebuilt += 1
                
        session.commit()
        print(f"✅ Successfully rebuilt {rebuilt} genuine spot holding records!")
        
    except Exception as e:
        print(f"❌ Error during reset: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    run_reset()
