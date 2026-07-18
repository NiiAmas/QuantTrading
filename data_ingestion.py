"""
Data Ingestion Module — Fetches live financial news and saves to database.
(This module is the primary news source for the AI analysis pipeline)

PURPOSE:
    This module fetches the latest financial news for each tracked symbol 
    and stores it in the database for FinBERT sentiment analysis. It is 
    the first step in the pipeline: News → AI → Signal → 3-Layer Verify → Trade.

HOW IT WORKS:
    1. Tries NewsAPI first (best quality, but limited to 100 requests/day on free tier)
    2. If NewsAPI fails or is rate-limited, falls back to free RSS feeds
    3. Clears old articles for the symbol and replaces with fresh ones
    4. Only saves articles from the last 48 hours to prevent stale news from
       triggering bad trades (this was a critical bug — WSJ feed was returning 2025 articles)

RATE LIMIT STRATEGY:
    - NewsAPI free tier: 100 requests/day
    - Bot engine rotates through 5 symbols per 15-minute cycle
    - RSS feeds have no rate limits and are the primary fallback
"""

import requests
import os
import logging
import feedparser
from datetime import datetime, timedelta
from database import SessionLocal
from init_db import NewsArticle
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("data_ingestion")

API_KEY = os.getenv("NEWS_API_KEY")

# ─── RSS FEED SOURCES ─────────────────────────────────────────────────
# (Only feeds that reliably return FRESH, current articles)
# REMOVED: Wall Street Journal (feeds.a.dj.com) — returned stale 2025 articles
# REMOVED: Reuters (reuters.com) — sometimes cross-posts paywalled WSJ content
# REMOVED: Google News & CNBC — sometimes syndicated Wall Street Journal content
RSS_FEEDS = {
    "Crypto": [
        "https://cointelegraph.com/rss",
        "https://www.coindesk.com/arc/outboundfeeds/rss/",
    ],
    "Stock": [
        "https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}&region=US&lang=en-US",
    ],
    "Forex": [
        "https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}&region=US&lang=en-US",
    ],
    "General": [
        "https://finance.yahoo.com/news/rss",
    ],
}


def fetch_and_save_news(symbol: str, query: str):
    """
    Main entry point — fetches news and saves to DB.
    (Called by bot_engine.py every 15 minutes per symbol batch)

    FLOW:
        1. Try NewsAPI (if API key exists and not rate-limited)
        2. If NewsAPI returns 0 articles, fallback to RSS feeds
        3. Filter out any articles older than 48 hours
        4. Save fresh articles to database
    """
    session = SessionLocal()

    try:
        articles_saved = 0

        # Try NewsAPI first (if key exists)
        if API_KEY:
            articles_saved = _fetch_from_newsapi(session, symbol, query)

        # Fallback to RSS if NewsAPI failed or no key
        if articles_saved == 0:
            articles_saved = _fetch_from_rss(session, symbol, query)

        if articles_saved > 0:
            logger.info(f"   📰 Saved {articles_saved} fresh articles for {symbol}")
        else:
            logger.warning(f"   ⚠️ No fresh articles found for {symbol}")

    except Exception as e:
        logger.error(f"   ❌ News ingestion error for {symbol}: {e}")
        session.rollback()
    finally:
        session.close()


def _fetch_from_newsapi(session, symbol: str, query: str) -> int:
    """
    Fetch news from NewsAPI (paid/free tier).
    (Returns number of articles saved to database)

    DETAILS:
        - Requests the 10 most recent English articles matching the query
        - Filters out articles marked as [Removed] by NewsAPI
        - Uses the 'from' parameter to only get articles from last 2 days
        - Returns 0 if rate-limited so the caller falls back to RSS
    """
    try:
        # Only fetch articles from the last 2 days
        from_date = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")

        url = (
            f"https://newsapi.org/v2/everything"
            f"?q={query}&sortBy=publishedAt&apiKey={API_KEY}&language=en"
            f"&pageSize=10&from={from_date}"
        )

        response = requests.get(url, timeout=15)
        data = response.json()

        if data.get("status") == "error":
            error_msg = data.get("message", "Unknown")
            if "rateLimited" in error_msg or "maximum" in error_msg.lower():
                logger.warning(f"   ⚠️ NewsAPI rate limit hit. Falling back to RSS.")
            else:
                logger.warning(f"   ⚠️ NewsAPI error: {error_msg}")
            return 0

        if "articles" not in data or not data["articles"]:
            return 0

        # Clear old news for this symbol to keep DB fresh
        session.query(NewsArticle).filter(NewsArticle.symbol == symbol).delete()

        count = 0
        for article in data["articles"][:10]:
            title = article.get("title", "")
            # Skip removed/empty articles — NewsAPI marks deleted content as [Removed]
            if not title or title == "[Removed]":
                continue

            new_article = NewsArticle(
                symbol=symbol,
                title=title,
                url=article.get("url", ""),
                sentiment_score=0.0  # FinBERT AI will fill this in during analysis phase
            )
            session.add(new_article)
            count += 1

        session.commit()
        return count

    except requests.Timeout:
        logger.warning(f"   ⚠️ NewsAPI timeout for {symbol}")
        return 0
    except Exception as e:
        logger.warning(f"   ⚠️ NewsAPI fetch failed: {e}")
        return 0


