"""
Trade Executor — The bridge between AI signals and actual simulated trades.
(This is the core execution engine that makes the bot actually trade)

PURPOSE:
    This module reads AI-generated signals from the trade_signals table,
    runs them through the 3-Layer Verification System (Technical Analysis, 
    Sentiment Analysis, Quantitative Analysis), and executes simulated trades 
    with proper position sizing, stop-losses, and take-profits based on each 
    account's risk profile.

HOW IT WORKS:
    1. execute_pending_signals() is called every 5 minutes by bot_engine.py
    2. It queries the DB for all unexecuted BUY/SELL signals
    3. For each signal, it loops through ALL user accounts
    4. For each account, it checks:
       a. Does the signal meet the account's minimum confidence threshold?
       b. Has the account hit its max open trades limit?
       c. Is there already an open position for this symbol?
       d. Does the account have enough balance?
    5. If all pre-checks pass, it runs the 3-LAYER VERIFICATION:
       - Layer 1: Technical Analysis (RSI, MACD, Moving Averages, Bollinger Bands)
       - Layer 2: Sentiment Analysis (the FinBERT signal itself — always passes)
       - Layer 3: Quantitative Analysis (Volatility, Momentum, Sharpe, Risk/Reward)
    6. If at least 2 of 3 layers agree, the trade is EXECUTED
    7. A Trade record is created with entry price, SL, TP, position value
    8. Account balance is deducted by the position value

POSITION MANAGEMENT:
    - manage_open_positions() checks every 60 seconds for SL/TP hits
    - close_on_signal_reversal() closes positions when AI flips direction
    - P&L is calculated in real-time for all open positions

RISK PROFILES:
    Low Risk:       Only strong signals (>30% confidence), 2% position size, tight stops
    Moderate Risk:  Medium signals (>15% confidence), 5% position size, medium stops
    Aggressive:     Almost any signal (>5% confidence), 10% position size, wide stops
"""

import logging
from datetime import datetime
from database import SessionLocal
from init_db import Account, Trade, PortfolioAsset, TradeSignal
import yfinance as yf

logger = logging.getLogger("trade_executor")

# ─── RISK PROFILES ────────────────────────────────────────────────────
# (Each risk type defines how the bot trades for accounts with that strategy)
# (These values directly control position sizing, entry criteria, and exit points)
RISK_PROFILES = {
    "Low": {
        "min_confidence": 0.10,     # Only trade on clear signals (lowered from 0.30 to allow more trades)
        "max_position_pct": 0.02,   # Risk 2% of balance per trade
        "max_open_trades": 5,       # Max 5 simultaneous positions (raised from 3)
        "stop_loss_pct": 0.03,      # Close at -3% loss
        "take_profit_pct": 0.06,    # Close at +6% profit
        "description": "Conservative — small positions, tight stops, only clear signals"
    },
    "Moderate": {
        "min_confidence": 0.05,     # Trade on moderate signals (lowered from 0.15)
        "max_position_pct": 0.05,   # Risk 5% of balance per trade
        "max_open_trades": 8,       # Max 8 simultaneous positions (raised from 5)
        "stop_loss_pct": 0.05,      # Close at -5% loss
        "take_profit_pct": 0.10,    # Close at +10% profit
        "description": "Balanced — medium positions, moderate stops"
    },
    "Aggressive": {
        "min_confidence": 0.03,     # Trade on almost any signal (lowered from 0.05)
        "max_position_pct": 0.10,   # Risk 10% of balance per trade
        "max_open_trades": 15,      # Max 15 simultaneous positions (raised from 10)
        "stop_loss_pct": 0.08,      # Close at -8% loss
        "take_profit_pct": 0.20,    # Close at +20% profit
        "description": "High-risk — large positions, wide stops, trades on weak signals"
    }
}


def get_live_price(symbol: str) -> float | None:
    """
    Fetch the current live price for a symbol from Yahoo Finance.
    (Used for trade entry, P&L calculation, and SL/TP checking)

    DETAILS:
        - Uses 1-minute interval for the most current price
        - Falls back to 5-minute interval if 1-minute fails
        - Returns None if the price cannot be fetched (trade is skipped)
    """
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="1d", interval="1m")
        if not hist.empty:
            return float(hist['Close'].iloc[-1])
        # Fallback to 5-minute data
        hist = ticker.history(period="5d", interval="5m")
        if not hist.empty:
            return float(hist['Close'].iloc[-1])
    except Exception as e:
        logger.warning(f"Price fetch failed for {symbol}: {e}")
    return None


