#!/bin/bash

# Docker Installation Script for Ubuntu/Debian
# Based on official Docker documentation

echo "🐳 Installing Docker and Docker Compose..."
echo "This script will install Docker Engine and Docker Compose plugin"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please do not run this script as root (don't use sudo)"
    echo "The script will ask for sudo when needed"
    exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_CODENAME
else
    echo "❌ Cannot detect OS. This script is for Ubuntu/Debian only."
    exit 1
fi

if [[ "$OS" != "ubuntu" && "$OS" != "debian" ]]; then
    echo "❌ This script is for Ubuntu/Debian only. Detected: $OS"
    exit 1
fi

echo "✅ Detected: $OS $VERSION"
echo ""

# Step 1: Remove old Docker versions
echo "🧹 Removing old Docker versions..."
sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# Step 2: Update package index and install prerequisites
echo "📦 Installing prerequisites..."
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Step 3: Add Docker's official GPG key
echo "🔑 Adding Docker's GPG key..."
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/$OS/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Step 4: Set up the repository
echo "📋 Setting up Docker repository..."
echo \
"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS \
$(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Step 5: Update package index
echo "🔄 Updating package index..."
sudo apt-get update

# Step 6: Install Docker Engine and Docker Compose
echo "🐳 Installing Docker Engine and Docker Compose..."
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Step 7: Start and enable Docker service
echo "🚀 Starting Docker service..."
sudo systemctl start docker
sudo systemctl enable docker

# Step 8: Add user to docker group
echo "👤 Adding user to docker group..."
sudo groupadd docker 2>/dev/null || true
sudo usermod -aG docker $USER

# Step 9: Test Docker installation
echo "🧪 Testing Docker installation..."
if sudo docker run hello-world; then
    echo "✅ Docker installation successful!"
else
    echo "❌ Docker installation failed"
    exit 1
fi

echo ""
echo "🎉 Docker and Docker Compose installed successfully!"
echo ""
echo "⚠️  IMPORTANT: You need to log out and log back in (or restart)"
echo "   for the docker group changes to take effect."
echo ""
echo "After logging back in, you can run Docker without sudo:"
echo "  docker --version"
echo "  docker compose version"
echo ""
echo "Then you can launch Kijko with:"
echo "  ./launch-kijko-docker.sh"
echo "  or use the desktop shortcut"
