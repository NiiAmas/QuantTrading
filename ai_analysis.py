"""
AI Analysis Module — FinBERT-powered sentiment analysis engine.
(This is Layer 2 of the 3-Layer Verification system)

PURPOSE:
    Reads news articles from the database, runs them through the FinBERT AI model,
    and saves trading signals (BUY/SELL) back to the database for the trade executor 
    to pick up. This is the "brain" that converts raw news headlines into actionable 
    trade signals with confidence scores.

HOW IT WORKS:
    1. Loads FinBERT model lazily (only on first call — it's ~2GB)
    2. Fetches all news articles for a given symbol from the DB
    3. Tokenizes all headlines and runs them through FinBERT in one batch
    4. FinBERT outputs 3 probabilities per article: [Positive, Negative, Neutral]
    5. We average across all articles to get a compound sentiment score
    6. Score > 0.03 → BUY signal, Score < -0.03 → SELL signal
    7. Signal gets saved to trade_signals table with executed=False
    8. The trade_executor picks up unexecuted signals and runs 3-layer verification

IMPORTANT THRESHOLDS:
    - compound_score > +0.03 → BUY (lowered from 0.05 to catch more signals)
    - compound_score < -0.03 → SELL (lowered from 0.05 to catch more signals)
    - The confidence is abs(compound_score), so higher = stronger conviction
    - The 3-layer verification system prevents weak signals from becoming trades

MEMORY MANAGEMENT:
    - Model loads lazily (not at import time) to avoid startup delays
    - Model is set to eval() mode for faster inference
    - Tensors are deleted after use and garbage collected
    - CUDA cache is cleared if GPU is available
"""

import logging
import torch
import gc
from database import SessionLocal
from init_db import NewsArticle, TradeSignal

logger = logging.getLogger("ai_analysis")

# ─── LAZY MODEL LOADING ──────────────────────────────────────────────
# (Don't load the 2GB FinBERT model at import time — wait until first call)
_tokenizer = None
_model = None
_model_loaded = False


def _load_model():
    """
    Load FinBERT model lazily on first use.
    (This function is called automatically before the first analysis)

    DETAILS:
        - Downloads ProsusAI/finbert from HuggingFace on first run (~500MB download)
        - After first download, it's cached locally in ~/.cache/huggingface
        - Sets model to eval() mode for inference-only (no gradient computation)
        - Takes ~5-10 seconds to load from cache on subsequent starts
    """
    global _tokenizer, _model, _model_loaded

    if _model_loaded:
        return

    from transformers import AutoTokenizer, AutoModelForSequenceClassification

    logger.info("⚡ Loading FinBERT AI Model (first time only)...")
    _tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")
    _model = AutoModelForSequenceClassification.from_pretrained("ProsusAI/finbert")
    _model.eval()  # Set to evaluation mode — disables dropout, speeds up inference

    _model_loaded = True
    logger.info("✅ FinBERT loaded and ready for sentiment analysis.")