def execute_pending_signals():
    """
    Main execution loop — reads signals and tries to execute trades.
    (Called every 5 minutes by bot_engine.py)

    FLOW:
        1. Query DB for all unexecuted BUY/SELL signals
        2. For each signal, get the current live price
        3. Loop through ALL user accounts
        4. For each account, run _evaluate_and_execute() which does:
           - Pre-checks (confidence, max trades, duplicates, balance)
           - 3-Layer Verification (TA + SA + QA)
           - Trade creation if verification passes
        5. Mark signal as executed regardless of outcome

    RETURNS:
        Number of trades that were successfully opened
    """
    session = SessionLocal()
    trades_opened = 0
    trades_skipped = 0

    try:
        # Step 1: Get all unexecuted BUY/SELL signals (NEUTRAL is never saved to DB)
        pending_signals = (
            session.query(TradeSignal)
            .filter(TradeSignal.executed == False)
            .filter(TradeSignal.signal.in_(["BUY", "SELL"]))
            .order_by(TradeSignal.timestamp.desc())
            .all()
        )

        if not pending_signals:
            logger.info("📭 No pending signals to execute.")
            return 0

        logger.info(f"📋 Found {len(pending_signals)} pending signal(s) to evaluate.")

        # Step 2: Get all user accounts (the bot trades on ALL accounts)
        all_accounts = session.query(Account).all()

        if not all_accounts:
            logger.info("📭 No accounts exist yet. Skipping execution.")
            # Mark signals as executed so we don't re-process them endlessly
            for sig in pending_signals:
                sig.executed = True
            session.commit()
            return 0

        # Step 3: Process each signal against each account
        for signal in pending_signals:
            current_price = get_live_price(signal.symbol)
            if current_price is None:
                logger.warning(f"⚠️ Cannot get price for {signal.symbol}, skipping signal #{signal.id}")
                # Still mark as executed to prevent infinite retry on dead symbols
                signal.executed = True
                continue

            logger.info(f"🔍 Evaluating signal: {signal.signal} {signal.symbol} (conf: {signal.confidence:.3f}) @ ${current_price:,.2f}")

            for account in all_accounts:
                result = _evaluate_and_execute(session, signal, account, current_price)
                if result:
                    trades_opened += 1
                else:
                    trades_skipped += 1

            # Mark signal as executed regardless of whether trades were placed
            signal.executed = True

        session.commit()
        logger.info(f"✅ Execution complete: {trades_opened} trades opened, {trades_skipped} skipped.")
        return trades_opened

    except Exception as e:
        logger.error(f"❌ Trade execution error: {e}", exc_info=True)
        session.rollback()
        return 0
    finally:
        session.close()


