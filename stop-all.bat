@echo off
title Accounting System - Stopping Stack...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-all.ps1"
pause
