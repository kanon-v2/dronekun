# ドローン君の動作確認(スモークテスト)
#   使い方:  powershell -ExecutionPolicy Bypass -File tools\run-smoke.ps1
# ヘッドレスのEdge(なければChrome)で tools/smoke-test.html を開き、結果を表示する。
# すべてOKなら終了コード0、NGがあれば1。
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$page = "file:///" + ((Join-Path $root "tools\smoke-test.html") -replace '\\','/')

$browser = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if(-not $browser){ Write-Error "Edge も Chrome も見つかりません"; exit 2 }

# テスト専用のプロフィール(普段のブラウザのデータには触れない)
$profile = Join-Path $env:TEMP "dronekun-smoke-profile"
$outFile = Join-Path $env:TEMP "dronekun-smoke-out.html"
if(Test-Path $outFile){ Remove-Item $outFile -Force }

$sw = [Diagnostics.Stopwatch]::StartNew()
$p = Start-Process -FilePath $browser -PassThru -RedirectStandardOutput $outFile -RedirectStandardError (Join-Path $env:TEMP "dronekun-smoke-err.txt") -ArgumentList @(
    "--headless=new", "--disable-gpu", "--allow-file-access-from-files",
    "--user-data-dir=$profile", "--virtual-time-budget=600000", "--dump-dom", $page)
if(-not $p.WaitForExit(300000)){
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    Write-Output "タイムアウト(5分)で中断しました"; exit 2
}
Start-Sleep -Milliseconds 500

$html = $null
for($i = 0; $i -lt 20 -and $html -eq $null; $i++){
    try{ $html = [System.IO.File]::ReadAllText($outFile, (New-Object System.Text.UTF8Encoding($false))) }catch{ Start-Sleep -Milliseconds 500 }
}
$m = [regex]::Match($html, '<pre id="result">([\s\S]*?)</pre>')
$result = [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value)
Write-Output $result
Write-Output ("({0}秒)" -f [int]$sw.Elapsed.TotalSeconds)
if($result -match "RESULT: OK"){ exit 0 } else { exit 1 }
