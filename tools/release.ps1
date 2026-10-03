# 公開版(main)を更新する
#   develop をそのまま main に反映し、公開版のタグを付けて、GitHub の Releases に変更内容を載せる。
#   main の更新は、必ずこのスクリプトで行う(.githooks/pre-push が、タグのない main の push を止める)。
#
#   使い方:
#     powershell -ExecutionPolicy Bypass -File tools\release.ps1 -NotesFile 本文.md
#       本文.md：Releases とタグのメモに載せる変更内容(Markdown)。Claude に頼むときは Claude がまとめて渡す
#     powershell -ExecutionPolicy Bypass -File tools\release.ps1
#       本文を渡さないときは、前の公開版からのコミット一覧を下書きにしてメモ帳で開く。書き直して保存し、閉じると続く
#     -DryRun を付けると、確認と本文の用意だけして、main・タグ・push・Releases には手を付けない
#
#   必要なもの：gh(GitHub CLI。gh auth login でログイン済み)
param(
    [string]$NotesFile = "",
    [switch]$DryRun
)
# PowerShell 5.1 は、git が普通のメッセージを標準エラーに出しただけでも止まってしまうので、止めずに終了コードで判断する
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Fail($msg){ Write-Host "中止: $msg" -ForegroundColor Red; exit 1 }
function GitOut(){
    #結果は標準出力だけ。標準エラー(注意や進み具合)は、失敗したときの説明にだけ使う
    $all = & git.exe @args 2>&1   #関数の名前と区別するため git.exe と書く(PowerShell は大文字と小文字を区別しない)
    if($LASTEXITCODE -ne 0){ Fail ("git " + ($args -join " ") + "`n" + (($all | ForEach-Object { "$_" }) | Out-String)) }
    return ($all | Where-Object { $_ -is [string] })
}

# --- 1. 確認：作業中の変更がなく、develop が GitHub と同じで、main をそのまま develop まで進められること
if(-not (Get-Command gh -ErrorAction SilentlyContinue)){ Fail "gh(GitHub CLI)が見つからない。winget install --id GitHub.cli で入れて、gh auth login でログインする" }
& gh auth status *> $null
if($LASTEXITCODE -ne 0){ Fail "gh にログインしていない。gh auth login でログインする" }
if((GitOut status --porcelain | Out-String).Trim()){ Fail "コミットしていない変更がある" }
GitOut fetch --quiet --tags origin | Out-Null
$dev = (GitOut rev-parse develop | Out-String).Trim()
if($dev -ne (GitOut rev-parse origin/develop | Out-String).Trim()){ Fail "develop が GitHub の develop と違う(先に push する)" }
if((GitOut rev-parse main | Out-String).Trim() -ne (GitOut rev-parse origin/main | Out-String).Trim()){ Fail "手元の main が GitHub の main と違う(手元の main を GitHub に合わせてから)" }
& git merge-base --is-ancestor origin/main develop
if($LASTEXITCODE -ne 0){ Fail "main に develop にないコミットがある(そのまま進められない)" }
if($dev -eq (GitOut rev-parse origin/main | Out-String).Trim()){ Fail "main はすでに develop と同じ(公開するものがない)" }

# --- 2. テスト
Write-Host "テストを回す…"
& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "run-smoke.ps1") | Out-Null
if($LASTEXITCODE -ne 0){ Fail "テストが通らない(tools\run-smoke.ps1)" }

# --- 3. タグの名前：公開した日付。同じ日に2回目なら .2, .3…
$date = Get-Date -Format "yyyy.MM.dd"
$tag = "v$date"
$n = 1
while((& git tag -l $tag)){ $n++; $tag = "v$date.$n" }
$title = "公開版 " + (Get-Date -Format "yyyy-MM-dd") + $(if($n -gt 1){ " ($n)" } else { "" })
$prev = (& git describe --tags --abbrev=0 --match "v*" origin/main 2>$null | Out-String).Trim()

# --- 4. 本文
$draft = Join-Path $env:TEMP "dronekun-release-notes.md"
if($NotesFile){
    if(-not (Test-Path $NotesFile)){ Fail "本文のファイルがない: $NotesFile" }
    $notes = [IO.File]::ReadAllText((Resolve-Path $NotesFile), $utf8)
}else{
    # 下書き：前の公開版からのコミット一覧。;; で始まる行は説明なので、保存すると消える
    $range = if($prev){ "$prev..develop" } else { "develop" }
    $lines = @(";; $title($tag)の変更内容を書いて保存し、メモ帳を閉じてください。",
               ";; 遊ぶ人から見た変化を、見出し(### …)と箇条書きで短く。;; で始まる行は消えます。空のままなら中止します。",
               ";; 前の公開版: $(if($prev){ $prev } else { 'なし' })。以下はそこからのコミット一覧(下書き)。", "")
    $lines += (& git log --reverse --format="- %s" $range)
    [IO.File]::WriteAllText($draft, ($lines -join "`r`n") + "`r`n", $utf8)
    Start-Process notepad.exe $draft -Wait
    $notes = [IO.File]::ReadAllText($draft, $utf8)
}
$notes = (($notes -split "`r?`n") | Where-Object { $_ -notmatch "^;;" }) -join "`n"
$notes = $notes.Trim()
if(-not $notes){ Fail "本文が空" }
$notesPath = Join-Path $env:TEMP "dronekun-release-final.md"
[IO.File]::WriteAllText($notesPath, $notes + "`n", $utf8)
$tagMsgPath = Join-Path $env:TEMP "dronekun-release-tag.txt"
[IO.File]::WriteAllText($tagMsgPath, "$title`n`n$notes`n", $utf8)

Write-Host ""
Write-Host "タグ   : $tag(前の公開版: $(if($prev){ $prev } else { 'なし' }))"
Write-Host "タイトル: $title"
Write-Host "コミット: $dev"
Write-Host "---- 本文 ----"
Write-Host $notes
Write-Host "--------------"
if($DryRun){ Write-Host "(お試しなので、ここで終わり。main・タグ・push・Releases は変えていない)"; exit 0 }

# --- 5. main を develop まで進め、タグを付けて push し、Releases を作る
$back = (GitOut rev-parse --abbrev-ref HEAD | Out-String).Trim()
try{
    GitOut switch --quiet main | Out-Null
    GitOut merge --quiet --ff-only develop | Out-Null
    #見出しの「###」を消されないよう、メモはそのまま残す(Git は # で始まる行を説明書きとして消すため)
    GitOut tag -a $tag --cleanup=verbatim -F $tagMsgPath | Out-Null
    # main とタグを一緒に送る(どちらかだけが GitHub に届かないように)
    GitOut push --atomic origin main "refs/tags/$tag" | Out-Null
}finally{
    & git switch --quiet $back 2>$null
}
& gh release create $tag --title $title --notes-file $notesPath --verify-tag
if($LASTEXITCODE -ne 0){ Fail "Releases を作れなかった(main とタグは push 済み。gh release create $tag --title `"$title`" --notes-file $notesPath でやり直せる)" }
Write-Host ""
Write-Host "公開した: $tag"
