"""
Bot Engine — The main orchestrator loop that runs the entire trading system.
(This is the "heartbeat" of the QuantTrading bot)

PURPOSE:
    This module runs continuously in the background and orchestrates three
    separate loops at different speeds:
    
    1. FAST (every 60s):  Price updates + stop-loss/take-profit monitoring
    2. MEDIUM (every 5m):  Execute pending AI signals + check for signal reversals
    3. SLOW (every 15m):  Fetch fresh news + run FinBERT AI analysis
    
    This multi-speed approach ensures that:
    - Positions are monitored frequently (SL/TP can trigger every minute)
    - Trades execute promptly when signals are generated (within 5 minutes)
    - News fetching respects API rate limits (NewsAPI: 100/day)

HOW THE FULL PIPELINE WORKS:
    1. news_ai_cycle() fetches news articles → saves to DB → runs FinBERT → saves signal
    2. trade_execution_cycle() reads pending signals → runs 3-layer verification → executes trades
    3. price_check_cycle() updates prices on all positions → checks SL/TP → auto-closes if hit

SYMBOL ROTATION:
    To avoid hitting API rate limits, the bot processes 5 symbols per news cycle
    and rotates through the full list. With 20+ symbols, it takes ~4 cycles (1 hour)
    to analyze everything once. This is deliberate — not a bug.
"""

import time
import logging
import sys
from datetime import datetime
import yfinance as yf
from database import SessionLocal
from init_db import BitcoinPrice, Base
from database import engine
import ai_analysis
import data_ingestion
import trade_executor
import email_reports

# ─── LOGGING SETUP ────────────────────────────────────────────────────
# (Logs go to both the terminal AND a log file for debugging later)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("bot_engine.log", mode="a"),
    ]
)
logger = logging.getLogger("bot_engine")

# Reduce noise from third-party libraries
logging.getLogger("yfinance").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("transformers").setLevel(logging.WARNING)

# ─── ASSET CONFIGURATION ──────────────────────────────────────────────
# (All symbols the bot monitors — organized by asset class)
# (The dict value is the search query used for news fetching)

CRYPTO_SYMBOLS = {
    "BTC-USD": "Bitcoin Crypto",
    "ETH-USD": "Ethereum Crypto",
    "SOL-USD": "Solana Crypto",
    "XRP-USD": "Ripple Crypto",
    "ADA-USD": "Cardano Crypto",
    "DOGE-USD": "Dogecoin Crypto",
    "DOT-USD": "Polkadot Crypto",
    "AVAX-USD": "Avalanche Crypto",
    "LINK-USD": "Chainlink Crypto",
}

STOCK_SYMBOLS = {
    "AAPL": "Apple Stock",
    "MSFT": "Microsoft Stock",
    "NVDA": "Nvidia Stock",
    "TSLA": "Tesla Stock",
    "GOOGL": "Alphabet Google Stock",
    "AMZN": "Amazon Stock",
    "META": "Meta Facebook Stock",
    "AMD": "AMD Stock",
}

COMMODITY_SYMBOLS = {
    "GC=F": "Gold Commodity",
    "SI=F": "Silver Commodity",
    "CL=F": "Crude Oil Commodity",
}

FOREX_SYMBOLS = {
    "EURUSD=X": "Euro US Dollar Forex",
    "GBPUSD=X": "British Pound US Dollar Forex",
    "JPY=X": "Japanese Yen US Dollar Forex",
}

# Combined config — all symbols the bot will monitor
ALL_SYMBOLS = {**CRYPTO_SYMBOLS, **STOCK_SYMBOLS, **COMMODITY_SYMBOLS, **FOREX_SYMBOLS}

# ─── TIMING CONFIGURATION ─────────────────────────────────────────────
# (These control how often each loop runs)
PRICE_CHECK_INTERVAL = 60       # 1 minute — fast price updates and SL/TP checks
TRADE_EXEC_INTERVAL = 300       # 5 minutes — execute pending AI signals
NEWS_AI_INTERVAL = 900          # 15 minutes — news fetch + FinBERT AI analysis
SYMBOLS_PER_NEWS_CYCLE = 5      # Process 5 symbols per news cycle (rotate through list)

