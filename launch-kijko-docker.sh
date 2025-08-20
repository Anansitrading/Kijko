#!/bin/bash

# Kijko Docker Application Launcher
# This script launches Kijko using Docker containers (production mode)

KIJKO_DIR="/home/david/Projects/Kijko/kijko-clean"

echo "🎬 Starting Kijko AI Video Production Platform (Docker Mode)..."

# Check if we're in the right directory
cd "$KIJKO_DIR" || {
    echo "❌ Error: Could not find Kijko directory at $KIJKO_DIR"
    read -p "Press Enter to exit..."
    exit 1
}

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed or not in PATH"
    echo ""
    echo "🔧 To install Docker, run:"
    echo "   ./install-docker.sh"
    echo ""
    echo "Or install manually following: https://docs.docker.com/engine/install/"
    echo ""
    read -p "Would you like to run the Docker installer now? (y/N): " install_choice
    if [[ $install_choice =~ ^[Yy]$ ]]; then
        if [ -f "./install-docker.sh" ]; then
            chmod +x ./install-docker.sh
            ./install-docker.sh
            echo ""
            echo "⚠️  Please log out and log back in, then run this script again"
            exit 0
        else
            echo "❌ install-docker.sh not found in current directory"
            exit 1
        fi
    else
        echo "Please install Docker and try again"
        exit 1
    fi
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running"
    echo ""
    echo "🔧 To start Docker, run:"
    echo "   sudo systemctl start docker"
    echo ""
    echo "Or if you just installed Docker, you may need to:"
    echo "1. Log out and log back in"
    echo "2. Or run: newgrp docker"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if Docker Compose is available
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available"
    echo "Modern Docker installations include Compose as a plugin"
    echo "Please update Docker or install Docker Compose"
    read -p "Press Enter to exit..."
    exit 1
fi

# Function to cleanup containers on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down Kijko containers..."
    docker-compose down
    echo "✅ Cleanup complete"
    exit 0
}

# Trap signals to cleanup properly
trap cleanup SIGINT SIGTERM

# Check if containers are already running
if docker-compose ps | grep -q "Up"; then
    echo "⚠️  Kijko containers are already running"
    echo "🛑 Stopping existing containers..."
    docker-compose down
    sleep 2
fi

# Build and start containers
echo "🔨 Building and starting Kijko containers..."
docker-compose up --build -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check if services are running
if ! docker-compose ps | grep -q "Up"; then
    echo "❌ Failed to start Kijko containers"
    echo "📋 Container status:"
    docker-compose ps
    echo ""
    echo "📋 Container logs:"
    docker-compose logs --tail=20
    read -p "Press Enter to exit..."
    exit 1
fi

echo ""
echo "✅ Kijko is now running in Docker containers!"
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:3001"
echo "🏥 Health Check: http://localhost:3001/api/health"
echo ""
echo "🔑 API Keys configured in backend/.env:"
echo "   ✅ Gemini API"
echo "   ✅ OpenAI API" 
echo "   ✅ Anthropic API"
echo "   ✅ ElevenLabs API"
echo ""
echo "🌐 Opening Kijko in your default browser..."

# Wait a bit more for full startup
sleep 3

# Open the application in the default browser
xdg-open "http://localhost:3000" 2>/dev/null || {
    echo "Could not open browser automatically. Please visit: http://localhost:3000"
}

echo ""
echo "📋 Container status:"
docker-compose ps
echo ""
echo "Press Ctrl+C to stop all containers"
echo "Or run 'docker-compose down' from the project directory"

# Keep script running to maintain containers
echo "🔄 Monitoring containers... (Press Ctrl+C to stop)"
while true; do
    if ! docker-compose ps | grep -q "Up"; then
        echo "⚠️  One or more containers stopped unexpectedly"
        echo "📋 Container status:"
        docker-compose ps
        break
    fi
    sleep 30
done

# Cleanup on exit
cleanup