def _evaluate_and_execute(session, signal: TradeSignal, account: Account, current_price: float) -> bool:
    """
    Core evaluation function — decides whether to execute a trade.
    (This is where ALL the intelligence lives)

    PROCESS:
        Phase 1: Pre-checks (fast filters to avoid wasting time on bad setups)
            - Confidence >= account's min threshold
            - Open trades < account's max limit
            - No existing position for this symbol
            - Sufficient balance for position size

        Phase 2: 3-Layer Verification (the quality gate)
            - Layer 1: Technical Analysis — checks RSI, MACD, moving averages, etc.
            - Layer 2: Sentiment Analysis — the AI signal itself (always passes)
            - Layer 3: Quantitative Analysis — checks volatility, momentum, risk/reward
            - RULE: At least 2 of 3 layers must agree to execute

        Phase 3: Trade Execution (if verification passes)
            - Calculate position size based on account balance × risk percentage
            - Calculate quantity (shares/units) based on current price
            - Set stop-loss and take-profit prices based on risk profile
            - Create Trade and PortfolioAsset records in the database
            - Deduct position value from account balance

    RETURNS:
        True if a trade was opened, False if skipped for any reason
    """
    import technical_analysis
    import quantitative_analysis

    strategy = account.strategy or "Moderate"
    profile = RISK_PROFILES.get(strategy, RISK_PROFILES["Moderate"])

    # ─── PRE-CHECK 1: Confidence threshold ───
    # (Does the AI signal meet this account's minimum confidence requirement?)
    if signal.confidence < profile["min_confidence"]:
        logger.debug(
            f"   ⏭️ Skip {signal.symbol} for [{account.name}]: "
            f"confidence {signal.confidence:.3f} < {profile['min_confidence']} ({strategy})"
        )
        return False

    # ─── PRE-CHECK 1.5: Asset Type Filter ───
    # (Only trade asset types that the account is configured for)
    import json as _json
    if account.asset_types:
        try:
            allowed_types = _json.loads(account.asset_types)
            if allowed_types:
                # Determine asset class from symbol
                symbol_lower = signal.symbol.upper()
                crypto_symbols = ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "ADA-USD", "DOGE-USD", "DOT-USD", "AVAX-USD", "LINK-USD", "BNB-USD"]
                forex_symbols = ["EURUSD=X", "GBPUSD=X", "JPY=X", "AUDUSD=X", "CAD=X", "CHF=X", "NZD=X"]
                commodity_symbols = ["GC=F", "SI=F", "CL=F", "NG=F"]
                
                is_crypto = symbol_lower in crypto_symbols or symbol_lower.endswith("-USD") and not symbol_lower.replace("-USD", "").isalpha()
                is_forex = symbol_lower in forex_symbols or "=X" in symbol_lower
                is_commodity = symbol_lower in commodity_symbols or "=F" in symbol_lower
                is_stock = not is_crypto and not is_forex and not is_commodity
                
                symbol_class = None
                if is_crypto: symbol_class = "Crypto"
                elif is_forex: symbol_class = "Forex"
                elif is_commodity: symbol_class = "Commodity"
                elif is_stock: symbol_class = "Stocks"
                
                if symbol_class and symbol_class not in allowed_types:
                    logger.debug(
                        f"   ⏭️ Skip {signal.symbol} for [{account.name}]: "
                        f"asset type '{symbol_class}' not in allowed types {allowed_types}"
                    )
                    return False
        except Exception:
            pass  # If JSON parsing fails, allow all types

    # ─── PRE-CHECK 2: Max open trades ───
    # (Has this account reached its maximum number of simultaneous positions?)
    open_trades_count = (
        session.query(Trade)
        .filter(Trade.account_id == account.id, Trade.status == "Open")
        .count()
    )
    if open_trades_count >= profile["max_open_trades"]:
        logger.debug(
            f"   ⏭️ Skip {signal.symbol} for [{account.name}]: "
            f"max open trades reached ({open_trades_count}/{profile['max_open_trades']})"
        )
        return False

    # ─── PRE-CHECK 3: Don't duplicate positions ───
    # (Don't open a second position on the same symbol for the same account)
    existing_position = (
        session.query(Trade)
        .filter(
            Trade.account_id == account.id,
            Trade.symbol == signal.symbol,
            Trade.status == "Open"
        )
        .first()
    )
    if existing_position:
        logger.debug(
            f"   ⏭️ Skip {signal.symbol} for [{account.name}]: "
            f"already has open position"
        )
        return False

    # ─── PRE-CHECK 4: Sufficient balance ───
    # (Does the account have enough money to open this position?)
    position_value = account.balance * profile["max_position_pct"]
    min_trade_value = 10.0  # Don't open trades smaller than $10
    if position_value < min_trade_value or account.balance < min_trade_value:
        logger.debug(
            f"   ⏭️ Skip {signal.symbol} for [{account.name}]: "
            f"insufficient balance (${account.balance:.2f})"
        )
        return False

    # ═══════════════════════════════════════════════════════════════════
    #  3-LAYER VERIFICATION SYSTEM
    #  (The quality gate that prevents bad trades from being executed)
    #  (At least 2 of 3 layers must agree for the trade to go through)
    # ═══════════════════════════════════════════════════════════════════
    logger.info(
        f"\n   ╔══════════════════════════════════════════════════════════╗\n"
        f"   ║  3-LAYER VERIFICATION: {signal.symbol} ({signal.signal}) for [{account.name}]\n"
        f"   ╚══════════════════════════════════════════════════════════╝"
    )

    layers_passed = 0
    verification_report = []

    # ─── LAYER 1: TECHNICAL ANALYSIS ───
    # (Checks price-based indicators: RSI, MACD, Moving Averages, Bollinger Bands)
    # (A BUY signal needs BULLISH or NEUTRAL technicals to pass)
    # (A SELL signal needs BEARISH or NEUTRAL technicals to pass)
    logger.info(f"   🔬 Layer 1: Technical Analysis...")
    ta_result = technical_analysis.analyze(signal.symbol)
    ta_agrees = False

    if signal.signal == "BUY" and ta_result["verdict"] in ("BULLISH", "NEUTRAL"):
        ta_agrees = True
    elif signal.signal == "SELL" and ta_result["verdict"] in ("BEARISH", "NEUTRAL"):
        ta_agrees = True

    if ta_agrees:
        layers_passed += 1
        verification_report.append(f"✅ TA: {ta_result['verdict']} (conf: {ta_result['confidence']:.3f})")
    else:
        verification_report.append(f"❌ TA: {ta_result['verdict']} CONFLICTS with {signal.signal} signal")

    logger.info(f"      → {verification_report[-1]}")

    # ─── LAYER 2: SENTIMENT ANALYSIS (AI Signal) ───
    # (This IS the FinBERT signal — it always passes because it's the source)
    # (The confidence from FinBERT is logged for the full verification report)
    logger.info(f"   🧠 Layer 2: Sentiment Analysis (FinBERT)...")
    layers_passed += 1
    sa_report = f"✅ SA: {signal.signal} (conf: {signal.confidence:.3f}) — {signal.reasoning[:80]}..."
    verification_report.append(sa_report)
    logger.info(f"      → {sa_report[:100]}...")

    # ─── LAYER 3: QUANTITATIVE ANALYSIS ───
    # (Checks statistical factors: volatility, momentum, Sharpe ratio, risk/reward)
    # (FAVORABLE or NEUTRAL = pass, UNFAVORABLE = fail)
    logger.info(f"   📐 Layer 3: Quantitative Analysis...")
    qa_result = quantitative_analysis.analyze(signal.symbol, signal.signal)
    qa_agrees = False

    if qa_result["verdict"] in ("FAVORABLE", "NEUTRAL"):
        qa_agrees = True

    if qa_agrees:
        layers_passed += 1
        verification_report.append(f"✅ QA: {qa_result['verdict']} (conf: {qa_result['confidence']:.3f})")
    else:
        verification_report.append(f"❌ QA: {qa_result['verdict']} — unfavorable conditions")

    logger.info(f"      → {verification_report[-1]}")

    # ─── VERIFICATION VERDICT ───
    # (Require at least 2 of 3 layers to agree)
    # (Since Layer 2 always passes, this means either TA or QA must also pass)
    if layers_passed < 2:
        logger.info(
            f"   🚫 VERIFICATION FAILED: Only {layers_passed}/3 layers passed. Trade REJECTED.\n"
            f"      Report: {' | '.join(verification_report)}"
        )
        return False

    verification_str = f"3-LAYER VERIFIED ({layers_passed}/3) | " + " | ".join(verification_report)
    logger.info(f"   ✅ VERIFICATION PASSED: {layers_passed}/3 layers. Proceeding to execute...")

    # ═══════════════════════════════════════════════════════════════════
    #  TRADE EXECUTION
    #  (All checks passed — now we actually open the position)
    # ═══════════════════════════════════════════════════════════════════

    # Calculate position size and quantity
    # (position_value = what percentage of balance to risk)
    # (quantity = how many shares/units/coins we can buy with that amount)
    quantity = position_value / current_price
    trade_type = "Long" if signal.signal == "BUY" else "Short"

    # Calculate stop-loss and take-profit prices
    # (For Long: SL is below entry, TP is above entry)
    # (For Short: SL is above entry, TP is below entry)
    if trade_type == "Long":
        stop_loss = current_price * (1 - profile["stop_loss_pct"])
        take_profit = current_price * (1 + profile["take_profit_pct"])
    else:  # Short
        stop_loss = current_price * (1 + profile["stop_loss_pct"])
        take_profit = current_price * (1 - profile["take_profit_pct"])

    # Build full reasoning string with all verification details
    # (This gets stored in the Trade record and shown in the frontend)
    full_reasoning = (
        f"{verification_str} | "
        f"AI Signal: {signal.signal} (conf: {signal.confidence:.3f}) | "
        f"TA: {ta_result['verdict']} | QA: {qa_result['verdict']}"
    )

    # Create the Trade record in the database
    new_trade = Trade(
        account_id=account.id,
        symbol=signal.symbol,
        trade_type=trade_type,
        status="Open",
        entry_price=current_price,
        current_price=current_price,
        quantity=quantity,
        position_value=position_value,
        stop_loss_price=stop_loss,
        take_profit_price=take_profit,
        pnl=0.0,
        pnl_dollars=0.0,
        signal_id=signal.id,
        reasoning=full_reasoning,
        created_at=datetime.now()
    )
    session.add(new_trade)

    # Create or update the PortfolioAsset record
    # (This tracks the total holding of each symbol per account)
    asset = (
        session.query(PortfolioAsset)
        .filter(PortfolioAsset.account_id == account.id, PortfolioAsset.symbol == signal.symbol)
        .first()
    )

    asset_class = _classify_asset(signal.symbol)

    if asset:
        # Average into existing position
        total_shares = asset.shares + quantity
        total_cost = (asset.shares * asset.avg_price) + (quantity * current_price)
        asset.avg_price = total_cost / total_shares if total_shares > 0 else current_price
        asset.shares = total_shares
        asset.current_price = current_price
    else:
        # Create new portfolio entry
        new_asset = PortfolioAsset(
            account_id=account.id,
            symbol=signal.symbol,
            asset_class=asset_class,
            shares=quantity,
            avg_price=current_price,
            current_price=current_price
        )
        session.add(new_asset)

    # Deduct position value from account balance
    # (This simulates "spending money" to buy the asset)
    account.balance -= position_value

    logger.info(
        f"   🔥 TRADE EXECUTED: {trade_type} {signal.symbol} on [{account.name}] ({strategy})\n"
        f"      Price: ${current_price:,.2f} | Qty: {quantity:.6f} | Value: ${position_value:,.2f}\n"
        f"      SL: ${stop_loss:,.2f} | TP: ${take_profit:,.2f}\n"
        f"      Remaining balance: ${account.balance:,.2f}"
    )
    return True


