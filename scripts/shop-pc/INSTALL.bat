@echo off
title Service ERP Print Bridge - Install
cd /d "%~dp0"
echo.
echo  This will install the print bridge and start it on every login.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause
