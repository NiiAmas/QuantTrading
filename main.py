import os
from fastapi import FastAPI, Query, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import yfinance as yf
import pandas as pd
import json
import feedparser
from bs4 import BeautifulSoup
import random
from pydantic import BaseModel
from typing import Optional, List
from database import SessionLocal
from init_db import Account, PortfolioAsset, Trade, User
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta

# --- AUTH CONFIG ---
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-quant-key-for-dev")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30 # 30 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    db = SessionLocal()
    user = db.query(User).filter(User.email == email.lower()).first()
    db.close()
    if user is None:
        raise credentials_exception
    return user

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AccountCreate(BaseModel):
    name: str
    balance: float
    strategy: str
    asset_types: Optional[List[str]] = None
    sectors: Optional[List[str]] = None

class AccountUpdate(BaseModel):
    name: str
    strategy: str
    asset_types: Optional[List[str]] = None
    sectors: Optional[List[str]] = None

class UserCreate(BaseModel):
    email: str
    password: str
    pin: Optional[str] = None

class GoogleAuthCreate(BaseModel):
    email: str

@app.post("/auth/register")
def register(user: UserCreate):
    db = SessionLocal()
    email_lower = user.email.lower()
    if db.query(User).filter(User.email == email_lower).first():
        db.close()
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pwd = pwd_context.hash(user.password)
    pin_hash = pwd_context.hash(user.pin) if user.pin else None
    
    new_user = User(email=email_lower, hashed_password=hashed_pwd, pin_hash=pin_hash)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    db.close()
    
    access_token = create_access_token(data={"sub": new_user.email})
    return {"access_token": access_token, "token_type": "bearer", "user_id": new_user.id}

