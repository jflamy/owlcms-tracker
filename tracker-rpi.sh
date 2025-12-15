#!/bin/bash

# OWLCMS Tracker Launcher for Raspberry Pi / Linux ARM
# Run: chmod +x tracker-rpi.sh && ./tracker-rpi.sh

echo ""
echo "========================================"
echo "   OWLCMS Competition Tracker"
echo "========================================"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check for bundled node or system node
if [ -f "$SCRIPT_DIR/node" ]; then
    NODE_EXE="$SCRIPT_DIR/node"
elif command -v node &> /dev/null; then
    NODE_EXE="node"
else
    echo "ERROR: Node.js not found!"
    echo ""
    echo "Install Node.js on Raspberry Pi:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
    echo "  sudo apt-get install -y nodejs"
    echo ""
    echo "Or download portable node binary:"
    echo "  https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-armv7l.tar.gz (Pi 3/4 32-bit)"
    echo "  https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-arm64.tar.gz (Pi 4/5 64-bit)"
    echo ""
    exit 1
fi

# Set port
export PORT=8096

echo "Starting tracker on http://localhost:$PORT"
echo "Also available at http://$(hostname -I | awk '{print $1}'):$PORT"
echo "Press Ctrl+C to stop"
echo ""

"$NODE_EXE" "$SCRIPT_DIR/start-with-ws.js"
