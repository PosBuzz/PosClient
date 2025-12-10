#!/bin/bash

# PosBuzz Pull Script
# This script pulls the latest code from GitHub and prepares for deployment

set -e  # Exit on error

echo "=========================================="
echo "PosBuzz Deployment - Pull Script"
echo "=========================================="

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📁 Current directory: $(pwd)"
echo ""

# Check if git is available
if ! command -v git &> /dev/null; then
    echo "❌ Error: git is not installed"
    exit 1
fi

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo "❌ Error: Not a git repository"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "🌿 Current branch: $CURRENT_BRANCH"

# Fetch latest changes
echo "📥 Fetching latest changes..."
git fetch origin

# Get current commit hash
OLD_COMMIT=$(git rev-parse HEAD)
echo "📌 Current commit: $OLD_COMMIT"

# Pull latest changes
echo "⬇️  Pulling latest changes..."
git pull origin $CURRENT_BRANCH

# Get new commit hash
NEW_COMMIT=$(git rev-parse HEAD)
echo "📌 New commit: $NEW_COMMIT"

# Check if there were any changes
if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
    echo "✅ Already up to date!"
else
    echo "✅ Successfully pulled new changes!"
    echo ""
    echo "📝 Changes:"
    git log --oneline $OLD_COMMIT..$NEW_COMMIT
fi

echo ""
echo "=========================================="
echo "✅ Pull completed successfully!"
echo "=========================================="

exit 0
