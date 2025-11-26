#!/bin/bash
# Test V2 format detection and processing using real OWLCMS V2 database

echo "Testing V2 format detection with real database..."

# Path to real V2 database file
V2_DB_FILE="c:/Users/lamyj/git/owlcms4/owlcms/src/main/java/app/owlcms/monitors/owlcmsDatabase_v2_2025-11-26_15h45.json"

if [ ! -f "$V2_DB_FILE" ]; then
  echo "❌ Error: V2 database file not found at $V2_DB_FILE"
  exit 1
fi

echo "📁 Using database file: $V2_DB_FILE"
echo "📊 Database size: $(wc -c < "$V2_DB_FILE") bytes"
echo ""

# Read the database file content
DB_CONTENT=$(cat "$V2_DB_FILE")

# Wrap in WebSocket message format and send to tracker
# Note: Using jq to properly escape and embed the JSON
echo '{"type":"database","payload":' > /tmp/v2_test_payload.json
cat "$V2_DB_FILE" >> /tmp/v2_test_payload.json
echo '}' >> /tmp/v2_test_payload.json

echo "📤 Sending V2 database to tracker at http://localhost:8096/ws..."

curl -X POST http://localhost:8096/ws \
  -H "Content-Type: application/json" \
  -d @/tmp/v2_test_payload.json

echo ""
echo ""
echo "✅ V2 database sent to tracker"
echo ""
echo "Check tracker console for:"
echo "  [Hub] 📋 Detected format: V2"
echo "  [V2 Parser] Parsing V2 format database"
echo "  [V2 Parser] Processing XX athletes"
echo "  [V2 Parser] Has ageGroups: true count: XX"
echo "  [V2 Parser] ✅ Parsed XX athletes, XX categories, X FOPs"
echo ""
echo "To view parsed data, check:"
echo "  http://localhost:8096/api/scoreboard?type=lifting-order&fop=Platform_A"
