# Share Mochi beyond this computer (Nov 3), for judges and testers on any network.
# Starts a SEPARATE Mochi (his own folder and memory: data\public\mochi-public.sqlite) on 127.0.0.1:8790 with a passcode
# (MOCHI_PUBLIC=1, server\share.js), then a Cloudflare quick tunnel to it. Nothing on this computer listens to the
# network: the tunnel is an outgoing connection. Your demo Mochi (8788) is not reachable from outside.
param([int]$Port = 8790)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$data = Join-Path $root "data"
# the shared Mochi's own folder: its memory, pictures, renderer, demo snapshot, passcode, feedback and logs never mix
# with the demo Mochi's (Nov 3 review: they shared data\ and could clean up each other's renderer)
$pub = Join-Path $data "public"
New-Item -ItemType Directory -Force -Path $pub | Out-Null
$pidFile = Join-Path $data "share-pids.txt"
# stops a process and everything it started (node --watch has a child), quietly, whether or not it's still running
function Stop-Tree($id) { if ($id) { cmd /c "taskkill /PID $id /T /F >nul 2>&1" | Out-Null } }
# leftovers from a sharing window that didn't close cleanly
if (Test-Path $pidFile) { foreach ($old in Get-Content $pidFile) { Stop-Tree $old }; Remove-Item $pidFile -ErrorAction SilentlyContinue }

$cf = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cf) {
  Write-Host ""
  Write-Host "  cloudflared isn't installed yet. Type this, press Enter, then run share-mochi.cmd again:" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "      winget install --id Cloudflare.cloudflared"
  Write-Host ""
  exit 1
}
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
  Write-Host "  Port $Port is already in use (is a shared Mochi already running? run stop-sharing.cmd first)." -ForegroundColor Yellow
  exit 1
}

# the shared Mochi: localhost only, passcode on, his own memory
$env:MOCHI_PORT = "$Port"; $env:MOCHI_HOST = "127.0.0.1"; $env:MOCHI_PUBLIC = "1"
$env:MOCHI_DB = Join-Path $pub "mochi-public.sqlite"
if (-not $env:FEELINGS_DIR) { $env:FEELINGS_DIR = "C:/mochi-feelings/export/feelings" }
$serverLog = Join-Path $pub "server-public.log"
$server = Start-Process -FilePath "node" -ArgumentList "--watch-path=.", "--watch-path=../shared", "--watch-preserve-output", "--disable-warning=ExperimentalWarning", "index.js" `
  -WorkingDirectory (Join-Path $root "server") -RedirectStandardOutput $serverLog -RedirectStandardError "$serverLog.err" -NoNewWindow -PassThru
Set-Content $pidFile "$($server.Id)"
Write-Host "  Starting the shared Mochi on http://127.0.0.1:$Port ..."
$up = $false
for ($i = 0; $i -lt 80 -and -not $up; $i++) {
  try { Invoke-WebRequest "http://127.0.0.1:$Port/api/whoami" -UseBasicParsing -TimeoutSec 2 | Out-Null; $up = $true } catch { Start-Sleep -Milliseconds 500 }
}
if (-not $up) { Write-Host "  The shared Mochi didn't start. See $serverLog and $serverLog.err" -ForegroundColor Red; Stop-Tree $server.Id; Remove-Item $pidFile -ErrorAction SilentlyContinue; exit 1 }
$share = Get-Content (Join-Path $pub "share.json") -Raw | ConvertFrom-Json

# the tunnel: a random https://(something).trycloudflare.com address, new each time it starts
$cfLog = Join-Path $pub "tunnel.log"
Remove-Item $cfLog, "$cfLog.out" -ErrorAction SilentlyContinue
$tunnel = Start-Process -FilePath $cf.Source -ArgumentList "tunnel", "--no-autoupdate", "--url", "http://127.0.0.1:$Port" `
  -RedirectStandardError $cfLog -RedirectStandardOutput "$cfLog.out" -NoNewWindow -PassThru
Add-Content $pidFile "$($tunnel.Id)"
Write-Host "  Opening the tunnel ..."
$url = $null
# (not api.trycloudflare.com: that one is in cloudflared's error line when it can't get a tunnel)
for ($i = 0; $i -lt 90 -and -not $url -and -not $tunnel.HasExited; $i++) {
  Start-Sleep -Milliseconds 700
  if (Test-Path $cfLog) { $m = Select-String -Path $cfLog -Pattern "https://(?!api\.)[a-z0-9-]+\.trycloudflare\.com" | Select-Object -First 1; if ($m) { $url = $m.Matches[0].Value } }
}
if ($url) { Start-Sleep -Seconds 2 }   # a tunnel that dies at once isn't shared
if (-not $url -or $tunnel.HasExited) {
  Write-Host "  The tunnel didn't come up (try your phone's hotspot). See $cfLog" -ForegroundColor Red
  Stop-Tree $tunnel.Id; Stop-Tree $server.Id; Remove-Item $pidFile -ErrorAction SilentlyContinue; exit 1
}
$link = "$url/?code=$($share.passcode)"
Set-Content (Join-Path $pub "share-link.txt") $link
try { Set-Clipboard $link } catch { }
Write-Host ""
Write-Host "  Mochi is shared." -ForegroundColor Green
Write-Host ""
Write-Host "  Link to send (copied):   $link"
Write-Host "  Or open $url and type the passcode:  $($share.passcode)"
Write-Host ""
Write-Host "  - It's one shared Mochi with his own memory; everyone who opens it talks to the same him."
Write-Host "  - Your demo Mochi (port 8788) is not reachable from outside."
Write-Host "  - Feedback people send goes to $pub\feedback.jsonl"
Write-Host "  - Change the passcode in $pub\share.json (then run this again)."
Write-Host ""
Write-Host "  Keep this window open. To stop sharing: close it, or press Ctrl+C (or run stop-sharing.cmd)." -ForegroundColor Yellow
try {
  while (-not $tunnel.HasExited -and -not $server.HasExited) { Start-Sleep -Seconds 2 }
  if ($tunnel.HasExited) { Write-Host "  The tunnel closed (see $cfLog)." -ForegroundColor Yellow }
} finally {
  $ErrorActionPreference = "Continue"   # cleanup must finish even if one of them is already gone
  Stop-Tree $tunnel.Id; Stop-Tree $server.Id
  Remove-Item $pidFile -ErrorAction SilentlyContinue
  Write-Host "  Sharing stopped."
}
