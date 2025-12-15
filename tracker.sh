#!/bin/bash

# OWLCMS Tracker Launcher for macOS
# Double-click this file or run from Terminal

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
    echo "Please either:"
    echo "1. Download node binary and place in this folder"
    echo "   https://nodejs.org/dist/v22.12.0/node-v22.12.0-darwin-arm64.tar.gz (Apple Silicon)"
    echo "   https://nodejs.org/dist/v22.12.0/node-v22.12.0-darwin-x64.tar.gz (Intel Mac)"
    echo ""
    echo "2. Or install Node.js: https://nodejs.org/"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

# Set port
export PORT=8096

echo "Starting tracker on http://localhost:$PORT"
echo "Press Ctrl+C to stop"
echo ""

"$NODE_EXE" "$SCRIPT_DIR/start-with-ws.js"
