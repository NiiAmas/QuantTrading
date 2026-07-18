"""
Technical Analysis Module — Layer 1 of the 3-Layer Verification System.
(This module analyzes PRICE DATA to determine if a trade setup is good)

PURPOSE:
    Before any trade is executed, this module runs a full technical analysis
    on the symbol's price history using 5 key indicators. Each indicator
    produces a score from -1.0 (very bearish) to +1.0 (very bullish).
    The scores are averaged to produce a final verdict.

INDICATORS USED:
    1. RSI (Relative Strength Index)
       - Measures if a stock is overbought (>70) or oversold (<30)
       - Oversold = potential BUY opportunity
       - Overbought = potential SELL opportunity
    
    2. MACD (Moving Average Convergence Divergence)
       - Compares fast and slow exponential moving averages
       - Bullish crossover = BUY signal
       - Bearish crossover = SELL signal
    
    3. Moving Averages (SMA 20 and SMA 50)
       - Price above SMA20 > SMA50 = strong uptrend
       - Price below SMA20 < SMA50 = strong downtrend
    
    4. Bollinger Bands
       - Price at lower band = potential bounce (bullish)
       - Price at upper band = potential pullback (bearish)
    
    5. Volume Analysis
       - High volume confirms the current trend direction
       - Low volume suggests weak conviction

SCORING:
    Each indicator gives a score: -1.0 to +1.0
    All scores are averaged to get a composite score
    avg > +0.15 → BULLISH verdict
    avg < -0.15 → BEARISH verdict
    Otherwise → NEUTRAL verdict

RETURNS:
    {
        "verdict": "BULLISH" | "BEARISH" | "NEUTRAL",
        "confidence": 0.0-1.0,
        "score": -1.0 to +1.0,
        "indicators": { rsi, macd, sma_20, sma_50, ... },
        "reasoning": "human-readable explanation"
    }
"""

import logging
import yfinance as yf
import numpy as np

logger = logging.getLogger("technical_analysis")


def analyze(symbol: str) -> dict:
    """
    Run full technical analysis on a symbol.
    Returns: {"verdict": "BULLISH/BEARISH/NEUTRAL", "confidence": 0.0-1.0, "indicators": {...}, "reasoning": "..."}
    """
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="3mo", interval="1d")

        if hist.empty or len(hist) < 20:
            logger.warning(f"   ⚠️ TA: Not enough data for {symbol} ({len(hist)} bars)")
            return _neutral_result("Insufficient price data for technical analysis")

        closes = hist["Close"].values
        highs = hist["High"].values
        lows = hist["Low"].values
        volumes = hist["Volume"].values

        # ─── Calculate Indicators ───
        rsi = _calculate_rsi(closes, period=14)
        macd_line, signal_line, macd_hist = _calculate_macd(closes)
        sma_20 = _calculate_sma(closes, 20)
        sma_50 = _calculate_sma(closes, 50)
        upper_bb, lower_bb = _calculate_bollinger_bands(closes, period=20)
        vol_trend = _analyze_volume(volumes)

        current_price = closes[-1]

        # ─── Score Each Indicator ───
        scores = []
        reasons = []

        # RSI Signal
        if rsi < 30:
            scores.append(1.0)  # Oversold → Bullish
            reasons.append(f"RSI={rsi:.1f} (oversold, bullish reversal expected)")
        elif rsi > 70:
            scores.append(-1.0)  # Overbought → Bearish
            reasons.append(f"RSI={rsi:.1f} (overbought, bearish reversal expected)")
        elif rsi < 45:
            scores.append(0.3)
            reasons.append(f"RSI={rsi:.1f} (slightly bullish)")
        elif rsi > 55:
            scores.append(-0.3)
            reasons.append(f"RSI={rsi:.1f} (slightly bearish)")
        else:
            scores.append(0.0)
            reasons.append(f"RSI={rsi:.1f} (neutral)")

        # MACD Signal
        if macd_hist > 0 and macd_line > signal_line:
            scores.append(0.8)
            reasons.append(f"MACD bullish crossover (histogram={macd_hist:.4f})")
        elif macd_hist < 0 and macd_line < signal_line:
            scores.append(-0.8)
            reasons.append(f"MACD bearish crossover (histogram={macd_hist:.4f})")
        else:
            scores.append(0.0)
            reasons.append(f"MACD neutral")

        # Moving Average Signal
        if current_price > sma_20 and sma_20 > sma_50:
            scores.append(0.7)
            reasons.append(f"Price above SMA20 ({sma_20:.2f}) > SMA50 ({sma_50:.2f}) — uptrend")
        elif current_price < sma_20 and sma_20 < sma_50:
            scores.append(-0.7)
            reasons.append(f"Price below SMA20 ({sma_20:.2f}) < SMA50 ({sma_50:.2f}) — downtrend")
        elif current_price > sma_20:
            scores.append(0.3)
            reasons.append(f"Price above SMA20 ({sma_20:.2f})")
        else:
            scores.append(-0.3)
            reasons.append(f"Price below SMA20 ({sma_20:.2f})")

        # Bollinger Band Signal
        if current_price <= lower_bb:
            scores.append(0.6)
            reasons.append(f"Price at lower Bollinger Band (${lower_bb:.2f}) — potential bounce")
        elif current_price >= upper_bb:
            scores.append(-0.6)
            reasons.append(f"Price at upper Bollinger Band (${upper_bb:.2f}) — potential pullback")
        else:
            scores.append(0.0)
            reasons.append(f"Price within Bollinger Bands")

        # Volume confirmation
        if vol_trend > 1.5:
            # Strong volume confirms the trend
            scores.append(0.3 if sum(scores) > 0 else -0.3)
            reasons.append(f"Volume {vol_trend:.1f}x above average — confirms trend")
        else:
            scores.append(0.0)
            reasons.append(f"Volume normal ({vol_trend:.1f}x average)")

        # ─── Aggregate Score ───
        avg_score = np.mean(scores)
        confidence = min(abs(avg_score), 1.0)

        if avg_score > 0.15:
            verdict = "BULLISH"
        elif avg_score < -0.15:
            verdict = "BEARISH"
        else:
            verdict = "NEUTRAL"

        result = {
            "verdict": verdict,
            "confidence": round(confidence, 3),
            "score": round(avg_score, 4),
            "indicators": {
                "rsi": round(rsi, 2),
                "macd": round(macd_line, 4),
                "macd_signal": round(signal_line, 4),
                "macd_histogram": round(macd_hist, 4),
                "sma_20": round(sma_20, 2),
                "sma_50": round(sma_50, 2),
                "bollinger_upper": round(upper_bb, 2),
                "bollinger_lower": round(lower_bb, 2),
                "current_price": round(current_price, 2),
                "volume_ratio": round(vol_trend, 2),
            },
            "reasoning": " | ".join(reasons),
        }

        emoji = "🟢" if verdict == "BULLISH" else "🔴" if verdict == "BEARISH" else "⚪"
        logger.info(f"   📊 {emoji} TA → {symbol}: {verdict} (confidence: {confidence:.3f}, score: {avg_score:+.4f})")

        return result

    except Exception as e:
        logger.error(f"   ❌ TA Error for {symbol}: {e}", exc_info=True)
        return _neutral_result(f"Technical analysis error: {e}")


