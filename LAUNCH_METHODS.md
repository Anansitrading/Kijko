# 🚀 Kijko Launch Methods

You now have multiple ways to launch your Kijko AI Video Production Platform!

## 🖱️ Desktop Shortcut (Recommended)

**✅ INSTALLED** - You can now launch Kijko by:

1. **Double-clicking the desktop icon** - Look for "Kijko AI (Production)" on your desktop
2. **Applications menu** - Search for "Kijko" in your applications
3. **Categories** - Find it under Development → AudioVideo → Graphics

The desktop shortcut will:
- Start Docker containers automatically
- Open your browser to the Kijko interface
- Show a terminal for monitoring

## 🖥️ Command Line Options

### Quick Launcher Script
```bash
./kijko prod        # Start production mode (Docker)
./kijko dev         # Start development mode (npm)
./kijko stop        # Stop all services
./kijko status      # Check what's running
./kijko help        # Show help
```

### Direct Scripts
```bash
./launch-kijko-docker.sh    # Production mode (Docker)
./launch-kijko.sh           # Development mode (npm)
```

### Docker Compose (Manual)
```bash
docker-compose up --build   # Start containers
docker-compose down         # Stop containers
```

## 🎯 Which Method to Use?

### 🖱️ **Desktop Shortcut** - Best for daily use
- One-click launch
- Automatic browser opening
- Easy to find and use
- Production-ready Docker environment

### 🖥️ **Command Line** - Best for development
- More control over startup
- Better for debugging
- Can choose dev vs prod mode
- Terminal output visible

### 🐳 **Docker Compose** - Best for deployment
- Full container control
- Production environment
- Easy scaling and management
- CI/CD integration

## 🌐 Access URLs

After launching, Kijko will be available at:

### Production Mode (Docker):
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/api/health

### Development Mode (npm):
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/api/health

## 🛑 Stopping Kijko

### From Desktop Shortcut:
- Press `Ctrl+C` in the terminal window that opens

### From Command Line:
```bash
./kijko stop                # Stop all services
docker-compose down         # Stop Docker containers only
```

### Manual Process Killing:
```bash
# Stop development servers
pkill -f "node.*backend/server.js"
pkill -f "vite.*frontend"

# Stop Docker containers
docker-compose down
```

## 🔧 Troubleshooting

### Desktop shortcut doesn't work:
1. Check file permissions: `ls -la ~/Desktop/Kijko.desktop`
2. Make executable: `chmod +x ~/Desktop/Kijko.desktop`
3. Check Docker is running: `docker --version`

### Browser doesn't open automatically:
- Manually visit the appropriate URL above
- Check if services started successfully in the terminal

### Port conflicts:
- Stop other services using ports 3000/3001
- Or modify ports in `docker-compose.yml`

## 📁 Files Created

- `Kijko.desktop` - Desktop shortcut file
- `kijko-icon.svg` - Application icon (vector)
- `kijko-icon.png` - Application icon (raster)
- `launch-kijko.sh` - Development launcher
- `launch-kijko-docker.sh` - Production launcher
- `kijko` - Quick command-line launcher
- `install-desktop-shortcut.sh` - Shortcut installer

## 🎉 You're All Set!

Your Kijko AI Video Production Platform is now ready to launch with a simple desktop click or command. The production Docker environment ensures consistent, reliable performance with all your AI integrations working properly.

**Recommended**: Use the desktop shortcut for daily use - it's the easiest and most reliable method!
