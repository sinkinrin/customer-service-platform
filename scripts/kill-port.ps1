$port = 3010
$connections = netstat -ano | Select-String ":$port "
foreach ($conn in $connections) {
    $parts = $conn -split '\s+'
    $pid = $parts[-1]
    if ($pid -match '^\d+$' -and $pid -ne '0') {
        Write-Host "Killing PID: $pid"
        taskkill /PID $pid /F 2>$null
    }
}
Write-Host "Done"
