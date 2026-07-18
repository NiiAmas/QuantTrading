#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  QuantTrading Deployment Script
#  Deploy to Oracle Cloud / DigitalOcean / Any Ubuntu VPS
# ═══════════════════════════════════════════════════════════

set -e

echo "═══════════════════════════════════════════════════════"
echo "  🚀 QuantTrading Production Deployment"
echo "═══════════════════════════════════════════════════════"

# ─── Step 1: Install Docker (if not installed) ───
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "✅ Docker installed. You may need to log out and back in."
fi

# ─── Step 2: Install Docker Compose (if not installed) ───
if ! command -v docker compose &> /dev/null; then
    echo "📦 Installing Docker Compose plugin..."
    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin
    echo "✅ Docker Compose installed."
fi

# ─── Step 3: Build the frontend ───
echo ""
echo "🔨 Building frontend..."
if [ -d "frontend/node_modules" ]; then
    cd frontend
    # Set the production API URL (same origin since nginx proxies)
    VITE_API_URL="" npm run build
    cd ..
    echo "✅ Frontend built to frontend/dist/"
else
    echo "⚠️  Frontend node_modules not found. Run 'cd frontend && npm install && npm run build' first."
    echo "   Or install Node.js: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash && sudo apt-get install -y nodejs"
fi

# ─── Step 4: Set up environment ───
if [ ! -f ".env.production" ]; then
    echo "⚠️  .env.production not found. Creating from template..."
    cp .env.production.example .env.production
    echo "⚠️  Please edit .env.production with your actual keys!"
    exit 1
fi

# ─── Step 5: Build and launch ───
echo ""
echo "🐳 Building Docker images (this may take a few minutes on first run)..."
docker compose build

echo ""
echo "🚀 Starting all services..."
docker compose up -d

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  ✅ DEPLOYMENT COMPLETE!"
echo ""
echo "  Frontend:    http://$(hostname -I | awk '{print $1}')"
echo "  API:         http://$(hostname -I | awk '{print $1}'):8000"
echo "  Bot Stats:   http://$(hostname -I | awk '{print $1}'):8000/bot/stats"
echo ""
echo "  Useful commands:"
echo "    docker compose logs -f          # Watch all logs"
echo "    docker compose logs -f backend  # Watch bot engine"
echo "    docker compose restart backend  # Restart bot"
echo "    docker compose down             # Stop everything"
echo "═══════════════════════════════════════════════════════"
