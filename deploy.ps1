$SourcePath = ".\"
$DestinationPath = "\\raphiverse\raid5\FileBrowser\Static\boudjam6\"

# Test network connection first
if (-not (Test-Path $DestinationPath)) {
    Write-Error "Destination path not accessible: $DestinationPath"
    exit 1
}

try {
    Copy-Item -Path "$SourcePath\game.html" -Destination $DestinationPath -Force -ErrorAction Stop
    Copy-Item -Path "$SourcePath\index.html" -Destination $DestinationPath -Force -ErrorAction Stop
    Copy-Item -Path "$SourcePath\css" -Destination $DestinationPath -Recurse -Force -ErrorAction Stop
    Copy-Item -Path "$SourcePath\js" -Destination $DestinationPath -Recurse -Force -ErrorAction Stop
    Write-Host "Files copied successfully!" -ForegroundColor Green
}
catch {
    Write-Error "Failed to copy files: $_"
}