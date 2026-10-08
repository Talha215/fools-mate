# Downloads this project's own Node.js into .node\ (checksum-verified), so it
# never touches the machine-wide Node 16 the other apps are pinned to.
#   powershell -ExecutionPolicy Bypass -File scripts\get-node.ps1
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$version = 'v24.21.0'
$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root '.node'
if (Test-Path (Join-Path $dest 'node.exe')) { & (Join-Path $dest 'node.exe') --version; exit 0 }

$name = "node-$version-win-x64"
$tmp = Join-Path ([IO.Path]::GetTempPath()) "fools-mate-node"
New-Item -ItemType Directory -Force $tmp | Out-Null
$zip = Join-Path $tmp "$name.zip"
Invoke-WebRequest -UseBasicParsing "https://nodejs.org/dist/$version/$name.zip" -OutFile $zip
$sums = (Invoke-WebRequest -UseBasicParsing "https://nodejs.org/dist/$version/SHASUMS256.txt").Content
$expected = (($sums -split "`n" | Where-Object { $_ -match "$name.zip" }) -split '\s+')[0]
$actual = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
if ($expected -ne $actual) { throw "Checksum mismatch for $name.zip" }
Expand-Archive $zip -DestinationPath $tmp -Force
Move-Item (Join-Path $tmp $name) $dest
Remove-Item $zip
& (Join-Path $dest 'node.exe') --version
