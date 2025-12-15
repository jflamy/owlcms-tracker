#!/bin/bash
set -e

echo "🔧 Docker Registry Authentication Test"
echo "======================================"
echo ""

# Get registry from user
read -p "Enter Docker Registry URL (e.g., docker.io or your.registry.com): " REGISTRY
if [ -z "$REGISTRY" ]; then
  echo "❌ Registry cannot be empty"
  exit 1
fi

# Get username from user
read -p "Enter Docker Username: " DOCKER_USER
if [ -z "$DOCKER_USER" ]; then
  echo "❌ Username cannot be empty"
  exit 1
fi

# Get token from user (hidden input)
read -sp "Paste Docker Token/Password (hidden): " DOCKER_TOKEN
echo ""
if [ -z "$DOCKER_TOKEN" ]; then
  echo "❌ Token cannot be empty"
  exit 1
fi

echo ""
echo "Testing authentication..."
echo "Registry: $REGISTRY"
echo "Username: $DOCKER_USER"
echo ""

# Test the login
if echo "$DOCKER_TOKEN" | docker login -u "$DOCKER_USER" --password-stdin "$REGISTRY" 2>/dev/null; then
  echo ""
  echo "✅ Authentication successful!"
  echo ""
  echo "Update GitHub secrets with:"
  echo "  Repository Variable: DOCKER_REG = $REGISTRY"
  echo "  Repository Secret: ORG_DOCKER_USER = $DOCKER_USER"
  echo "  Repository Secret: OWLCMS_DOCKER_TOKEN = [your token]"
  echo ""
  
  # Cleanup: logout
  docker logout "$REGISTRY" >/dev/null 2>&1 || true
else
  echo ""
  echo "❌ Authentication failed!"
  echo "Please check your:"
  echo "  - Registry URL"
  echo "  - Username"
  echo "  - Token/Password"
  exit 1
fi