@app.post("/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    db = SessionLocal()
    email_lower = form_data.username.lower()
    user = db.query(User).filter(User.email == email_lower).first()
    db.close()
    
    if not user or not pwd_context.verify(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer", "user_id": user.id}

@app.post("/auth/google")
def google_auth(user: GoogleAuthCreate):
    db = SessionLocal()
    email_lower = user.email.lower()
    db_user = db.query(User).filter(User.email == email_lower).first()
    
    if not db_user:
        # Auto-register new Google users securely without a standard password
        db_user = User(email=email_lower, hashed_password="GOOGLE_AUTH_ACCOUNT", pin_hash=None)
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
    db.close()
    access_token = create_access_token(data={"sub": db_user.email})
    return {"access_token": access_token, "token_type": "bearer", "user_id": db_user.id}

@app.post("/accounts")
def create_account(acc: AccountCreate, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    new_acc = Account(
        user_id=current_user.id,
        name=acc.name,
        balance=acc.balance,
        initial_balance=acc.balance,
        strategy=acc.strategy,
        asset_types=json.dumps(acc.asset_types) if acc.asset_types else None,
        sectors=json.dumps(acc.sectors) if acc.sectors else None
    )
    db.add(new_acc)
    db.commit()
    db.refresh(new_acc)
    db.close()
    return {
        "id": str(new_acc.id), "name": new_acc.name, "balance": new_acc.balance,
        "type": new_acc.strategy, "holdings": [],
        "assetTypes": json.loads(new_acc.asset_types) if new_acc.asset_types else [],
        "sectors": json.loads(new_acc.sectors) if new_acc.sectors else []
    }

@app.get("/accounts")
def get_accounts(current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    accounts = db.query(Account).filter(Account.user_id == current_user.id).all()
    res = []
    for a in accounts:
        holdings = db.query(PortfolioAsset.symbol).filter(PortfolioAsset.account_id == a.id).all()
        holdings_list = [h[0] for h in holdings]
        
        # Calculate true verified equity and profits
        acc_closed = db.query(Trade).filter(Trade.account_id == a.id, Trade.status == "Closed").all()
        acc_open = db.query(Trade).filter(Trade.account_id == a.id, Trade.status == "Open").all()
        
        acc_realized_pnl = sum(t.pnl_dollars or 0 for t in acc_closed)
        acc_unrealized_pnl = sum(t.pnl_dollars or 0 for t in acc_open)
        
        init_bal = a.initial_balance or 100000.0
        total_account_equity = init_bal + acc_realized_pnl + acc_unrealized_pnl
        net_profit = acc_realized_pnl + acc_unrealized_pnl
        total_return_pct = (net_profit / init_bal * 100) if init_bal > 0 else 0.0
        
        acc_open_invested = sum(
            (t.position_value if t.position_value and t.position_value > 0 else ((t.quantity or 0) * (t.entry_price or 0)))
            for t in acc_open
        )
        true_cash = max(0.0, init_bal + acc_realized_pnl - acc_open_invested)
        
        # Sync DB balance
        if abs((a.balance or 0) - true_cash) > 0.01:
            a.balance = round(true_cash, 2)
            db.commit()
            
        res.append({
            "id": str(a.id),
            "name": a.name,
            "balance": round(total_account_equity, 2),
            "availableCash": round(true_cash, 2),
            "netProfit": round(net_profit, 2),
            "returnPct": round(total_return_pct, 2),
            "type": a.strategy,
            "holdings": holdings_list,
            "assetTypes": json.loads(a.asset_types) if a.asset_types else [],
            "sectors": json.loads(a.sectors) if a.sectors else []
        })
    db.close()
    return res

@app.put("/accounts/{account_id}")
def update_account(account_id: int, acc: AccountUpdate, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    db_acc = db.query(Account).filter(Account.id == account_id, Account.user_id == current_user.id).first()
    if not db_acc:
        db.close()
        raise HTTPException(status_code=404, detail="Account not found")
    db_acc.name = acc.name
    db_acc.strategy = acc.strategy
    if acc.asset_types is not None:
        db_acc.asset_types = json.dumps(acc.asset_types)
    if acc.sectors is not None:
        db_acc.sectors = json.dumps(acc.sectors)
    db.commit()
    db.refresh(db_acc)
    db.close()
    return {
        "id": str(db_acc.id), "name": db_acc.name, "balance": db_acc.balance,
        "type": db_acc.strategy, "holdings": [],
        "assetTypes": json.loads(db_acc.asset_types) if db_acc.asset_types else [],
        "sectors": json.loads(db_acc.sectors) if db_acc.sectors else []
    }

@app.delete("/accounts/{account_id}")
def delete_account(account_id: int, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    db_acc = db.query(Account).filter(Account.id == account_id, Account.user_id == current_user.id).first()
    if not db_acc:
        db.close()
        raise HTTPException(status_code=404, detail="Account not found")
    
    # Cascade delete portfolio assets and trades
    db.query(PortfolioAsset).filter(PortfolioAsset.account_id == account_id).delete()
    db.query(Trade).filter(Trade.account_id == account_id).delete()
    
    db.delete(db_acc)
    db.commit()
    db.close()
    return {"message": "Account deleted successfully"}

@app.get("/accounts/{account_id}/data")
def get_account_data(account_id: int, current_user: User = Depends(get_current_user)):
    db = SessionLocal()
    acc = db.query(Account).filter(Account.id == account_id, Account.user_id == current_user.id).first()
    if not acc:
        db.close()
        return {"error": "Account not found"}
    
    assets = db.query(PortfolioAsset).filter(
        PortfolioAsset.account_id == account_id,
        PortfolioAsset.asset_class.in_(["Crypto", "Stock"])
    ).all()
    trades = db.query(Trade).filter(Trade.account_id == account_id).all()
    
    positions = []
    for a in assets:
        current = a.current_price if a.current_price and a.current_price > 0 else a.avg_price
        value = a.shares * current
        cost_basis = a.shares * a.avg_price
        pnl = ((current - a.avg_price) / a.avg_price * 100) if a.avg_price > 0 else 0.0
        pnl_dollars = value - cost_basis
        positions.append({
            "asset": a.symbol,
            "class": a.asset_class,
            "shares": round(a.shares, 6),
            "avgPrice": round(a.avg_price, 2),
            "currentPrice": round(current, 2),
            "value": round(value, 2),
            "pnl": round(pnl_dollars, 2)
        })
        
    ledger = []
    for t in trades:
        ledger.append({
            "id": f"TRD-{t.id}",
            "pair": t.symbol,
            "type": t.trade_type,
            "status": t.status,
            "entry": round(t.entry_price, 2) if t.entry_price else 0,
            "current": round(t.current_price, 2) if t.current_price else 0,
            "pnl": f"{'+' if (t.pnl or 0) >= 0 else ''}{t.pnl or 0}%",
            "pnlDollars": round(t.pnl_dollars, 2) if t.pnl_dollars else 0,
            "quantity": round(t.quantity, 6) if t.quantity else 0,
            "stopLoss": round(t.stop_loss_price, 2) if t.stop_loss_price else None,
            "takeProfit": round(t.take_profit_price, 2) if t.take_profit_price else None,
            "reasoning": t.reasoning or "",
            "openedAt": t.created_at.isoformat() if t.created_at else None,
            "closedAt": t.closed_at.isoformat() if t.closed_at else None,
        })
        
    # Calculate account-level stats
    open_trades = [t for t in trades if t.status == "Open"]
    closed_trades = [t for t in trades if t.status == "Closed"]
    
    realized_pnl = sum(t.pnl_dollars or 0 for t in closed_trades)
    unrealized_pnl = sum(t.pnl_dollars or 0 for t in open_trades)
    
    init_bal = acc.initial_balance or 100000.0
    realized_balance = init_bal + realized_pnl
    unrealized_balance = realized_balance + unrealized_pnl
    
    realized_return = (realized_pnl / init_bal * 100) if init_bal > 0 else 0.0
    unrealized_return = ((realized_pnl + unrealized_pnl) / init_bal * 100) if init_bal > 0 else 0.0

    # Total capital locked in open trades
    total_invested_in_open = sum(
        (t.position_value if (t.position_value and t.position_value > 0) else (((t.quantity or 1) * (t.entry_price or 0)) if (t.entry_price and t.entry_price > 0) else 5000.0))
        for t in open_trades
    ) if open_trades else 0.0
    
    open_market_val = sum(
        (((t.quantity or 1) * (t.current_price if (t.current_price and t.current_price > 0) else (t.entry_price or 0))) if (t.current_price or t.entry_price) else 5000.0)
        for t in open_trades
    ) if open_trades else 0.0
    
    # Available Cash = Realized Balance - Margin in Open Trades (Withdrawable Cash)
    true_available_cash = max(0.0, realized_balance - total_invested_in_open)
    
    # Sync DB balance so it is always mathematically consistent
    if abs((acc.balance or 0) - true_available_cash) > 0.01:
        acc.balance = round(true_available_cash, 2)
        db.commit()

    holdings_value = sum(
        (a.shares * (a.current_price if a.current_price and a.current_price > 0 else a.avg_price))
        for a in assets
    )
    if not holdings_value and open_trades:
        holdings_value = open_market_val
    estimated_total_value = unrealized_balance
    
    db.close()
    return {
        "positions": positions,
        "tradeLedger": ledger,
        "accountStats": {
            "availableMargin": round(true_available_cash, 2),
            "realizedBalance": round(realized_balance, 2),
            "unrealizedBalance": round(unrealized_balance, 2),
            "realizedReturn": round(realized_return, 2),
            "unrealizedReturn": round(unrealized_return, 2),
            "initialBalance": round(init_bal, 2),
            "openTradesCount": len(open_trades),
            "closedTradesCount": len(closed_trades),
            "totalRealizedPnl": round(realized_pnl, 2),
            "totalUnrealizedPnl": round(unrealized_pnl, 2),
            "strategy": acc.strategy,
            "totalInvestedInOpen": round(total_invested_in_open, 2),
            "openMarketValue": round(open_market_val, 2),
            "holdingsValue": round(holdings_value, 2),
            "netProfit": round(realized_pnl, 2),
            "estimatedTotalValue": round(estimated_total_value, 2),
        }
    }

@app.get("/bot/stats")
def get_bot_stats():
    """Public endpoint for monitoring bot health."""
    try:
        from trade_executor import get_execution_stats
        stats = get_execution_stats()
        return {
            "status": "running",
            "timestamp": datetime.now().isoformat(),
            **stats
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/signal")
def get_signal(symbol: str = Query("BTC-USD")):
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="5d")
        if len(hist) >= 2:
            change = hist['Close'].iloc[-1] - hist['Close'].iloc[-2]
            signal = "BUY" if change > 0 else "SELL"
            reasoning = f"Recent price movement indicates a {'bullish' if change > 0 else 'bearish'} trend based on {symbol} 24h momentum."
            return {"signal": signal, "sentiment_score": round(change / hist['Close'].iloc[-2] * 100, 2), "reasoning": reasoning}
    except Exception as e:
        print(f"Error in signal: {e}")
    return {"signal": "NEUTRAL", "sentiment_score": 0, "reasoning": "Waiting for live AI analysis..."}

@app.get("/prices")
def get_prices(symbol: str = Query("BTC-USD"), interval: str = Query("1d"), period: str = Query("")):
    """
    Fetch OHLCV price data. Supports multiple timeframes:
    Intervals: 1m, 5m, 15m, 30m, 1h, 1d, 1wk
    Period auto-adjusts based on interval if not specified.
    """
    try:
        # Map intervals to appropriate periods if not specified
        if not period:
            interval_period_map = {
                "1m": "7d",       # 1-minute bars → 7 days of data (max for 1m)
                "2m": "14d",      # 2-minute bars → 14 days
                "5m": "30d",      # 5-minute bars → 30 days
                "15m": "60d",     # 15-minute bars → 60 days
                "30m": "60d",     # 30-minute bars → 60 days
                "1h": "2y",       # 1-hour bars → 2 years
                "1d": "2y",       # Daily bars → 2 years
                "1wk": "5y",      # Weekly bars → 5 years
            }
            period = interval_period_map.get(interval, "3mo")

        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period, interval=interval)
        if hist.empty:
            return []
            
        data = []
        for index, row in hist.iterrows():
            data.append({
                "time": int(index.timestamp()),
                "open": round(float(row["Open"]), 6),
                "high": round(float(row["High"]), 6),
                "low": round(float(row["Low"]), 6),
                "close": round(float(row["Close"]), 6),
                "volume": int(row["Volume"])
            })
        return data
    except Exception as e:
        print(f"Error fetching {symbol} ({interval}): {e}")
        return []

@app.get("/explorer")
def get_explorer(assetClass: str = Query("All")):
    symbols = {
        "Crypto": ["BTC-USD", "ETH-USD", "SOL-USD"],
        "Stocks": ["AAPL", "MSFT", "NVDA", "TSLA"],
        "Forex": ["EURUSD=X", "GBPUSD=X", "JPY=X"],
        "Commodity": ["GC=F", "SI=F"]
    }
    
    fetch_list = []
    if assetClass == "All":
        for k, v in symbols.items():
            fetch_list.extend(v)
    else:
        fetch_list = symbols.get(assetClass, [])

    import concurrent.futures

    def fetch_sym(sym):
        try:
            t = yf.Ticker(sym)
            hist = t.history(period="7d")
            if not hist.empty:
                current_price = hist['Close'].iloc[-1]
                prev_price = hist['Close'].iloc[-2] if len(hist) > 1 else current_price
                change = ((current_price - prev_price) / prev_price) * 100
                trend = hist['Close'].tolist()
                
                cls = "Unknown"
                for k, v in symbols.items():
                    if sym in v: cls = k
                
                return {
                    "ticker": sym,
                    "class": cls,
                    "price": float(current_price),
                    "change": round(change, 2),
                    "qScore": round(abs(change)/10, 2), 
                    "sScore": round(change/5, 2),
                    "trend": trend
                }
        except Exception:
            pass
        return None

    results = []
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(fetch_sym, sym) for sym in fetch_list]
            
            # Wait at most 3 seconds for all fetches to complete
            done, not_done = concurrent.futures.wait(futures, timeout=3)
            
            for future in done:
                try:
                    res = future.result()
                    if res:
                        results.append(res)
                except Exception:
                    pass
        return results
    except Exception as e:
        print(f"Error in explorer: {e}")
        return []

@app.get("/news")
def get_news():
    try:
        # RSS feeds for the globe news view (only feeds that return CURRENT articles)
        # REMOVED: Wall Street Journal — returned stale 2025 articles
        # REMOVED: Reuters — sometimes cross-posts paywalled WSJ content
        # REMOVED: Google News & CNBC — syndicated Wall Street Journal content
        feeds = [
            "https://finance.yahoo.com/news/rss",
            "https://cointelegraph.com/rss",
            "https://www.coindesk.com/arc/outboundfeeds/rss/",
        ]
        
        cities = [
            {"name": "New York", "lat": 40.71, "lng": -74.00},
            {"name": "London", "lat": 51.50, "lng": -0.12},
            {"name": "Tokyo", "lat": 35.67, "lng": 139.65},
            {"name": "Hong Kong", "lat": 22.31, "lng": 114.16},
            {"name": "Singapore", "lat": 1.35, "lng": 103.81},
            {"name": "Frankfurt", "lat": 50.11, "lng": 8.68},
            {"name": "Dubai", "lat": 25.20, "lng": 55.27},
            {"name": "Shanghai", "lat": 31.23, "lng": 121.47}
        ]
        
        # Date cutoff: only articles from the last 48 hours
        from time import mktime
        cutoff = datetime.now() - timedelta(hours=48)
        
        all_news = []
        for url in feeds:
            try:
                parsed = feedparser.parse(url)
            except Exception:
                continue
                
            for entry in parsed.entries[:15]:
                title = entry.get("title", "")
                if not title or title == "[Removed]":
                    continue
                
                # ─── DATE FILTERING: Skip old articles ───
                pub_date = None
                time_display = "Just now"
                
                # ─── BLOCK WSJ / Dow Jones articles by URL & TEXT ───
                # (Google News and CNBC syndicate WSJ but use their own URLs like news.google.com)
                article_url = entry.get("link", "").lower()
                article_title = entry.get("title", "").lower()
                article_summary = entry.get("summary", "").lower()
                
                is_blocked = False
                blocked_keywords = ["wsj.com", "barrons.com", "marketwatch.com", "dowjones.com", "wall street journal", "barron's", "marketwatch"]
                
                for blocked in blocked_keywords:
                    if blocked in article_url or blocked in article_title or blocked in article_summary:
                        is_blocked = True
                        break
                        
                # Check RSS source tag if available
                if hasattr(entry, 'source') and hasattr(entry.source, 'title'):
                    source_title = entry.source.title.lower()
                    if "wall street journal" in source_title or "wsj" in source_title or "barron" in source_title or "marketwatch" in source_title:
                        is_blocked = True

                if is_blocked:
                    continue  # SKIP — Wall Street Journal / Dow Jones source
                
                # Try to parse the publication date from multiple sources
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    try:
                        pub_date = datetime.fromtimestamp(mktime(entry.published_parsed))
                    except Exception:
                        pass
                elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                    try:
                        pub_date = datetime.fromtimestamp(mktime(entry.updated_parsed))
                    except Exception:
                        pass
                
                # Fallback: try parsing the raw published string
                if pub_date is None and hasattr(entry, 'published') and entry.published:
                    try:
                        from dateutil import parser as dateparser
                        pub_date = dateparser.parse(entry.published, ignoretz=True)
                    except Exception:
                        pass
                
                # ─── STRICT FILTER: If we can't determine the date, SKIP the article ───
                # (This prevents old undated articles from slipping through)
                if pub_date is None:
                    continue  # SKIP — can't verify freshness, assume stale
                
                if pub_date < cutoff:
                    continue  # SKIP — article is older than 48 hours
                
                # Show human-readable time like "2h ago", "15m ago"
                delta = datetime.now() - pub_date
                if delta.total_seconds() < 0:
                    time_display = "Just now"  # Future dates (timezone issues)
                elif delta.total_seconds() < 3600:
                    time_display = f"{int(delta.total_seconds() / 60)}m ago"
                elif delta.total_seconds() < 86400:
                    time_display = f"{int(delta.total_seconds() / 3600)}h ago"
                else:
                    time_display = f"{int(delta.days)}d ago"
                
                summary_html = entry.get('summary', '')
                summary = BeautifulSoup(summary_html, "html.parser").get_text()[:150] + "..."
                
                title_lower = title.lower()
                impact = "Neutral"
                if any(w in title_lower for w in ["surge", "jump", "up", "gain", "high", "profit", "bull", "rally", "growth", "boost"]): impact = "Bullish"
                elif any(w in title_lower for w in ["plunge", "drop", "down", "loss", "low", "crash", "fall", "bear", "cut", "sell"]): impact = "Bearish"
                
                emoji = "📰"
                if any(w in title_lower for w in ["crypto", "bitcoin", "eth", "coin"]): emoji = "🪙"
                elif any(w in title_lower for w in ["bank", "fed", "rate", "inflation", "cpi"]): emoji = "🏦"
                elif any(w in title_lower for w in ["oil", "gas", "energy", "crude"]): emoji = "🛢️"
                elif any(w in title_lower for w in ["tech", "ai", "apple", "nvidia", "chip", "software"]): emoji = "💻"
                elif any(w in title_lower for w in ["gold", "silver", "metal"]): emoji = "🏆"
                elif impact == "Bullish": emoji = "🚀"
                elif impact == "Bearish": emoji = "📉"
                
                city = random.choice(cities)
                lat = city["lat"] + random.uniform(-3.0, 3.0)
                lng = city["lng"] + random.uniform(-3.0, 3.0)
                
                # Try to assign a relevant ticker
                ticker = "GLOBAL"
                if "bitcoin" in title_lower or "crypto" in title_lower: ticker = "BTC-USD"
                elif "ethereum" in title_lower or "eth " in title_lower: ticker = "ETH-USD"
                elif "solana" in title_lower: ticker = "SOL-USD"
                elif "oil" in title_lower: ticker = "CL=F"
                elif "gold" in title_lower: ticker = "GC=F"
                elif "apple" in title_lower: ticker = "AAPL"
                elif "nvidia" in title_lower: ticker = "NVDA"
                elif "tesla" in title_lower: ticker = "TSLA"
                elif "microsoft" in title_lower: ticker = "MSFT"
                elif "amazon" in title_lower: ticker = "AMZN"
                
                # Generate a consistent ID from the URL hash
                import hashlib
                article_id = hashlib.md5(entry.link.encode()).hexdigest()[:8] if entry.get("link") else str(random.randint(10000, 99999))
                
                all_news.append({
                    "id": article_id,
                    "headline": title,
                    "summary": summary,
                    "ticker": ticker,
                    "impact": impact,
                    "link": entry.get("link"),
                    "time": time_display,
                    "lat": lat,
                    "lng": lng,
                    "emoji": emoji,
                    "sentimentScore": None
                })
        
        # Try to enrich with sentiment scores from DB
        try:
            from init_db import NewsArticle
            db = SessionLocal()
            db_articles = db.query(NewsArticle).all()
            score_map = {a.title[:60]: a.sentiment_score for a in db_articles if a.sentiment_score}
            db.close()
            for item in all_news:
                key = item["headline"][:60]
                if key in score_map:
                    item["sentimentScore"] = score_map[key]
        except Exception:
            pass

        random.shuffle(all_news)
        return all_news[:40]
    except Exception as e:
        print(f"News fetch error: {e}")
        return []

@app.get("/news/{article_id}")
def get_news_detail(article_id: str):
    """Get a single news article by ID for the detail page."""
    try:
        # Fetch all news and find the one with matching ID
        all_news = get_news()
        for article in all_news:
            if article["id"] == article_id:
                return article
        
        # If not found in current feed, return a fallback
        return {
            "id": article_id,
            "headline": "Article no longer available in live feed",
            "summary": "This article has rotated out of the current RSS feed. News articles are refreshed in real-time from live sources.",
            "ticker": "GLOBAL",
            "impact": "Neutral",
            "link": None,
            "time": "Expired",
            "lat": 40.71,
            "lng": -74.00,
            "emoji": "📰",
            "sentimentScore": None
        }
    except Exception as e:
        print(f"News detail error: {e}")
        return {"error": str(e)}

# ─── EMAIL REPORT SETTINGS ────────────────────────────────────────────
@app.get("/settings/email-reports")
def get_email_settings(current_user: User = Depends(get_current_user)):
    """Check if email reports are configured for the system."""
    import email_reports
    return {
        "configured": email_reports.is_configured(),
        "report_hour": email_reports.REPORT_HOUR,
        "smtp_email": email_reports.SMTP_EMAIL[:3] + "***" if email_reports.SMTP_EMAIL else None,
    }

@app.post("/settings/test-email")
def send_test_email(current_user: User = Depends(get_current_user)):
    """Send a test daily report email to the current user."""
    import email_reports
    if not email_reports.is_configured():
        raise HTTPException(status_code=400, detail="Email reports not configured. Set SMTP_EMAIL and SMTP_PASSWORD in .env")
    
    try:
        session = SessionLocal()
        report_html = email_reports._generate_report_html(session, current_user)
        email_reports._send_email(
            to_email=current_user.email,
            subject=f"📊 QuantTrading TEST Report — {datetime.now().strftime('%B %d, %Y')}",
            html_body=report_html
        )
        session.close()
        return {"message": f"Test report sent to {current_user.email}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    print("--- 🚀 STARTING QUANTTRADING LIVE API ---")
    uvicorn.run(app, host="0.0.0.0", port=8000)