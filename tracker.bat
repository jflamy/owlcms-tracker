@echo off
setlocal

REM OWLCMS Tracker Launcher
REM Double-click this file to start the tracker

echo.
echo ========================================
echo   OWLCMS Competition Tracker
echo ========================================
echo.

REM Use bundled Node.js
set NODE_EXE=%~dp0node.exe

if not exist "%NODE_EXE%" (
    echo ERROR: node.exe not found in this folder!
    echo Please download the complete tracker package.
    pause
    exit /b 1
)

REM Set port
set PORT=8096

echo Starting tracker on http://localhost:%PORT%
echo Press Ctrl+C to stop
echo.

"%NODE_EXE%" "%~dp0start-with-ws.js"

pause