# ─── STATE TRACKING ───────────────────────────────────────────────────
# (These track when each loop last ran, so we know when to run again)
_news_symbol_index = 0  # Which symbols to process next in rotation
_last_trade_exec = 0    # Timestamp of last trade execution cycle
_last_news_ai = 0       # Timestamp of last news+AI cycle
_cycle_count = 0        # Total number of price check cycles (for heartbeat logging)


def save_price_to_db(symbol: str, price: float):
    """
    Save a price snapshot to the database.
    (Called during every price check cycle for each symbol)

    DETAILS:
        Stores the current price with a timestamp. This data is used by:
        - The frontend charts (historical price display)
        - The explorer page (showing current prices and % changes)
        - Future backtesting analysis
    """
    session = SessionLocal()
    try:
        new_entry = BitcoinPrice(symbol=symbol, price=float(price))
        session.add(new_entry)
        session.commit()
    except Exception as e:
        logger.error(f"   ❌ DB Error saving price for {symbol}: {e}")
        session.rollback()
    finally:
        session.close()


def price_check_cycle():
    """
    FAST LOOP (every 60 seconds): Fetch prices and manage positions.
    
    WHAT IT DOES:
        1. Fetches the current price for every tracked symbol from Yahoo Finance
        2. Saves each price to the database (for charts and historical data)
        3. Calls the trade executor to check all open positions:
           - Update P&L percentages and dollar amounts
           - Check if any position has hit its stop-loss → auto-close
           - Check if any position has hit its take-profit → auto-close
    """
    logger.info("─── 📈 PRICE CHECK CYCLE ───")

    prices_saved = 0
    for symbol in ALL_SYMBOLS:
        try:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="1d", interval="1m")
            if not hist.empty:
                price = float(hist['Close'].iloc[-1])
                save_price_to_db(symbol, price)
                prices_saved += 1
        except Exception:
            pass  # Silently skip failed price fetches — some markets close

    logger.info(f"   💾 Saved {prices_saved}/{len(ALL_SYMBOLS)} prices.")

    # Check stop-loss / take-profit on all open positions
    closed = trade_executor.manage_open_positions()
    if closed > 0:
        logger.info(f"   🔒 Position manager closed {closed} trade(s).")


def trade_execution_cycle():
    """
    MEDIUM LOOP (every 5 minutes): Execute pending signals + handle reversals.
    
    WHAT IT DOES:
        1. Reads all unexecuted BUY/SELL signals from the trade_signals table
        2. For each signal, evaluates it against ALL user accounts
        3. Runs the 3-Layer Verification (TA + SA + QA) before executing
        4. Creates Trade records in the DB for verified setups
        5. Checks for signal reversals (Long + SELL signal → close the Long)
        6. Logs current execution statistics
    """
    logger.info("─── ⚡ TRADE EXECUTION CYCLE ───")

    # 1. Execute any pending AI signals
    trades = trade_executor.execute_pending_signals()

    # 2. Check for signal reversals on open positions
    reversals = trade_executor.close_on_signal_reversal()

    # 3. Log current stats
    stats = trade_executor.get_execution_stats()
    logger.info(
        f"   📊 Stats: {stats['open_trades']} open | "
        f"{stats['closed_trades']} closed | "
        f"P&L: ${stats['total_pnl']:+,.2f} | "
        f"Win rate: {stats['win_rate']}%"
    )


def news_ai_cycle():
    """
    SLOW LOOP (every 15 minutes): Fetch news and run AI analysis.
    
    WHAT IT DOES:
        1. Selects the next batch of 5 symbols from the rotation list
        2. For each symbol in the batch:
           a. Fetches latest news headlines (NewsAPI → RSS fallback)
           b. Saves articles to the database
           c. Runs FinBERT sentiment analysis on the headlines
           d. Generates BUY/SELL signal if sentiment is strong enough
           e. Saves the signal to DB with executed=False
        3. The trade_execution_cycle() will pick up these signals next time it runs

    SYMBOL ROTATION:
        With 20+ symbols and 5 per cycle, it takes ~4 cycles (1 hour) to
        analyze everything. This is intentional to stay within API rate limits.
    """
    global _news_symbol_index

    logger.info("─── 🧠 NEWS + AI ANALYSIS CYCLE ───")

    # Rotate through symbols in batches of SYMBOLS_PER_NEWS_CYCLE
    symbol_list = list(ALL_SYMBOLS.items())
    start = _news_symbol_index
    end = min(start + SYMBOLS_PER_NEWS_CYCLE, len(symbol_list))
    batch = symbol_list[start:end]

    # Wrap around if we've gone past the end
    if end >= len(symbol_list):
        _news_symbol_index = 0
    else:
        _news_symbol_index = end

    logger.info(f"   📰 Processing symbols {start+1}-{end} of {len(symbol_list)}: {[s[0] for s in batch]}")

    for symbol, search_query in batch:
        # 1. Fetch fresh news → save to DB
        try:
            data_ingestion.fetch_and_save_news(symbol, search_query)
        except Exception as e:
            logger.warning(f"   ⚠️ News fetch failed for {symbol}: {e}")

        # 2. Run FinBERT AI analysis → save signal to DB
        try:
            ai_analysis.analyze_db_news(symbol)
        except Exception as e:
            logger.warning(f"   ⚠️ AI analysis failed for {symbol}: {e}")

    logger.info(f"   ✅ News + AI cycle complete for {len(batch)} symbols.")


