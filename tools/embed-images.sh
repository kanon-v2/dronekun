#!/bin/sh
# ゲームで使う小さな png を data: URL にして scripts/drone/embedImages.js に埋める(Git Bash で実行)
#   使い方:  sh tools/embed-images.sh
# file:// で開いても WebGL(glFx.js)へキャンバスを渡せるようにするため(png ファイルを描くとキャンバスが汚染される)
cd "$(dirname "$0")/.." || exit 1
{
printf '%s\n' '//------------------------------------------------------------------------------' \
'//  埋め込んだ画像(data: URL)' \
'//------------------------------------------------------------------------------' \
'//  file:// で開くと、png ファイルの画像を描いたキャンバスは「汚染」扱いになり、WebGL(glFx.js)へ渡せない。' \
'//  data: URL の画像なら汚染されないので、ゲームで使う小さな画像はここに埋めて読む(imgSrc)。' \
'//  元の png を描き直したら、ここも作り直す(tools/embed-images.sh)。' \
'var EMBED_IMAGES = {'
for f in images/game/pointer3.png images/game/Drone/Drone_*.png; do printf '    "%s":"data:image/png;base64,%s",\n' "$f" "$(base64 -w0 "$f")"; done
printf '%s\n' '};' \
'//埋め込んだものがあればそれを、なければファイルのパスをそのまま返す' \
'function imgSrc(_path){ return EMBED_IMAGES[_path] || _path; }'
} > scripts/drone/embedImages.js
