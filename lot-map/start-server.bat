@echo off
cd /d "%~dp0"
echo Starting Property Lot Map at http://localhost:8080
echo Press Ctrl+C to stop the server.
py -3 -m http.server 8080
if errorlevel 1 python -m http.server 8080
pause
