#!/bin/bash

# Kijko Smart Launcher
# Automatically chooses the best available launch method

KIJKO_DIR="/home/david/Projects/Kijko/kijko-clean"

echo "🎬 Starting Kijko AI Video Production Platform..."

# Check if we're in the right directory
cd "$KIJKO_DIR" || {
    echo "❌ Error: Could not find Kijko directory at $KIJKO_DIR"
    read -p "Press Enter to exit..."
    exit 1
}

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down Kijko..."
    # Stop development servers
    pkill -f "node.*backend/server.js" 2>/dev/null
    pkill -f "vite.*frontend" 2>/dev/null
    # Stop Docker containers if running
    if command -v docker &> /dev/null && docker compose ps &> /dev/null; then
        docker compose down 2>/dev/null
    fi
    echo "✅ Cleanup complete"
    exit 0
}

# Trap signals to cleanup properly
trap cleanup SIGINT SIGTERM

# Check what's available and choose the best option
echo "🔍 Detecting available launch methods..."

# Source NVM if available to ensure Node.js is in PATH
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    echo "🔧 Loading NVM..."
    source "$HOME/.nvm/nvm.sh"
    # Use the default or latest version
    nvm use default 2>/dev/null || nvm use node 2>/dev/null || true
fi

# Check for Docker
if command -v docker &> /dev/null && docker info &> /dev/null 2>&1; then
    if docker compose version &> /dev/null 2>&1; then
        echo "✅ Docker and Docker Compose detected - using production mode"
        echo ""
        exec ./launch-kijko-docker.sh
    else
        echo "⚠️  Docker found but Compose not available"
    fi
else
    echo "⚠️  Docker not available or not running"
fi

# Check for Node.js with expanded PATH search
NODE_PATHS="/usr/bin:/usr/local/bin:/opt/nodejs/bin:$HOME/.nvm/versions/node/*/bin:$HOME/.local/bin:/snap/bin"
export PATH="$PATH:$NODE_PATHS"

# Try to find node in common locations
NODE_CMD=""
NPM_CMD=""

for path in $(echo $PATH | tr ':' ' '); do
    if [ -x "$path/node" ]; then
        NODE_CMD="$path/node"
        break
    fi
done

for path in $(echo $PATH | tr ':' ' '); do
    if [ -x "$path/npm" ]; then
        NPM_CMD="$path/npm"
        break
    fi
done

if [ -n "$NODE_CMD" ] && [ -n "$NPM_CMD" ]; then
    echo "✅ Node.js and npm detected - using development mode"
    echo "   Node.js: $NODE_CMD"
    echo "   npm: $NPM_CMD"
    echo ""

    # Check if dependencies are installed
    if [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
        echo "📦 Installing dependencies first..."
        $NPM_CMD run install:all || {
            echo "❌ Failed to install dependencies"
            read -p "Press Enter to exit..."
            exit 1
        }
    fi

    exec ./launch-kijko.sh
else
    echo "❌ Node.js not available in PATH"
    echo "   Searched in: $NODE_PATHS"
fi

# If we get here, nothing is available
echo ""
echo "❌ Neither Docker nor Node.js is available!"
echo ""
echo "Please install one of the following:"
echo ""
echo "🐳 For Production (Docker):"
echo "   ./install-docker.sh"
echo ""
echo "📦 For Development (Node.js):"
echo "   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
echo "   sudo apt-get install -y nodejs"
echo ""
read -p "Press Enter to exit..."
exit 1
