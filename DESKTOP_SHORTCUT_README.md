# 🎬 Kijko Desktop Shortcut

This directory contains everything needed to create a desktop shortcut for launching Kijko AI Video Production Platform.

## 🚀 Quick Setup

Run the installer script:

```bash
./install-desktop-shortcut.sh
```

The installer will:
1. Ask you to choose between Development or Production mode
2. Create a desktop shortcut with the Kijko icon
3. Install it to your applications menu
4. Make it available on your desktop

## 📁 Files Created

- **`Kijko.desktop`** - Desktop shortcut file
- **`kijko-icon.svg`** - Vector icon for the application
- **`kijko-icon.png`** - PNG icon (generated from SVG)
- **`launch-kijko.sh`** - Development launcher (npm/node)
- **`launch-kijko-docker.sh`** - Production launcher (Docker)
- **`install-desktop-shortcut.sh`** - Installer script

## 🎯 Launcher Modes

### Development Mode (`launch-kijko.sh`)
- Uses npm/node directly
- Faster startup time
- Development features enabled
- Hot reload for code changes
- Runs on ports 3001 (backend) and 5173 (frontend)

### Production Mode (`launch-kijko-docker.sh`)
- Uses Docker containers
- Production environment
- Containerized and isolated
- Runs on ports 3001 (backend) and 3000 (frontend)
- Requires Docker and Docker Compose

## 🖱️ How to Use

After installation, you can launch Kijko by:

1. **Desktop Icon**: Double-click the Kijko icon on your desktop
2. **Applications Menu**: Search for "Kijko" in your applications
3. **Categories**: Find it under Development → AudioVideo → Graphics

## 🔧 What Happens When You Launch

1. Terminal window opens showing startup progress
2. Backend and frontend services start
3. Browser automatically opens to the Kijko interface
4. Application is ready to use

## 🛑 Stopping the Application

- Press `Ctrl+C` in the terminal window
- Or close the terminal window
- Services will automatically shut down

## 🗑️ Uninstalling

To remove the desktop shortcut:

```bash
rm ~/Desktop/Kijko.desktop
rm ~/.local/share/applications/Kijko.desktop
```

## 🔍 Troubleshooting

### Desktop shortcut doesn't appear
- Make sure you have a `~/Desktop` directory
- Check if the file was created in `~/.local/share/applications/`
- Try logging out and back in

### Application won't start
- Check that all dependencies are installed
- For Development mode: Ensure Node.js and npm are installed
- For Production mode: Ensure Docker and Docker Compose are installed
- Check the terminal output for error messages

### Browser doesn't open automatically
- The application will still be running
- Manually visit:
  - Development: http://localhost:5173
  - Production: http://localhost:3000

## 🎨 Customizing the Icon

The icon is generated from `kijko-icon.svg`. To customize:

1. Edit the SVG file
2. Run the installer again to regenerate the PNG
3. Or manually convert: `convert kijko-icon.svg -resize 128x128 kijko-icon.png`

## 📋 Requirements

### For Development Mode:
- Node.js (v18+)
- npm
- Git

### For Production Mode:
- Docker
- Docker Compose

### For Icon Generation:
- ImageMagick (optional, for SVG to PNG conversion)
