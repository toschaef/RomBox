$repoFolderName = "rombox"
$branchName = "windows"

$downloadsPath = Join-Path -Path $HOME -ChildPath "Downloads"
$targetDir = Join-Path -Path $downloadsPath -ChildPath $repoFolderName

if (Test-Path $targetDir) {
    Write-Host "cd '$targetDir'" -ForegroundColor Cyan
    Set-Location $targetDir
} else {
    Write-Error "Could not find '$repoFolderName' in Downloads ($targetDir)."
    exit 1
}

Write-Host "git switch '$branchName'" -ForegroundColor Cyan
git fetch origin
git checkout $branchName

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to switch branch"
    exit 1
}

Write-Host "npm ci" -ForegroundColor Cyan
npm ci

function Stop-NodeProcess ($process) {
    if ($process -and -not $process.HasExited) {
        Write-Host "`nKilling child" -ForegroundColor Yellow
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue -Tree
        $process.WaitForExit()
    }
}

$keepRunning = $true

$scriptBlock = {
    if ($global:nodeProcess) {
        Stop-NodeProcess $global:nodeProcess
    }
}
Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action $scriptBlock | Out-Null

Write-Host "napp running" -ForegroundColor Green

while ($keepRunning) {
    Write-Host "nastarting" -ForegroundColor Cyan
    
    $global:nodeProcess = Start-Process -FilePath "npm" -ArgumentList "start" -PassThru -NoNewWindow

    $input = Read-Host

    if ($input -eq 'q') {
        $keepRunning = $false
    }

    Stop-NodeProcess $global:nodeProcess
}

Write-Host "Script exited gracefully." -ForegroundColor Green