def _fetch_from_rss(session, symbol: str, query: str) -> int:
    """
    Fallback: Fetch news from free RSS feeds when NewsAPI is unavailable.
    (Returns number of articles saved to database)

    DETAILS:
        - Picks the right feed category based on the symbol type
        - Tries multiple feeds per category for redundancy
        - Filters out articles with dates older than 48 hours
        - This is the primary news source when running without a NewsAPI key
    """
    try:
        # Determine which RSS feeds to try based on asset type
        query_lower = query.lower()
        feed_urls = []

        if "crypto" in query_lower or symbol.endswith("-USD"):
            feed_urls = RSS_FEEDS["Crypto"]
        elif "forex" in query_lower or "=X" in symbol:
            feed_urls = RSS_FEEDS["Forex"]
        elif any(word in query_lower for word in ["stock", "apple", "microsoft", "nvidia", "tesla", "google", "amazon"]):
            feed_urls = [url.format(symbol=symbol) for url in RSS_FEEDS["Stock"]]
        else:
            feed_urls = RSS_FEEDS["General"]

        all_entries = []
        for feed_url in feed_urls:
            try:
                parsed = feedparser.parse(feed_url)
                if parsed.entries:
                    all_entries.extend(parsed.entries[:10])
            except Exception as e:
                logger.debug(f"   RSS feed {feed_url} failed: {e}")
                continue

        if not all_entries:
            return 0

        # Filter to only fresh articles (published within last 48 hours)
        # STRICT: if we can't parse the date, SKIP it (don't assume fresh)
        cutoff = datetime.now() - timedelta(hours=48)
        fresh_entries = []
        for entry in all_entries:
            # Block WSJ/Dow Jones URLs that other feeds syndicate
            entry_url = entry.get("link", "").lower()
            entry_title = entry.get("title", "").lower()
            entry_summary = entry.get("summary", "").lower()
            
            is_blocked = False
            blocked_keywords = ["wsj.com", "barrons.com", "marketwatch.com", "dowjones.com", "wall street journal", "barron's", "marketwatch"]
            
            for blocked in blocked_keywords:
                if blocked in entry_url or blocked in entry_title or blocked in entry_summary:
                    is_blocked = True
                    break
                    
            if hasattr(entry, 'source') and hasattr(entry.source, 'title'):
                source_title = entry.source.title.lower()
                if "wall street journal" in source_title or "wsj" in source_title or "barron" in source_title or "marketwatch" in source_title:
                    is_blocked = True

            if is_blocked:
                continue  # SKIP — WSJ / Dow Jones source
            
            # Try to parse the publication date
            pub_date = _parse_entry_date(entry)
            if pub_date is not None and pub_date >= cutoff:
                fresh_entries.append(entry)

        if not fresh_entries:
            logger.debug(f"   All RSS entries for {symbol} were older than 48 hours or undated")
            return 0

        # Clear old news for this symbol
        session.query(NewsArticle).filter(NewsArticle.symbol == symbol).delete()

        count = 0
        seen_titles = set()  # Deduplicate across multiple feeds
        for entry in fresh_entries[:10]:
            title = entry.get("title", "")
            if not title or title in seen_titles:
                continue
            seen_titles.add(title)

            new_article = NewsArticle(
                symbol=symbol,
                title=title,
                url=entry.get("link", ""),
                sentiment_score=0.0
            )
            session.add(new_article)
            count += 1

        session.commit()
        return count

    except Exception as e:
        logger.warning(f"   ⚠️ RSS fallback failed for {symbol}: {e}")
        return 0


def _parse_entry_date(entry) -> datetime | None:
    """
    Try to parse the publication date from an RSS feed entry.
    (Returns None if the date cannot be parsed — we'll assume it's fresh)

    DETAILS:
        RSS feeds use many different date formats. This function handles
        the most common ones: struct_time from feedparser, ISO format, 
        and standard RFC 822 format.
    """
    try:
        # feedparser often provides a parsed struct_time
        if hasattr(entry, 'published_parsed') and entry.published_parsed:
            from time import mktime
            return datetime.fromtimestamp(mktime(entry.published_parsed))
        
        # Try parsing the raw published string
        if hasattr(entry, 'published') and entry.published:
            from dateutil import parser as dateparser
            return dateparser.parse(entry.published)
    except Exception:
        pass
    return None