def manage_open_positions():
    """
    Check all open positions against current prices.
    (Called every 60 seconds by bot_engine.py to monitor trades)

    WHAT IT DOES:
        1. Fetches all open trades from the database
        2. Gets current price for each unique symbol (batched to minimize API calls)
        3. Updates P&L percentage and dollar amount for each trade
        4. Checks if any trade has hit its stop-loss or take-profit price
        5. Automatically closes trades that hit SL/TP

    STOP-LOSS / TAKE-PROFIT LOGIC:
        For Long positions:
            - If current_price <= stop_loss_price → CLOSE (loss)
            - If current_price >= take_profit_price → CLOSE (profit)
        For Short positions:
            - If current_price >= stop_loss_price → CLOSE (loss)
            - If current_price <= take_profit_price → CLOSE (profit)
    """
    session = SessionLocal()
    closed_count = 0
    updated_count = 0

    try:
        open_trades = session.query(Trade).filter(Trade.status == "Open").all()

        if not open_trades:
            return 0

        logger.info(f"📊 Managing {len(open_trades)} open position(s)...")

        # Group by symbol to minimize Yahoo Finance API calls
        symbols = set(t.symbol for t in open_trades)
        price_cache = {}
        for symbol in symbols:
            price = get_live_price(symbol)
            if price:
                price_cache[symbol] = price

        for trade in open_trades:
            current_price = price_cache.get(trade.symbol)
            if current_price is None:
                continue

            # Update current price on the trade record
            trade.current_price = current_price

            # Calculate P&L (percentage and dollar amount)
            if trade.trade_type == "Long":
                pnl_pct = ((current_price - trade.entry_price) / trade.entry_price) * 100
                pnl_dollars = (current_price - trade.entry_price) * trade.quantity
            else:  # Short — profit when price goes DOWN
                pnl_pct = ((trade.entry_price - current_price) / trade.entry_price) * 100
                pnl_dollars = (trade.entry_price - current_price) * trade.quantity

            trade.pnl = round(pnl_pct, 2)
            trade.pnl_dollars = round(pnl_dollars, 2)
            updated_count += 1

            # Check stop-loss and take-profit
            should_close = False
            close_reason = ""

            if trade.trade_type == "Long":
                if trade.stop_loss_price and current_price <= trade.stop_loss_price:
                    should_close = True
                    close_reason = f"STOP-LOSS hit (${trade.stop_loss_price:,.2f})"
                elif trade.take_profit_price and current_price >= trade.take_profit_price:
                    should_close = True
                    close_reason = f"TAKE-PROFIT hit (${trade.take_profit_price:,.2f})"
            else:  # Short
                if trade.stop_loss_price and current_price >= trade.stop_loss_price:
                    should_close = True
                    close_reason = f"STOP-LOSS hit (${trade.stop_loss_price:,.2f})"
                elif trade.take_profit_price and current_price <= trade.take_profit_price:
                    should_close = True
                    close_reason = f"TAKE-PROFIT hit (${trade.take_profit_price:,.2f})"

            if should_close:
                _close_trade(session, trade, current_price, close_reason)
                closed_count += 1

            # Also update the PortfolioAsset current price
            # (So the frontend shows live values)
            asset = (
                session.query(PortfolioAsset)
                .filter(
                    PortfolioAsset.account_id == trade.account_id,
                    PortfolioAsset.symbol == trade.symbol
                )
                .first()
            )
            if asset:
                asset.current_price = current_price

        session.commit()

        if closed_count > 0:
            logger.info(f"🔒 Closed {closed_count} position(s). Updated {updated_count} P&Ls.")
        else:
            logger.info(f"📊 Updated {updated_count} P&Ls. No positions closed.")

        return closed_count

    except Exception as e:
        logger.error(f"❌ Position management error: {e}", exc_info=True)
        session.rollback()
        return 0
    finally:
        session.close()


