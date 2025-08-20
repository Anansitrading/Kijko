#!/bin/bash

# Kijko Desktop Shortcut Installer
# This script installs a desktop shortcut for Kijko

KIJKO_DIR="/home/david/Projects/Kijko/kijko-clean"
DESKTOP_DIR="$HOME/Desktop"
APPLICATIONS_DIR="$HOME/.local/share/applications"

echo "🎬 Installing Kijko Desktop Shortcut..."

# Check if we're in the right directory
cd "$KIJKO_DIR" || {
    echo "❌ Error: Could not find Kijko directory at $KIJKO_DIR"
    exit 1
}

# Create applications directory if it doesn't exist
mkdir -p "$APPLICATIONS_DIR"

# Convert SVG icon to PNG (if imagemagick is available)
if command -v convert &> /dev/null; then
    echo "🎨 Converting icon to PNG..."
    convert kijko-icon.svg -resize 128x128 kijko-icon.png
else
    echo "⚠️  ImageMagick not found. Using SVG icon directly."
    # Create a simple PNG icon using base64 if convert is not available
    echo "🎨 Creating fallback PNG icon..."
    cat > kijko-icon.png << 'EOF'
# This would be a base64 encoded PNG, but for simplicity we'll use the SVG
EOF
    cp kijko-icon.svg kijko-icon.png
fi

# Ask user which launcher to use
echo ""
echo "Choose launcher mode:"
echo "1) Development mode (npm/node) - Faster startup, development features"
echo "2) Production mode (Docker) - Production environment, containerized"
echo ""
read -p "Enter your choice (1 or 2): " choice

case $choice in
    1)
        LAUNCHER_SCRIPT="$KIJKO_DIR/launch-kijko.sh"
        LAUNCHER_NAME="Kijko AI (Development)"
        echo "📝 Using development launcher"
        ;;
    2)
        LAUNCHER_SCRIPT="$KIJKO_DIR/launch-kijko-docker.sh"
        LAUNCHER_NAME="Kijko AI (Production)"
        echo "📝 Using Docker launcher"
        ;;
    *)
        echo "❌ Invalid choice. Using development launcher as default."
        LAUNCHER_SCRIPT="$KIJKO_DIR/launch-kijko.sh"
        LAUNCHER_NAME="Kijko AI (Development)"
        ;;
esac

# Create the desktop file
cat > Kijko.desktop << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=$LAUNCHER_NAME
Comment=Launch Kijko AI Video Production Platform
Exec=$LAUNCHER_SCRIPT
Icon=$KIJKO_DIR/kijko-icon.png
Terminal=true
StartupNotify=true
Categories=Development;AudioVideo;Graphics;
Keywords=AI;Video;Production;Gemini;
Path=$KIJKO_DIR
StartupWMClass=Kijko
EOF

# Make the desktop file executable
chmod +x Kijko.desktop

# Copy to applications directory
cp Kijko.desktop "$APPLICATIONS_DIR/"
echo "✅ Installed to applications menu: $APPLICATIONS_DIR/Kijko.desktop"

# Copy to desktop if desktop directory exists
if [ -d "$DESKTOP_DIR" ]; then
    cp Kijko.desktop "$DESKTOP_DIR/"
    chmod +x "$DESKTOP_DIR/Kijko.desktop"
    echo "✅ Installed to desktop: $DESKTOP_DIR/Kijko.desktop"
else
    echo "⚠️  Desktop directory not found. Shortcut installed to applications menu only."
fi

# Update desktop database
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "$APPLICATIONS_DIR"
    echo "✅ Updated desktop database"
fi

echo ""
echo "🎉 Desktop shortcut installation complete!"
echo ""
echo "You can now:"
echo "1. 🖱️  Double-click the Kijko icon on your desktop"
echo "2. 🔍 Search for 'Kijko' in your applications menu"
echo "3. 📁 Find it in the Development/AudioVideo categories"
echo ""
echo "The shortcut will:"
echo "- Start the Kijko application"
echo "- Open it in your default browser"
echo "- Show a terminal window for monitoring"
echo ""
echo "To uninstall, delete:"
echo "- $DESKTOP_DIR/Kijko.desktop"
echo "- $APPLICATIONS_DIR/Kijko.desktop"