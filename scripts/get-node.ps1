# Laedt eine portable Node.js-Version (22 LTS) in den Ordner "runtime" herunter.
# Es wird nichts installiert und nichts am System veraendert.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = Split-Path -Parent $PSScriptRoot
$rt = Join-Path $root 'runtime'
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }

$index = Invoke-RestMethod 'https://nodejs.org/dist/index.json'
$v = ($index | Where-Object { $_.version -like 'v22.*' } | Select-Object -First 1).version
if (-not $v) { throw 'Keine Node.js-Version gefunden.' }
$name = "node-$v-win-$arch"
$zip = Join-Path $env:TEMP "$name.zip"

Write-Host "   Lade $name herunter ..."
Invoke-WebRequest "https://nodejs.org/dist/$v/$name.zip" -OutFile $zip -UseBasicParsing

# Pruefsumme kontrollieren
$sums = [string](Invoke-RestMethod "https://nodejs.org/dist/$v/SHASUMS256.txt")
$line = ($sums -split "`n") | Where-Object { $_ -match [regex]::Escape("$name.zip") + '\s*$' } | Select-Object -First 1
if (-not $line) { throw 'Pruefsumme nicht gefunden.' }
$expected = ($line.Trim() -split '\s+')[0].ToLower()
$actual = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
if ($actual -ne $expected) { Remove-Item $zip; throw 'Pruefsumme stimmt nicht - Download beschaedigt.' }

Write-Host '   Entpacke ...'
New-Item -ItemType Directory -Force $rt | Out-Null
$target = Join-Path $rt 'node'
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
Expand-Archive $zip -DestinationPath $rt -Force
Rename-Item (Join-Path $rt $name) 'node'
Remove-Item $zip
Write-Host '   Fertig.'
