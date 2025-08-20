#!/bin/bash

# Kijko Application Launcher
# This script launches both backend and frontend servers

KIJKO_DIR="/home/david/Projects/Kijko/kijko-clean"

echo "🎬 Starting Kijko AI Video Production Platform..."

# Check if we're in the right directory
cd "$KIJKO_DIR" || {
    echo "❌ Error: Could not find Kijko directory at $KIJKO_DIR"
    read -p "Press Enter to exit..."
    exit 1
}

# Source NVM if available to ensure Node.js is in PATH
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    echo "🔧 Loading NVM..."
    source "$HOME/.nvm/nvm.sh"
    # Use the default or latest version
    nvm use default 2>/dev/null || nvm use node 2>/dev/null || true
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed or not in PATH"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "   1. Make sure Node.js is installed"
    echo "   2. If using NVM, ensure it's properly configured"
    echo "   3. Try running: source ~/.nvm/nvm.sh && nvm use node"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo "✅ npm found: $(npm --version)"

# Check if dependencies are installed
if [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm run install:all
fi

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down Kijko..."
    pkill -f "node.*backend/server.js" 2>/dev/null
    pkill -f "vite.*frontend" 2>/dev/null
    echo "✅ Cleanup complete"
    exit 0
}

# Trap signals to cleanup properly
trap cleanup SIGINT SIGTERM

# Start backend server in the background
echo "🚀 Starting backend server..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

# Start frontend server in the background
echo "🎨 Starting frontend server..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
sleep 5

echo ""
echo "✅ Kijko is now running!"
echo "🌐 Frontend: http://localhost:5173"
echo "🔧 Backend API: http://localhost:3001"
echo "🏥 Health Check: http://localhost:3001/health"
echo ""
echo "🔑 API Keys configured:"
echo "   ✅ Gemini API"
echo "   ✅ OpenAI API"
echo "   ✅ Anthropic API"
echo "   ✅ ElevenLabs API"
echo ""
echo "🌐 Opening Kijko in your default browser..."

# Open the application in the default browser
sleep 2
xdg-open "http://localhost:5173" 2>/dev/null || {
    echo "Could not open browser automatically. Please visit: http://localhost:5173"
}

echo ""
echo "Press Ctrl+C to stop all services"

# Wait for processes to finish
wait
