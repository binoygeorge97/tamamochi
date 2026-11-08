@echo off
title Mochi: shared (keep this window open)
rem Shares a separate Mochi (his own memory, a passcode) through a Cloudflare tunnel, for judges and testers on any
rem network. Your demo Mochi stays private. Close this window to stop sharing. No administrator rights needed.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0share-mochi.ps1" %*
pause
