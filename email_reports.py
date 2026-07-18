"""
Daily Email Report Module — Sends end-of-day trade summaries via email.
(Sends a professional report to each user's email at the end of every trading day)

PURPOSE:
    Every day at a configurable time (default: 11:00 PM), this module:
    1. Queries all users and their accounts
    2. Calculates today's trade activity, P&L, and portfolio performance
    3. Generates an HTML email report
    4. Sends it to each user's registered email address

HOW IT WORKS:
    - Uses SMTP (Gmail or any provider) to send emails
    - The bot_engine.py calls check_and_send_daily_report() every cycle
    - It checks if the current time has passed the report hour AND
      if a report hasn't been sent today yet
    - Once sent, it records the date so it doesn't send twice

CONFIGURATION:
    Set these environment variables in your .env file:
    - SMTP_EMAIL: The email address to send FROM (e.g., your Gmail)
    - SMTP_PASSWORD: The app password for that email
    - SMTP_HOST: SMTP server (default: smtp.gmail.com)
    - SMTP_PORT: SMTP port (default: 587)
    - REPORT_HOUR: Hour to send report, 0-23 (default: 23 = 11 PM)

GMAIL APP PASSWORD:
    1. Go to myaccount.google.com → Security → 2-Step Verification (turn ON)
    2. Search for "App passwords" in Google Account settings
    3. Generate a new app password for "Mail"
    4. Use that 16-character password as SMTP_PASSWORD (NOT your Gmail password)
"""

import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, date
from database import SessionLocal
from init_db import User, Account, Trade, PortfolioAsset
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("email_reports")

# ─── SMTP CONFIGURATION ──────────────────────────────────────────────
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
REPORT_HOUR = int(os.getenv("REPORT_HOUR", "23"))  # 11 PM default

# Track when the last report was sent (prevents duplicate sends)
_last_report_date = None


def is_configured() -> bool:
    """
    Check if email reporting is configured.
    (Returns False if SMTP credentials are not set — reports are silently skipped)
    """
    return bool(SMTP_EMAIL and SMTP_PASSWORD)


def check_and_send_daily_report():
    """
    Called every bot cycle — checks if it's time to send the daily report.
    (Only sends once per day, at the configured REPORT_HOUR)

    LOGIC:
        1. If SMTP is not configured, skip silently
        2. If current hour < REPORT_HOUR, skip (not time yet)
        3. If we already sent a report today, skip
        4. Otherwise, generate and send the report for ALL users
    """
    global _last_report_date

    if not is_configured():
        return

    now = datetime.now()

    # Only send after the report hour
    if now.hour < REPORT_HOUR:
        return

    # Don't send twice on the same day
    today = date.today()
    if _last_report_date == today:
        return

    logger.info("📧 Generating daily email reports...")

    try:
        _send_reports_for_all_users()
        _last_report_date = today
        logger.info("✅ Daily reports sent successfully!")
    except Exception as e:
        logger.error(f"❌ Failed to send daily reports: {e}", exc_info=True)


def _send_reports_for_all_users():
    """
    Generate and send a report for every registered user.
    (Each user gets their own personalized report with their accounts)
    """
    session = SessionLocal()
    try:
        users = session.query(User).all()

        for user in users:
            if not user.email or "@" not in user.email:
                continue

            try:
                report_html = _generate_report_html(session, user)
                _send_email(
                    to_email=user.email,
                    subject=f"📊 QuantTrading Daily Report — {date.today().strftime('%B %d, %Y')}",
                    html_body=report_html
                )
                logger.info(f"   📧 Report sent to {user.email}")
            except Exception as e:
                logger.error(f"   ❌ Failed to send report to {user.email}: {e}")

    finally:
        session.close()