def start_engine():
    """
    Main engine entry point — starts the bot and runs forever.
    
    STARTUP SEQUENCE:
        1. Verify database tables exist (create if missing)
        2. Run one immediate full cycle (news + signals + prices)
        3. Enter the infinite main loop with multi-speed scheduling
    
    THE MAIN LOOP:
        Every 60 seconds:
            - Always: price_check_cycle() (prices + SL/TP monitoring)
            - Every 5 minutes: trade_execution_cycle() (execute pending signals)
            - Every 15 minutes: news_ai_cycle() (fresh news + AI analysis)
                              + immediate trade_execution_cycle() after
    """
    global _last_trade_exec, _last_news_ai, _cycle_count

    print("\n" + "=" * 60)
    print("  🚀 QUANTTRADING PROFESSIONAL ENGINE v2.0")
    print("  Intervals: Prices=60s | Trades=5min | News+AI=15min")
    print(f"  Monitoring {len(ALL_SYMBOLS)} symbols across 4 asset classes")
    print(f"  Symbols: {list(ALL_SYMBOLS.keys())}")
    print("=" * 60 + "\n")

    # Ensure database tables exist
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Database tables verified.")

    # Run initial full cycle immediately on startup
    logger.info("🔄 Running initial full cycle...")
    try:
        news_ai_cycle()         # Fetch initial news + generate AI signals
        trade_execution_cycle()  # Execute any signals (from this cycle or previous runs)
        price_check_cycle()      # Get initial prices + manage existing positions
    except Exception as e:
        logger.error(f"Initial cycle error: {e}", exc_info=True)

    _last_trade_exec = time.time()
    _last_news_ai = time.time()

    # ─── MAIN LOOP ─────────────────────────────────────────────────
    while True:
        try:
            _cycle_count += 1
            now = time.time()

            # FAST: Price check every 60 seconds (always runs)
            price_check_cycle()

            # MEDIUM: Trade execution every 5 minutes
            if now - _last_trade_exec >= TRADE_EXEC_INTERVAL:
                trade_execution_cycle()
                _last_trade_exec = now

            # SLOW: News + AI every 15 minutes
            if now - _last_news_ai >= NEWS_AI_INTERVAL:
                news_ai_cycle()
                # Immediately execute any new signals from this AI cycle
                trade_execution_cycle()
                _last_news_ai = now

            # DAILY: Check if it's time to send email reports
            # (Only sends once per day at the configured hour, silently skips if not configured)
            try:
                email_reports.check_and_send_daily_report()
            except Exception as e:
                logger.debug(f"Email report check: {e}")

            # Heartbeat log every 10 cycles (~10 minutes)
            if _cycle_count % 10 == 0:
                stats = trade_executor.get_execution_stats()
                logger.info(
                    f"💓 Heartbeat (cycle #{_cycle_count}): "
                    f"{stats['open_trades']} open trades | "
                    f"${stats['total_pnl']:+,.2f} total P&L"
                )

            # Sleep until next price check
            time.sleep(PRICE_CHECK_INTERVAL)

        except KeyboardInterrupt:
            logger.info("🛑 Engine stopped by user.")
            break
        except Exception as e:
            logger.error(f"❌ Engine cycle error: {e}", exc_info=True)
            time.sleep(30)  # Wait 30s on error before retrying


if __name__ == "__main__":
    start_engine()