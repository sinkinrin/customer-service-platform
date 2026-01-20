# restart.ps1 - One-click rebuild and restart script
# Usage: powershell -ExecutionPolicy Bypass -File restart.ps1

Write-Host "=== Customer Service Platform Restart Script ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill processes on port 3010
Write-Host "[1/3] Checking port 3010..." -ForegroundColor Yellow
$connections = netstat -ano | Select-String ":3010 "
$killedPids = @()

foreach ($conn in $connections) {
    $parts = $conn -split '\s+'
    $processId = $parts[-1]
    if ($processId -match '^\d+$' -and $processId -ne '0' -and $killedPids -notcontains $processId) {
        Write-Host "      Killing PID: $processId" -ForegroundColor Gray
        taskkill /PID $processId /F 2>$null | Out-Null
        $killedPids += $processId
    }
}

if ($killedPids.Count -eq 0) {
    Write-Host "      No processes found on port 3010" -ForegroundColor Green
} else {
    Write-Host "      Killed $($killedPids.Count) process(es)" -ForegroundColor Green
}

# Wait a moment for port to be released
Start-Sleep -Seconds 1

# Step 2: Build the project
Write-Host ""
Write-Host "[2/3] Building project..." -ForegroundColor Yellow
$buildResult = npm run build 2>&1
$buildExitCode = $LASTEXITCODE

if ($buildExitCode -ne 0) {
    Write-Host "      Build FAILED!" -ForegroundColor Red
    Write-Host $buildResult
    exit 1
}
Write-Host "      Build successful" -ForegroundColor Green

# Step 3: Start the server
Write-Host ""
Write-Host "[3/3] Starting server on port 3010..." -ForegroundColor Yellow
# Use cmd.exe to run npm (npm is a batch script, not an exe)
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run start" -NoNewWindow

# Wait and verify server is running
Start-Sleep -Seconds 5
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3010/api/health" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "      Server started successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "=== Server is running at http://localhost:3010 ===" -ForegroundColor Cyan
    }
} catch {
    Write-Host "      Server may still be starting. Check http://localhost:3010" -ForegroundColor Yellow
}
