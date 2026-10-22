# ドローン君の動作確認(スモークテスト)
#   使い方:  powershell -ExecutionPolicy Bypass -File tools\run-smoke.ps1 [-Coop]
# ヘッドレスのEdge(なければChrome)で tools/smoke-test.html(1人用)を開き、結果を表示する。
# 協力プレイの確認(tools/coop-test.html)は時間がかかり、たまに落ちる項目があるので、-Coop を付けたときだけ流す(協力プレイを変えたら流す。CLAUDE.md)。
# すべてOKなら終了コード0、NGがあれば1。
param([switch]$Coop)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

$browser = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if(-not $browser){ Write-Error "Edge も Chrome も見つかりません"; exit 2 }

# テスト専用のプロフィール(普段のブラウザのデータには触れない)
# ほかの作業場所(git worktree)のテストと同時に流してもぶつからないよう、作業場所ごと・実行ごとに名前を分ける
$tag = (Split-Path -Leaf $root) -replace '[^A-Za-z0-9_-]', '_'
$profile = Join-Path $env:TEMP "dronekun-smoke-profile-$tag"
$outFile = Join-Path $env:TEMP "dronekun-smoke-out-$tag-$PID.html"

# テストのページを1つ開いて、<pre id="result"> の中身を返す
function Run-Page($name){
    $page = "file:///" + ((Join-Path $root "tools\$name") -replace '\\','/')
    if(Test-Path $outFile){ Remove-Item $outFile -Force }
    $p = Start-Process -FilePath $browser -PassThru -RedirectStandardOutput $outFile -RedirectStandardError (Join-Path $env:TEMP "dronekun-smoke-err-$tag-$PID.txt") -ArgumentList @(
        "--headless=new", "--disable-gpu", "--allow-file-access-from-files",
        "--user-data-dir=$profile", "--virtual-time-budget=600000", "--dump-dom", $page)
    if(-not $p.WaitForExit(300000)){
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        return "タイムアウト(5分)で中断しました"
    }
    Start-Sleep -Milliseconds 500
    $html = $null
    for($i = 0; $i -lt 20 -and $html -eq $null; $i++){
        try{ $html = [System.IO.File]::ReadAllText($outFile, (New-Object System.Text.UTF8Encoding($false))) }catch{ Start-Sleep -Milliseconds 500 }
    }
    $m = [regex]::Match($html, '<pre id="result">([\s\S]*?)</pre>')
    return [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value)
}

$sw = [Diagnostics.Stopwatch]::StartNew()
$allOk = $true
$pages = @("smoke-test.html")
if($Coop){ $pages += "coop-test.html" }
foreach($name in $pages){
    Write-Output "== $name"
    $result = Run-Page $name
    Write-Output $result
    if($result -notmatch "RESULT: OK"){ $allOk = $false }
}
Remove-Item $outFile, (Join-Path $env:TEMP "dronekun-smoke-err-$tag-$PID.txt") -Force -ErrorAction SilentlyContinue
Write-Output ("({0}秒)" -f [int]$sw.Elapsed.TotalSeconds)
if($allOk){ exit 0 } else { exit 1 }
