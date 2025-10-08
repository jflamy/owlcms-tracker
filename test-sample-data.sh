#!/bin/bash

# Test script to load sample OWLCMS database data into our tracker

echo "Loading sample database into OWLCMS tracker..."

# Read the sample database file
SAMPLE_FILE="samples/2025-10-07T23-06-04-943Z-DATABASE-SWITCHGROUP.json"

if [ ! -f "$SAMPLE_FILE" ]; then
    echo "Sample file not found: $SAMPLE_FILE"
    exit 1
fi

echo "Reading sample file: $SAMPLE_FILE"

# Extract the JSON content and convert to form data
# This is a simplified approach - in real usage, OWLCMS would send this as form data

curl -X POST http://localhost:8096/database \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d @<(cat "$SAMPLE_FILE" | jq -r 'to_entries[] | "\(.key)=\(.value | @uri)"' | tr '\n' '&')

echo ""
echo "Sample data loaded. Visit http://localhost:8096/scoreboard to see the scoreboard."