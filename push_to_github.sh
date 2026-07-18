#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# QuantTrading — GitHub Auto-Push Script
# (Run this to push local changes up to GitHub for your Oracle server)
# ═══════════════════════════════════════════════════════════════

cd ~/QuantTrading

echo "╔══════════════════════════════════════════════╗"
echo "║      🚀 GITHUB AUTO-PUSH UTILITY             ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Error: This folder is not a Git repository."
    echo "Please run 'git init' and link your GitHub repository first."
    exit 1
fi

# Get the commit message from the user (or use a default)
COMMIT_MSG="$1"
if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="Auto-update from local machine $(date '+%Y-%m-%d %H:%M:%S')"
fi

echo "📦 1. Adding all changed files..."
git add .

echo "📝 2. Committing with message: '$COMMIT_MSG'"
git commit -m "$COMMIT_MSG"

echo "☁️  3. Pushing updates to GitHub..."
git push origin main # or 'git push origin master' depending on your default branch

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS! All your updates are now on GitHub."
    echo ""
    echo "👉 Next Step: Log into your Oracle Cloud server, go to the project folder, and type:"
    echo "   git pull"
    echo "   bash start.sh"
else
    echo ""
    echo "❌ FAILED TO PUSH TO GITHUB."
    echo "Make sure your GitHub repository is set up correctly and you have internet access."
fi
