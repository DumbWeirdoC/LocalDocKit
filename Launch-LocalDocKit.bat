@echo off
title LocalDocKit - Offline PDF & Image Suite
cls
echo ======================================================================
echo    Starting LocalDocKit...
echo ======================================================================
cd /d "%~dp0"

if exist "dist\LocalDocKit.exe" (
    echo [Launching compiled standalone executable...]
    start "" "dist\LocalDocKit.exe"
    exit /b
)

if exist "LocalDocKit.exe" (
    echo [Launching standalone executable...]
    start "" "LocalDocKit.exe"
    exit /b
)

if not exist ".venv" (
    echo [1/3] Setting up Python virtual environment...
    python -m venv .venv
)

echo [2/3] Verifying dependencies...
.\.venv\Scripts\python.exe -m pip install -r requirements.txt --quiet

echo [3/3] Launching web server and opening browser...
start "" .\.venv\Scripts\python.exe app.py
