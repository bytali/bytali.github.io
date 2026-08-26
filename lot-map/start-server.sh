#!/bin/sh
cd "$(dirname "$0")" || exit 1
echo "Starting Property Lot Map at http://localhost:8080"
echo "Press Ctrl+C to stop the server."
python3 -m http.server 8080
