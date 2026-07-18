"""
Quantitative Analysis Module — Layer 3 of the 3-Layer Verification System.
(This module uses STATISTICAL MATH to evaluate if a trade setup is good)

PURPOSE:
    The final verification layer before a trade is executed. While Layer 1
    (Technical Analysis) looks at price patterns and Layer 2 (Sentiment)
    looks at news, this layer uses pure mathematics and statistics to 
    determine if the trade has a good risk/reward profile.

METRICS CALCULATED:
    1. Volatility (standard deviation of daily returns)
       - Low volatility = stable, good for conservative trades
       - High volatility = risky, wider stops needed
    
    2. ATR (Average True Range)
       - Measures how much the price moves in a typical day
       - Used to estimate appropriate stop-loss distances
    
    3. Momentum (Rate of Change)
       - Positive momentum supports BUY signals
       - Negative momentum supports SELL signals
       - Conflicting momentum = red flag
    
    4. Mean Reversion Z-Score
       - How many standard deviations price is from its average
       - Very low = potential bounce up (good for BUY)
       - Very high = potential pullback (good for SELL)
    
    5. Sharpe Ratio (risk-adjusted returns)
       - > 1.0 = excellent risk-adjusted performance
       - < 0.5 = poor returns for the risk taken
    
    6. Risk/Reward Ratio
       - > 2.0 = excellent setup (potential reward is 2x the risk)
       - < 1.0 = bad setup (risk exceeds reward)
    
    7. Trend Strength
       - High = strong directional trend, good for trend-following
       - Low = choppy market, trades likely to get stopped out

VERDICTS:
    FAVORABLE: avg score > +0.15 (the math supports the trade)
    UNFAVORABLE: avg score < -0.15 (the math is against the trade)
    NEUTRAL: score between -0.15 and +0.15 (inconclusive — soft pass)
"""

import logging
import yfinance as yf
import numpy as np

logger = logging.getLogger("quantitative_analysis")


