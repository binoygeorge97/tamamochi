@echo off
title Mochi - close this window to stop
cd /d "%~dp0..\server"
rem first free port from 8787 to 8791; the browser opens by itself; --watch restarts Mochi (same memory) whenever
rem his code changes (server and shared folders only: not other folders' node_modules), so updates copied into C:\mochi
rem take effect without closing this window
set "MOCHI_DB=C:\mochi\data\mochi-test.sqlite"
set "FEELINGS_DIR=C:/mochi-feelings/export/feelings"
set "MOCHI_PORT="
for %%p in (8787 8788 8789 8790 8791) do (
  if not defined MOCHI_PORT (
    netstat -ano | findstr /R /C:":%%p .*LISTENING" >nul || set "MOCHI_PORT=%%p"
  )
)
if not defined MOCHI_PORT (echo No free port between 8787 and 8791. Close an old Mochi window and try again. & pause & exit /b 1)
>"..\data\port.txt" echo %MOCHI_PORT%
echo.
echo   Mochi: http://localhost:%MOCHI_PORT%
echo   His room: http://localhost:%MOCHI_PORT%/room
echo   Memory: C:\mochi\data\mochi-test.sqlite (kept between runs)
echo   Log: C:\mochi\data\server-%MOCHI_PORT%.log
echo.
echo   Your browser opens in a few seconds. Close this window to stop Mochi.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:%MOCHI_PORT%'"
node --watch-path=. --watch-path=..\shared --watch-preserve-output --disable-warning=ExperimentalWarning index.js > "..\data\server-%MOCHI_PORT%.log" 2>&1
echo Mochi stopped. See C:\mochi\data\server-%MOCHI_PORT%.log
pause