def _generate_report_html(session, user: User) -> str:
    """
    Generate the HTML content for one user's daily report.
    (Contains: account summaries, today's trades, P&L, portfolio holdings)

    SECTIONS:
        1. Portfolio Overview — total balance, total P&L, number of open trades
        2. Today's Activity — trades opened and closed today
        3. Open Positions — current holdings with live P&L
        4. Account Breakdown — per-account performance
    """
    accounts = session.query(Account).filter(Account.user_id == user.id).all()

    if not accounts:
        return _generate_no_accounts_html(user)

    # Calculate aggregate stats
    total_balance = sum(a.balance for a in accounts)
    total_initial = sum(a.initial_balance for a in accounts)
    total_return_pct = ((total_balance - total_initial) / total_initial * 100) if total_initial > 0 else 0

    # Today's trades
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    all_trades_today = []
    all_open_trades = []
    total_pnl_today = 0.0

    for account in accounts:
        trades_today = (
            session.query(Trade)
            .filter(Trade.account_id == account.id)
            .filter(Trade.created_at >= today_start)
            .all()
        )
        all_trades_today.extend([(t, account.name) for t in trades_today])

        open_trades = (
            session.query(Trade)
            .filter(Trade.account_id == account.id, Trade.status == "Open")
            .all()
        )
        all_open_trades.extend([(t, account.name) for t in open_trades])

        closed_today = (
            session.query(Trade)
            .filter(Trade.account_id == account.id, Trade.status == "Closed")
            .filter(Trade.closed_at >= today_start)
            .all()
        )
        total_pnl_today += sum(t.pnl_dollars for t in closed_today)

    # Build the HTML email
    pnl_color = "#10B981" if total_pnl_today >= 0 else "#EF4444"
    return_color = "#10B981" if total_return_pct >= 0 else "#EF4444"

    # ─── TRADES TABLE ROWS ───
    trades_rows = ""
    if all_trades_today:
        for trade, acc_name in all_trades_today:
            pnl_str = f"{'+'if trade.pnl >= 0 else ''}{trade.pnl:.2f}%"
            pnl_td_color = "#10B981" if trade.pnl >= 0 else "#EF4444"
            trades_rows += f"""
            <tr style="border-bottom: 1px solid #333;">
                <td style="padding: 10px; color: #ccc;">{trade.symbol}</td>
                <td style="padding: 10px; color: {'#10B981' if trade.trade_type == 'Long' else '#EF4444'};">{trade.trade_type}</td>
                <td style="padding: 10px; color: #ccc;">${trade.entry_price:,.2f}</td>
                <td style="padding: 10px; color: #ccc;">${trade.current_price:,.2f}</td>
                <td style="padding: 10px; color: {pnl_td_color}; font-weight: bold;">{pnl_str}</td>
                <td style="padding: 10px; color: #999;">{trade.status}</td>
                <td style="padding: 10px; color: #999;">{acc_name}</td>
            </tr>"""
    else:
        trades_rows = """
        <tr><td colspan="7" style="padding: 20px; color: #666; text-align: center;">
            No trades today. The bot is monitoring markets and waiting for strong signals.
        </td></tr>"""

    # ─── OPEN POSITIONS ROWS ───
    positions_rows = ""
    if all_open_trades:
        for trade, acc_name in all_open_trades:
            pnl_str = f"{'+'if trade.pnl >= 0 else ''}{trade.pnl:.2f}%"
            pnl_dollar = f"{'+'if trade.pnl_dollars >= 0 else ''}${trade.pnl_dollars:,.2f}"
            pnl_td_color = "#10B981" if trade.pnl >= 0 else "#EF4444"
            positions_rows += f"""
            <tr style="border-bottom: 1px solid #333;">
                <td style="padding: 10px; color: #ccc;">{trade.symbol}</td>
                <td style="padding: 10px; color: {'#10B981' if trade.trade_type == 'Long' else '#EF4444'};">{trade.trade_type}</td>
                <td style="padding: 10px; color: #ccc;">${trade.entry_price:,.2f}</td>
                <td style="padding: 10px; color: #ccc;">${trade.current_price:,.2f}</td>
                <td style="padding: 10px; color: {pnl_td_color}; font-weight: bold;">{pnl_str}</td>
                <td style="padding: 10px; color: {pnl_td_color}; font-weight: bold;">{pnl_dollar}</td>
                <td style="padding: 10px; color: #999;">{acc_name}</td>
            </tr>"""
    else:
        positions_rows = """
        <tr><td colspan="7" style="padding: 20px; color: #666; text-align: center;">
            No open positions currently.
        </td></tr>"""

    # ─── ACCOUNT BREAKDOWN ROWS ───
    account_rows = ""
    for acc in accounts:
        acc_return = ((acc.balance - acc.initial_balance) / acc.initial_balance * 100) if acc.initial_balance > 0 else 0
        acc_color = "#10B981" if acc_return >= 0 else "#EF4444"
        open_count = session.query(Trade).filter(Trade.account_id == acc.id, Trade.status == "Open").count()
        account_rows += f"""
        <tr style="border-bottom: 1px solid #333;">
            <td style="padding: 10px; color: #ccc; font-weight: bold;">{acc.name}</td>
            <td style="padding: 10px; color: #ccc;">{acc.strategy}</td>
            <td style="padding: 10px; color: #ccc;">${acc.balance:,.2f}</td>
            <td style="padding: 10px; color: {acc_color}; font-weight: bold;">{'+'if acc_return >= 0 else ''}{acc_return:.2f}%</td>
            <td style="padding: 10px; color: #ccc;">{open_count}</td>
        </tr>"""

    html = f"""
    <html>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 700px; margin: 0 auto; padding: 30px;">
            
            <!-- HEADER -->
            <div style="text-align: center; padding: 30px; background: linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%); border-radius: 16px; border: 1px solid #d4af37; margin-bottom: 24px;">
                <h1 style="color: #d4af37; margin: 0; font-size: 28px;">📊 QuantTrading</h1>
                <p style="color: #888; margin: 8px 0 0 0; font-size: 14px;">Daily Performance Report — {date.today().strftime('%B %d, %Y')}</p>
            </div>

            <!-- OVERVIEW CARDS -->
            <div style="display: flex; gap: 16px; margin-bottom: 24px;">
                <div style="flex: 1; background: #141420; border-radius: 12px; padding: 20px; border: 1px solid #222;">
                    <div style="color: #888; font-size: 12px; text-transform: uppercase;">Total Balance</div>
                    <div style="color: #fff; font-size: 24px; font-weight: bold; margin-top: 4px;">${total_balance:,.2f}</div>
                </div>
                <div style="flex: 1; background: #141420; border-radius: 12px; padding: 20px; border: 1px solid #222;">
                    <div style="color: #888; font-size: 12px; text-transform: uppercase;">Today's P&L</div>
                    <div style="color: {pnl_color}; font-size: 24px; font-weight: bold; margin-top: 4px;">{'+'if total_pnl_today >= 0 else ''}${total_pnl_today:,.2f}</div>
                </div>
                <div style="flex: 1; background: #141420; border-radius: 12px; padding: 20px; border: 1px solid #222;">
                    <div style="color: #888; font-size: 12px; text-transform: uppercase;">Overall Return</div>
                    <div style="color: {return_color}; font-size: 24px; font-weight: bold; margin-top: 4px;">{'+'if total_return_pct >= 0 else ''}{total_return_pct:.2f}%</div>
                </div>
            </div>

            <!-- TODAY'S TRADES -->
            <div style="background: #141420; border-radius: 12px; padding: 20px; border: 1px solid #222; margin-bottom: 24px;">
                <h2 style="color: #d4af37; margin: 0 0 16px 0; font-size: 18px;">⚡ Today's Trades ({len(all_trades_today)})</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="border-bottom: 2px solid #333;">
                        <th style="padding: 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase;">Symbol</th>
                        <th style="padding: 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase;">Type</th>
                        <th style="padding: 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase;">Entry</th>
                        <th style="padding: 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase;">Current</th>
                        <th style="padding: 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase;">P&L</th>
                        <th style="padding: 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase;">Status</th>
                        <th style="padding: 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase;">Account</th>
                    </tr>
                    {trades_rows}
                </table>
            </div>

            <!-- OPEN POSITIONS -->
            <div style="background: #141420; border-radius: 12px; padding: 20px; border: 1px solid #222; margin-bottom: 24px;">
                <h2 style="color: #d4af37; margin: 0 0 16px 0; font-size: 18px;">📈 Open Positions ({len(all_open_trades)})</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="border-bottom: 2px solid #333;">
                        <th style="padding: 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase;">Symbol</th>
                        <th style="padding: 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase;">Type</th>
                        <th style="padding: 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase;">Entry</th>
                        <th style="padding: 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase;">Current</th>
                        <th style="padding: 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase;">P&L %</th>
                        <th style="padding: 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase;">P&L $</th>
                        <th style="padding: 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase;">Account</th>
                    </tr>
                    {positions_rows}
                </table>
            </div>

            <!-- ACCOUNT BREAKDOWN -->
            <div style="background: #141420; border-radius: 12px; padding: 20px; border: 1px solid #222; margin-bottom: 24px;">
                <h2 style="color: #d4af37; margin: 0 0 16px 0; font-size: 18px;">🏦 Account Breakdown</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="border-bottom: 2px solid #333;">
                        <th style="padding: 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase;">Account</th>
                        <th style="padding: 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase;">Strategy</th>
                        <th style="padding: 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase;">Balance</th>
                        <th style="padding: 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase;">Return</th>
                        <th style="padding: 10px; text-align: left; color: #666; font-size: 11px; text-transform: uppercase;">Open</th>
                    </tr>
                    {account_rows}
                </table>
            </div>

            <!-- FOOTER -->
            <div style="text-align: center; padding: 20px; color: #444; font-size: 12px;">
                <p>This report was automatically generated by QuantTrading Bot v2.0</p>
                <p>3-Layer Verification: Technical Analysis + FinBERT Sentiment + Quantitative Analysis</p>
                <p style="color: #333; margin-top: 8px;">⚠️ This is a simulated trading system. No real money is at risk.</p>
            </div>
        </div>
    </body>
    </html>
    """
    return html


def _generate_no_accounts_html(user: User) -> str:
    """Generate a simple report for users who haven't created accounts yet."""
    return f"""
    <html>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 30px;">
            <div style="text-align: center; padding: 30px; background: linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%); border-radius: 16px; border: 1px solid #d4af37;">
                <h1 style="color: #d4af37; margin: 0; font-size: 28px;">📊 QuantTrading</h1>
                <p style="color: #888; margin: 16px 0 0 0;">No trading accounts found for {user.email}.</p>
                <p style="color: #666; margin: 8px 0 0 0;">Log in and create an account to start receiving daily trade reports!</p>
            </div>
        </div>
    </body>
    </html>
    """


def _send_email(to_email: str, subject: str, html_body: str):
    """
    Send an HTML email via SMTP.
    (Uses TLS encryption for security)

    DETAILS:
        - Connects to SMTP server (default: smtp.gmail.com:587)
        - Uses STARTTLS for encrypted connection
        - Sends HTML email with professional formatting
        - Raises exception on failure (caught by caller)
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"QuantTrading Bot <{SMTP_EMAIL}>"
    msg["To"] = to_email

    # Attach the HTML body
    msg.attach(MIMEText(html_body, "html"))

    # Connect and send
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
