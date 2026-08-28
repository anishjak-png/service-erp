@echo off
title Service ERP Print Bridge - Update (Administrator)
cd /d "%~dp0"
echo.
echo  Administrator update: git pull + npm install
echo  Do NOT use for daily startup — bridge auto-starts on login.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0update.ps1"
echo.
pause