def analyze(symbol: str, trade_direction: str = "BUY") -> dict:
    """
    Run quantitative analysis on a symbol.
    trade_direction: "BUY" or "SELL" — affects directional scoring.
    Returns: {"verdict": "FAVORABLE/UNFAVORABLE/NEUTRAL", "confidence": 0.0-1.0, "metrics": {...}, "reasoning": "..."}
    """
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="3mo", interval="1d")

        if hist.empty or len(hist) < 20:
            logger.warning(f"   ⚠️ QA: Not enough data for {symbol}")
            return _neutral_result("Insufficient data for quantitative analysis")

        closes = hist["Close"].values
        highs = hist["High"].values
        lows = hist["Low"].values

        # ─── Calculate Metrics ───
        volatility = _calculate_volatility(closes)
        atr = _calculate_atr(highs, lows, closes)
        momentum = _calculate_momentum(closes)
        mean_rev_score = _mean_reversion_score(closes)
        sharpe = _calculate_sharpe_ratio(closes)
        risk_reward = _estimate_risk_reward(closes, atr, trade_direction)
        trend_strength = _calculate_trend_strength(closes)

        current_price = closes[-1]

        # ─── Score Each Metric ───
        scores = []
        reasons = []

        # Volatility Assessment
        if volatility < 0.015:
            scores.append(0.3)
            reasons.append(f"Low volatility ({volatility:.3f}) — stable conditions, good for conservative trades")
        elif volatility > 0.05:
            scores.append(-0.3)
            reasons.append(f"High volatility ({volatility:.3f}) — risky conditions, wider stops needed")
        else:
            scores.append(0.1)
            reasons.append(f"Moderate volatility ({volatility:.3f}) — normal trading conditions")

        # Momentum Score
        is_long = trade_direction == "BUY"
        if is_long and momentum > 0.02:
            scores.append(0.7)
            reasons.append(f"Strong upward momentum ({momentum:+.2%})")
        elif is_long and momentum < -0.02:
            scores.append(-0.5)
            reasons.append(f"Negative momentum ({momentum:+.2%}) conflicts with BUY signal")
        elif not is_long and momentum < -0.02:
            scores.append(0.7)
            reasons.append(f"Strong downward momentum ({momentum:+.2%}) supports SELL")
        elif not is_long and momentum > 0.02:
            scores.append(-0.5)
            reasons.append(f"Positive momentum ({momentum:+.2%}) conflicts with SELL signal")
        else:
            scores.append(0.0)
            reasons.append(f"Weak momentum ({momentum:+.2%})")

        # Mean Reversion
        if is_long and mean_rev_score < -1.5:
            scores.append(0.6)
            reasons.append(f"Price {abs(mean_rev_score):.1f} std devs below mean — reversion potential (bullish)")
        elif not is_long and mean_rev_score > 1.5:
            scores.append(0.6)
            reasons.append(f"Price {mean_rev_score:.1f} std devs above mean — reversion potential (bearish)")
        elif abs(mean_rev_score) > 2.0:
            scores.append(-0.3)
            reasons.append(f"Extreme deviation ({mean_rev_score:+.1f} std devs) — caution")
        else:
            scores.append(0.1)
            reasons.append(f"Price near mean ({mean_rev_score:+.1f} std devs)")

        # Sharpe Ratio (Risk-adjusted returns)
        if sharpe > 1.0:
            scores.append(0.5)
            reasons.append(f"Sharpe ratio {sharpe:.2f} — excellent risk-adjusted performance")
        elif sharpe > 0.5:
            scores.append(0.3)
            reasons.append(f"Sharpe ratio {sharpe:.2f} — decent risk-adjusted performance")
        elif sharpe < -0.5:
            scores.append(-0.5)
            reasons.append(f"Sharpe ratio {sharpe:.2f} — poor risk-adjusted returns")
        else:
            scores.append(0.0)
            reasons.append(f"Sharpe ratio {sharpe:.2f} — mediocre")

        # Risk/Reward Ratio
        if risk_reward > 2.0:
            scores.append(0.6)
            reasons.append(f"Risk/Reward ratio {risk_reward:.1f}:1 — excellent setup")
        elif risk_reward > 1.5:
            scores.append(0.3)
            reasons.append(f"Risk/Reward ratio {risk_reward:.1f}:1 — acceptable setup")
        elif risk_reward < 1.0:
            scores.append(-0.4)
            reasons.append(f"Risk/Reward ratio {risk_reward:.1f}:1 — unfavorable, risk exceeds reward")
        else:
            scores.append(0.0)
            reasons.append(f"Risk/Reward ratio {risk_reward:.1f}:1")

        # Trend Strength
        if trend_strength > 0.6:
            scores.append(0.4)
            reasons.append(f"Strong trend (ADX-proxy: {trend_strength:.2f}) — trend-following favorable")
        elif trend_strength < 0.2:
            scores.append(-0.2)
            reasons.append(f"Weak/no trend ({trend_strength:.2f}) — choppy market")
        else:
            scores.append(0.1)
            reasons.append(f"Moderate trend ({trend_strength:.2f})")

        # ─── Aggregate ───
        avg_score = np.mean(scores)
        confidence = min(abs(avg_score), 1.0)

        if avg_score > 0.15:
            verdict = "FAVORABLE"
        elif avg_score < -0.15:
            verdict = "UNFAVORABLE"
        else:
            verdict = "NEUTRAL"

        result = {
            "verdict": verdict,
            "confidence": round(confidence, 3),
            "score": round(avg_score, 4),
            "metrics": {
                "volatility": round(volatility, 4),
                "atr": round(atr, 4),
                "momentum": round(momentum, 4),
                "mean_reversion_zscore": round(mean_rev_score, 2),
                "sharpe_ratio": round(sharpe, 2),
                "risk_reward_ratio": round(risk_reward, 2),
                "trend_strength": round(trend_strength, 2),
                "current_price": round(current_price, 2),
            },
            "reasoning": " | ".join(reasons),
        }

        emoji = "🟢" if verdict == "FAVORABLE" else "🔴" if verdict == "UNFAVORABLE" else "⚪"
        logger.info(f"   📐 {emoji} QA → {symbol}: {verdict} (confidence: {confidence:.3f}, score: {avg_score:+.4f})")

        return result

    except Exception as e:
        logger.error(f"   ❌ QA Error for {symbol}: {e}", exc_info=True)
        return _neutral_result(f"Quantitative analysis error: {e}")