# ─── INDICATOR CALCULATIONS ──────────────────────────────────────────

def _calculate_rsi(closes: np.ndarray, period: int = 14) -> float:
    """Calculate Relative Strength Index."""
    deltas = np.diff(closes)
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)

    avg_gain = np.mean(gains[-period:])
    avg_loss = np.mean(losses[-period:])

    if avg_loss == 0:
        return 100.0

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi


def _calculate_macd(closes: np.ndarray, fast: int = 12, slow: int = 26, signal: int = 9):
    """Calculate MACD line, signal line, and histogram."""
    ema_fast = _ema(closes, fast)
    ema_slow = _ema(closes, slow)
    macd_line = ema_fast - ema_slow

    # Signal line is EMA of MACD values (approximate using last N)
    if len(closes) >= slow + signal:
        macd_series = []
        for i in range(slow, len(closes)):
            ef = _ema(closes[:i + 1], fast)
            es = _ema(closes[:i + 1], slow)
            macd_series.append(ef - es)
        signal_line = _ema(np.array(macd_series), signal)
    else:
        signal_line = macd_line * 0.9  # Approximate

    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def _calculate_sma(closes: np.ndarray, period: int) -> float:
    """Calculate Simple Moving Average."""
    if len(closes) < period:
        return closes[-1]
    return np.mean(closes[-period:])


def _calculate_bollinger_bands(closes: np.ndarray, period: int = 20, std_dev: float = 2.0):
    """Calculate Bollinger Bands."""
    if len(closes) < period:
        return closes[-1] * 1.02, closes[-1] * 0.98

    sma = np.mean(closes[-period:])
    std = np.std(closes[-period:])
    upper = sma + (std_dev * std)
    lower = sma - (std_dev * std)
    return upper, lower


def _analyze_volume(volumes: np.ndarray) -> float:
    """Compare recent volume to average. Returns ratio (1.0 = normal)."""
    if len(volumes) < 20:
        return 1.0
    avg_vol = np.mean(volumes[-20:])
    recent_vol = np.mean(volumes[-3:])
    if avg_vol == 0:
        return 1.0
    return recent_vol / avg_vol


def _ema(data: np.ndarray, period: int) -> float:
    """Calculate Exponential Moving Average (last value)."""
    if len(data) < period:
        return np.mean(data)
    multiplier = 2 / (period + 1)
    ema = np.mean(data[:period])
    for price in data[period:]:
        ema = (price - ema) * multiplier + ema
    return ema


def _neutral_result(reason: str) -> dict:
    """Return a neutral result with given reasoning."""
    return {
        "verdict": "NEUTRAL",
        "confidence": 0.0,
        "score": 0.0,
        "indicators": {},
        "reasoning": reason,
    }
