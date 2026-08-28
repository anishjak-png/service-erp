@echo off
title Service ERP Print Bridge
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-bridge.ps1"
pause
