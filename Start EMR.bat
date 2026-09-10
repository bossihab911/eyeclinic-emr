@echo off
title Ophthalmology EMR
cd /d "%~dp0backend"
echo Starting Ophthalmology EMR...
echo.

where python >nul 2>nul
if %errorlevel%==0 (
  python app.py
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    py app.py
  ) else (
    echo Python not found. Please install Python 3.8+ from https://www.python.org
    pause
  )
)
pause