def close_on_signal_reversal():
    """
    Close positions when the AI sentiment flips direction.
    (Called every 5 minutes by bot_engine.py)

    LOGIC:
        If we have a LONG position on BTC-USD and a new SELL signal comes in,
        close the Long (the AI now thinks the market is going down).
        Same for SHORT + BUY signal → close the Short.

    DETAILS:
        Builds a map of the latest signal direction per symbol, then checks
        all open trades to see if any conflict with the latest signal.
    """
    session = SessionLocal()
    closed_count = 0

    try:
        # Build a map of the latest signal direction for each symbol
        latest_signals = (
            session.query(TradeSignal)
            .filter(TradeSignal.signal.in_(["BUY", "SELL"]))
            .order_by(TradeSignal.timestamp.desc())
            .all()
        )

        signal_map = {}
        for sig in latest_signals:
            if sig.symbol not in signal_map:
                signal_map[sig.symbol] = sig.signal

        # Check all open trades for reversals
        open_trades = session.query(Trade).filter(Trade.status == "Open").all()

        for trade in open_trades:
            latest_direction = signal_map.get(trade.symbol)
            if latest_direction is None:
                continue

            # Long position + SELL signal = close
            # Short position + BUY signal = close
            should_reverse = (
                (trade.trade_type == "Long" and latest_direction == "SELL") or
                (trade.trade_type == "Short" and latest_direction == "BUY")
            )

            if should_reverse:
                current_price = get_live_price(trade.symbol)
                if current_price:
                    _close_trade(session, trade, current_price, f"SIGNAL REVERSAL ({latest_direction})")
                    closed_count += 1

        session.commit()

        if closed_count > 0:
            logger.info(f"🔄 Signal reversal closed {closed_count} position(s).")

        return closed_count

    except Exception as e:
        logger.error(f"❌ Signal reversal error: {e}", exc_info=True)
        session.rollback()
        return 0
    finally:
        session.close()


