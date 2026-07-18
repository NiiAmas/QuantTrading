#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# QuantTrading — Quick Start Script
# (Run this to stop old servers and start fresh with latest code)
# ═══════════════════════════════════════════════════════════════

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     🚀 QUANTTRADING — RESTART SCRIPT        ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Step 1: Kill any old processes on our ports
echo "🔄 Stopping old servers..."
lsof -ti :8000 | xargs kill -9 2>/dev/null
lsof -ti :5173 | xargs kill -9 2>/dev/null
pkill -f "main.py" 2>/dev/null
pkill -f "bot_engine.py" 2>/dev/null
pkill -f "vite" 2>/dev/null
sleep 2

# Step 2: Database is already fixed (do not wipe anymore)
echo "🛠️  Skipping database schema wipe..."
cd ~/QuantTrading

# Step 3: Start API server in background
echo "🌐 Starting API server on port 8000..."
./venv/bin/python main.py &
API_PID=$!
sleep 3

# Step 4: Start bot engine in background
echo "🤖 Starting bot engine..."
./venv/bin/python bot_engine.py &
BOT_PID=$!
sleep 2

# Step 5: Start frontend
echo "💻 Starting frontend on port 5173..."
cd frontend
npm run dev &
FRONT_PID=$!
sleep 3

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ ALL SYSTEMS RUNNING!                     ║"
echo "║                                              ║"
echo "║  🌐 Frontend: http://localhost:5173          ║"
echo "║  📡 API:      http://localhost:8000          ║"
echo "║  🤖 Bot:      Running in background         ║"
echo "║                                              ║"
echo "║  Press Ctrl+C to stop everything             ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Wait for any process to exit
wait