def analyze_db_news(symbol: str):
    """
    Main analysis function — reads news from DB, runs FinBERT, saves signal.
    (Called by bot_engine.py every 15 minutes per symbol)

    FLOW:
        1. Query all news articles for this symbol from the database
        2. Extract headlines and filter out empty/invalid ones
        3. Tokenize all headlines in one batch (efficient GPU/CPU usage)
        4. Run through FinBERT to get sentiment probabilities
        5. Calculate compound score: avg(positive) - avg(negative)
        6. Generate BUY/SELL signal if score exceeds threshold
        7. Save signal to trade_signals table with executed=False
        8. Update individual article sentiment scores for the news detail page
        9. Clean up tensors from memory

    IMPORTANT:
        Signals are saved with executed=False so the trade_executor module
        picks them up in its next cycle and runs the full 3-layer verification
        (Technical Analysis + this Sentiment + Quantitative Analysis)
    """
    session = SessionLocal()
    try:
        # Step 1: Fetch articles from DB for this symbol
        articles = session.query(NewsArticle).filter(NewsArticle.symbol == symbol).all()

        if not articles:
            logger.debug(f"   ⚠️ No news found in DB for {symbol}")
            return

        # Step 2: Extract valid headlines (skip empty or whitespace-only titles)
        headlines = [a.title for a in articles if a.title and a.title.strip()]

        if not headlines:
            logger.debug(f"   ⚠️ No valid headlines for {symbol}")
            return

        # Step 3: Load model if not loaded yet (lazy loading)
        _load_model()

        # Step 4: Tokenize all headlines in one batch
        # (max_length=512 is FinBERT's limit, truncation handles longer text)
        inputs = _tokenizer(
            headlines,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=512
        )

        # Step 5: Run through FinBERT (no gradient computation needed for inference)
        with torch.no_grad():
            outputs = _model(**inputs)
            predictions = torch.nn.functional.softmax(outputs.logits, dim=-1)

        # Step 6: Calculate compound sentiment score
        # FinBERT output format: [Positive, Negative, Neutral] for each article
        avg_scores = predictions.mean(dim=0)
        positive = avg_scores[0].item()   # Average positive probability
        negative = avg_scores[1].item()   # Average negative probability  
        neutral = avg_scores[2].item()    # Average neutral probability
        compound_score = positive - negative  # Range: -1.0 to +1.0

        # Step 7: Generate trading signal based on compound score
        # (Threshold lowered to 0.03 from 0.05 — the 3-layer verification
        #  system will filter out weak signals anyway, so we want to
        #  generate more candidates for the verification to evaluate)
        decision = "NEUTRAL"
        if compound_score > 0.03:
            decision = "BUY"
        elif compound_score < -0.03:
            decision = "SELL"

        # Confidence = how strongly the model feels (distance from neutral center)
        confidence = abs(compound_score)

        # Step 8: Save signal to database for trade_executor to pick up
        # (Only save BUY/SELL signals — NEUTRAL signals don't trigger trades)
        if decision != "NEUTRAL":
            new_signal = TradeSignal(
                symbol=symbol,
                signal=decision,
                confidence=confidence,
                reasoning=(
                    f"FinBERT analyzed {len(headlines)} articles. "
                    f"Positive: {positive:.3f}, Negative: {negative:.3f}, Neutral: {neutral:.3f}. "
                    f"Compound: {compound_score:+.4f}"
                ),
                executed=False  # Trade executor will pick this up in its next cycle
            )
            session.add(new_signal)
            session.commit()

            emoji = "🟢" if decision == "BUY" else "🔴"
            logger.info(
                f"   🧠 {emoji} AI → {symbol}: {decision} "
                f"(confidence: {confidence:.3f}, score: {compound_score:+.4f})"
            )
        else:
            # Log NEUTRAL result but don't save it — no point cluttering the DB
            logger.info(
                f"   🧠 ⚪ AI → {symbol}: NEUTRAL "
                f"(score: {compound_score:+.4f}, pos={positive:.3f}, neg={negative:.3f})"
            )

        # Step 9: Update individual article sentiment scores in DB
        # (These scores are shown in the news detail page in the frontend)
        for i, article in enumerate(articles):
            if i < len(predictions):
                article_score = predictions[i][0].item() - predictions[i][1].item()
                article.sentiment_score = round(article_score, 4)
        session.commit()

        # Step 10: Clean up memory (FinBERT uses ~2GB RAM, we need to be careful)
        del inputs, outputs, predictions
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    except Exception as e:
        logger.error(f"   ❌ AI Error for {symbol}: {e}", exc_info=True)
        session.rollback()
    finally:
        session.close()


def batch_analyze(symbols: list[str]):
    """
    Analyze multiple symbols in one batch for efficiency.
    (Loads the FinBERT model once and processes all symbols sequentially)

    DETAILS:
        This is an alternative entry point for bulk analysis. The bot_engine
        currently calls analyze_db_news() individually per symbol, but this
        function is available for batch processing if needed.
    """
    _load_model()

    analyzed = 0
    for symbol in symbols:
        try:
            analyze_db_news(symbol)
            analyzed += 1
        except Exception as e:
            logger.error(f"   ❌ Batch analysis failed for {symbol}: {e}")

    logger.info(f"🧠 Batch analysis complete: {analyzed}/{len(symbols)} symbols processed.")
    return analyzed