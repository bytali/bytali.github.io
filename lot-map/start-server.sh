#!/bin/sh
cd "$(dirname "$0")" || exit 1
echo "Starting local server at http://localhost:8080"
python3 -m http.server 8080