# ─── METRIC CALCULATIONS ─────────────────────────────────────────────

def _calculate_volatility(closes: np.ndarray, period: int = 20) -> float:
    """Calculate annualized volatility (std dev of daily returns)."""
    if len(closes) < 2:
        return 0.0
    returns = np.diff(closes) / closes[:-1]
    return float(np.std(returns[-period:]))


def _calculate_atr(highs: np.ndarray, lows: np.ndarray, closes: np.ndarray, period: int = 14) -> float:
    """Calculate Average True Range."""
    if len(closes) < 2:
        return 0.0
    tr_list = []
    for i in range(1, min(period + 1, len(closes))):
        tr = max(
            highs[-i] - lows[-i],
            abs(highs[-i] - closes[-i - 1]),
            abs(lows[-i] - closes[-i - 1])
        )
        tr_list.append(tr)
    return float(np.mean(tr_list)) if tr_list else 0.0


def _calculate_momentum(closes: np.ndarray, period: int = 10) -> float:
    """Calculate rate of change (momentum)."""
    if len(closes) < period + 1:
        return 0.0
    return (closes[-1] - closes[-period - 1]) / closes[-period - 1]


def _mean_reversion_score(closes: np.ndarray, period: int = 50) -> float:
    """Calculate Z-score: how many std devs price is from its mean."""
    if len(closes) < period:
        period = len(closes)
    mean = np.mean(closes[-period:])
    std = np.std(closes[-period:])
    if std == 0:
        return 0.0
    return (closes[-1] - mean) / std


def _calculate_sharpe_ratio(closes: np.ndarray, period: int = 30, risk_free_rate: float = 0.05) -> float:
    """Calculate Sharpe ratio (annualized)."""
    if len(closes) < 2:
        return 0.0
    returns = np.diff(closes[-period:]) / closes[-period:-1]
    if len(returns) == 0 or np.std(returns) == 0:
        return 0.0
    excess_return = np.mean(returns) - (risk_free_rate / 252)
    return float(excess_return / np.std(returns) * np.sqrt(252))


def _estimate_risk_reward(closes: np.ndarray, atr: float, direction: str) -> float:
    """Estimate risk/reward ratio based on ATR and recent price action."""
    if atr == 0 or len(closes) < 10:
        return 1.0

    current = closes[-1]
    recent_range = max(closes[-10:]) - min(closes[-10:])

    # Estimated reward = recent range (potential move)
    # Estimated risk = 1.5x ATR (typical stop distance)
    risk = 1.5 * atr
    reward = recent_range * 0.5  # Conservative: aim for half the recent range

    if risk == 0:
        return 1.0
    return reward / risk


def _calculate_trend_strength(closes: np.ndarray, period: int = 14) -> float:
    """Simple trend strength indicator (0-1). Higher = stronger trend."""
    if len(closes) < period:
        return 0.5

    # Calculate directional consistency
    changes = np.diff(closes[-period:])
    positive = np.sum(changes > 0)
    total = len(changes)

    # Trend strength = how consistently price moves in one direction
    consistency = abs(positive - (total - positive)) / total

    # Also consider magnitude
    total_move = abs(closes[-1] - closes[-period])
    avg_bar = np.mean(np.abs(changes))
    efficiency = total_move / (avg_bar * total) if avg_bar * total > 0 else 0

    return min((consistency + efficiency) / 2, 1.0)


def _neutral_result(reason: str) -> dict:
    return {
        "verdict": "NEUTRAL",
        "confidence": 0.0,
        "score": 0.0,
        "metrics": {},
        "reasoning": reason,
    }