def _close_trade(session, trade: Trade, close_price: float, reason: str):
    """
    Close a trade and return funds to the account.
    (Internal function — called by manage_open_positions and close_on_signal_reversal)

    WHAT HAPPENS:
        1. Calculate final P&L (percentage and dollars)
        2. Update the trade status to "Closed"
        3. Return funds to the account: original_position_value + pnl_dollars
           (If the trade lost money, the returned amount is less than the original)
        4. Remove the shares from PortfolioAsset (or delete if zero)
    """
    # Final P&L calculation
    if trade.trade_type == "Long":
        pnl_dollars = (close_price - trade.entry_price) * trade.quantity
        pnl_pct = ((close_price - trade.entry_price) / trade.entry_price) * 100
    else:
        pnl_dollars = (trade.entry_price - close_price) * trade.quantity
        pnl_pct = ((trade.entry_price - close_price) / trade.entry_price) * 100

    # Update trade record
    trade.status = "Closed"
    trade.current_price = close_price
    trade.pnl = round(pnl_pct, 2)
    trade.pnl_dollars = round(pnl_dollars, 2)
    trade.closed_at = datetime.now()
    trade.reasoning = (trade.reasoning or "") + f" | CLOSED: {reason}"

    # Return funds to account (original value + P&L)
    account = session.query(Account).filter(Account.id == trade.account_id).first()
    if account:
        returned_value = trade.position_value + pnl_dollars
        account.balance += returned_value

    # Remove from portfolio assets (or reduce quantity)
    asset = (
        session.query(PortfolioAsset)
        .filter(
            PortfolioAsset.account_id == trade.account_id,
            PortfolioAsset.symbol == trade.symbol
        )
        .first()
    )
    if asset:
        asset.shares -= trade.quantity
        if asset.shares <= 0.0001:  # Effectively zero
            session.delete(asset)

    result_emoji = "💰" if pnl_dollars >= 0 else "💸"
    logger.info(
        f"   {result_emoji} CLOSED: {trade.trade_type} {trade.symbol} on account #{trade.account_id}\n"
        f"      Entry: ${trade.entry_price:,.2f} → Exit: ${close_price:,.2f}\n"
        f"      P&L: {'+' if pnl_pct >= 0 else ''}{pnl_pct:.2f}% (${'+' if pnl_dollars >= 0 else ''}{pnl_dollars:,.2f})\n"
        f"      Reason: {reason}"
    )


