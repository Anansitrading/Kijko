#!/bin/bash

# Kijko MVP Development Startup Script

echo "🎬 Starting Kijko MVP Development Environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ to continue."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm to continue."
    exit 1
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p backend/uploads
mkdir -p backend/data
mkdir -p backend/logs

# Install dependencies if node_modules don't exist
if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    echo "⚠️  Creating backend/.env file from template..."
    cp backend/.env.example backend/.env
    echo "🔑 Please update backend/.env with your Gemini API key before continuing."
    echo "   You can get your API key from: https://makersuite.google.com/app/apikey"
    echo ""
    read -p "Press Enter after updating your .env file, or Ctrl+C to exit..."
fi

# Check if Gemini API key is set
if grep -q "your_gemini_api_key_here" backend/.env; then
    echo "⚠️  Warning: Default Gemini API key detected in backend/.env"
    echo "   The system will run in placeholder mode for image/video generation."
    echo "   Update GEMINI_API_KEY in backend/.env for full functionality."
    echo ""
fi

# Start backend server in the background
echo "🚀 Starting backend server on port 3001..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend server in the background  
echo "🎨 Starting frontend server on port 3000..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Function to cleanup processes on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down Kijko MVP..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Cleanup complete"
    exit 0
}

# Trap signals to cleanup properly
trap cleanup SIGINT SIGTERM

echo ""
echo "✅ Kijko MVP is starting up!"
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:3001"
echo "💡 Health Check: http://localhost:3001/health"
echo ""
echo "📝 Features Available:"
echo "   • Live Agent Chat (Gemini Pro)"
echo "   • Video Requirements Document Generation"
echo "   • Storyboard Creation (Placeholder Images)"
echo "   • Timeline View with Sticky Notes"
echo "   • 5-Iteration Feedback Loop"
echo "   • Project Management"
echo ""
echo "🔧 To enable full functionality:"
echo "   1. Add your Gemini API key to backend/.env"
echo "   2. For production image/video generation, integrate with Google AI Studio"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for processes to finish
wait