# ドローン君の絵を書き出す
#   tools/drone-art.html を #bake=案 で開き、全方向(横16段×高さ5段)をまとめた画像を
#   images/game/Drone/drone_案.png に保存する
#   使い方: powershell -ExecutionPolicy Bypass -File tools\bake-drone.ps1 A B C
param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Ids = @("A"))

$root = Split-Path -Parent $PSScriptRoot
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
if(-not (Test-Path $edge)){ $edge = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe" }
$page = "file:///" + ($root -replace "\\","/") + "/tools/drone-art.html"

foreach($id in $Ids){
    # GPUで描くとGPUのプロセスがときどき落ちるので、ソフトウェアで描く(SwiftShader)
    $dom = & $edge --headless=new --allow-file-access-from-files --use-angle=swiftshader --enable-unsafe-swiftshader --virtual-time-budget=5000 --dump-dom "$page#bake=$id" 2>$null | Out-String
    $m = [regex]::Match($dom, 'data:image/png;base64,([A-Za-z0-9+/=]+)')
    if(-not $m.Success){ Write-Host "失敗: $id"; exit 1 }
    $dir = Join-Path $root "images\game\Drone"
    if(-not (Test-Path $dir)){ New-Item -ItemType Directory -Force $dir | Out-Null }
    $out = Join-Path $dir "drone_$id.png"
    [IO.File]::WriteAllBytes($out, [Convert]::FromBase64String($m.Groups[1].Value))
    Write-Host ("書き出し: {0} ({1} KB)" -f $out, [math]::Round((Get-Item $out).Length/1KB))
}