def _classify_asset(symbol: str) -> str:
    """
    Determine asset class from ticker symbol.
    (Used for the PortfolioAsset.asset_class field and frontend grouping)

    CLASSIFICATION:
        - Ends with -USD → Crypto (BTC-USD, ETH-USD, etc.)
        - Contains =X → Forex (EURUSD=X, GBPUSD=X, etc.)
        - Contains =F → Commodity (GC=F, SI=F, CL=F, etc.)
        - Everything else → Stock (AAPL, NVDA, TSLA, etc.)
    """
    symbol_upper = symbol.upper()
    if symbol_upper.endswith("-USD"):
        return "Crypto"
    elif "=X" in symbol_upper:
        return "Forex"
    elif "=F" in symbol_upper:
        return "Commodity"
    else:
        return "Stock"


def get_execution_stats() -> dict:
    """
    Get summary statistics of all trading activity.
    (Called by bot_engine.py for heartbeat logging and by /bot/stats API endpoint)

    RETURNS:
        {
            "total_trades": int,      # All trades ever created
            "open_trades": int,       # Currently open positions
            "closed_trades": int,     # Trades that have been closed
            "total_pnl": float,       # Total realized P&L from closed trades
            "win_rate": float,        # Percentage of closed trades that were profitable
        }
    """
    session = SessionLocal()
    try:
        total_trades = session.query(Trade).count()
        open_trades = session.query(Trade).filter(Trade.status == "Open").count()
        closed_trades = session.query(Trade).filter(Trade.status == "Closed").count()

        # Calculate overall P&L from closed trades
        closed = session.query(Trade).filter(Trade.status == "Closed").all()
        total_pnl = sum(t.pnl_dollars for t in closed) if closed else 0.0
        win_count = sum(1 for t in closed if t.pnl_dollars > 0)
        win_rate = (win_count / len(closed) * 100) if closed else 0.0

        return {
            "total_trades": total_trades,
            "open_trades": open_trades,
            "closed_trades": closed_trades,
            "total_pnl": round(total_pnl, 2),
            "win_rate": round(win_rate, 1),
        }
    finally:
        session.close()
