# ドローン君 — 開発メモ(Claude Code向け)

ブラウザで動く2Dシューティング。ビルドなし・ライブラリなしの素のHTML/JavaScriptで、
`index.html` をブラウザで直接開くだけで動く(サーバー不要)。公開先は GitHub Pages(`main` ブランチ直下)。

ユーザーとのやりとりは日本語。コード中のコメントも日本語で書く。

## 動作確認

変更したら必ず実行する(数秒):

```powershell
powershell -ExecutionPolicy Bypass -File tools\run-smoke.ps1
```

- ヘッドレスのEdgeで次の2つを開き、すべて `RESULT: OK` なら成功(終了コード0)。
  - `tools/smoke-test.html`: ストーリーの流れ・各WAVEの戦闘・衝撃波とジャスト衝撃波(突進を弾き返すジャスト・カウンターも)・かすりコンボとかすりバースト・全シナジー・強化画面(ショップも)・デバッグのメニュー(ボス戦・武器試用・ストーリー確認)・ドローン君の絵と振り向き・タイトルの設定(見た目の切り替え)・雑魚敵の見た目
  - `tools/coop-test.html`: 協力プレイ。ゲーム2つ(`tools/coop-frame.html`)を iframe で開き、偽のPeerJS(`tools/fake-peer.js`)の通信を親ページが中継する。部屋作り・コード違い・参加・出撃・WAVEクリアの同期・ゲストの攻撃の反映(追加の装備の燃やす・凍らせる・渦の吸い寄せ・バリアで防いだ弾も)・ゲストのジャスト衝撃波でホストがゆっくりになる・ゲストのジャスト・カウンターでホストが突進を弾き返す・退出と、対戦(参加・開始・決着・勝敗の一致・もう一度・退出)を確かめる(インターネット不要)
- 新しい機能を足したら、`tools/smoke-test.html`(協力プレイに関わるものは `tools/coop-test.html`)にも確認項目を足す。
- 見た目の確認はヘッドレスEdgeのスクリーンショットで行う:
  `msedge --headless=new --disable-gpu --allow-file-access-from-files --virtual-time-budget=3000 --window-size=960,540 --screenshot=<出力.png> <file:///...html>`
  特定の画面を撮りたいときは、`<base href="../">` を入れたテスト用HTMLで状態を作ってから撮る(`tools/smoke-test.html` の書き方を参照)。
- バランス調整は、よけて動く自動プレイ(`smoke-test.html` の `bot()`)を何回か回して、到達WAVEで比べる。1回だけの結果は運の差が大きい。
- 難易度の測定は `tools/difficulty.html`。WAVEごとに「動かない」と「よけて動く」で戦い、被弾の回数とクリアまでの秒数を表にする(`#runs=6&waves=1-9&gear=std` で回数・WAVE・装備を選ぶ。ヘッドレスEdgeの `--dump-dom` で結果を読む)。

ヘッドレスブラウザの注意:
- `--virtual-time-budget` を大きくしすぎない。毎フレーム描画すると実時間がとても長くなる(描画は数フレームに1回で十分)。
- iframeの中では `requestAnimationFrame` が動かない。iframeで動かすテストは `setInterval` で1コマずつ進める。
- PowerShell 5.1 は BOM なし UTF-8 の .ps1 内の日本語を読み違える。.ps1 は BOM 付き UTF-8 で保存する。

## ファイル構成と読み込み順

`index.html` が次の順に読み込む。**順番に意味がある**(後のファイルが前のファイルの定数・関数を使う)ので、ファイルを足すときは位置に注意する。

| ファイル | 役割 |
|---|---|
| `common.js` | キャンバス・ページ管理(`page`)・マウス/タッチ入力・矩形ボタン(`drawRect`)・能力(`STATS`)・進行状況(`game`)・セーブ(`save`)・ドローン君(`drone`)と見た目(`DroneLook`) |
| `sound.js` | BGM・効果音。Web Audio API で合成(音声ファイルなし)。曲データは `TRACKS` |
| `equipment.js` | 装備(`WEAPONS`)・シナジー(`SYNERGIES`)・戦闘中の装備の動作(`arms`)・シナジー演出(`fx`) |
| `armsExtra.js` | 追加の装備(火炎放射・円盤・重力弾・バリア・狙撃・冷凍)とそのシナジー。`WEAPONS`・`SYNERGIES`・`arms` に足す(`arms` から `fire2`・`update2`・`draw2` などを呼ぶ)。敵の状態「燃える」「凍る」もここ |
| `bosses.js` | レア敵・ボス(女王蜂・移動要塞・ドローン君改)。`special` |
| `startScreen.js` | タイトル画面 |
| `mainScreen.js` | 戦闘画面。敵の種類(`ENEMY_TYPES`)・敵の弾・アイテム・HUD |
| `forces.js` | 同胞(色違いのドローン君)と人間の兵器。`ENEMY_TYPES` に種類を追加している |
| `enemyArt.js` | 雑魚敵(`mainScreen.js` の6種類と人間の兵器3種類)の見た目(`enemyArt`)。`mainScreen.drawEnemy` から呼ぶ。ボス(女王蜂・移動要塞・ドローン君改)の絵もここ(`enemyArt.queen`・`fortress`・`kai`。`bosses.js` の `special.draw` から呼ぶ) |
| `upgradeScreen.js` | 強化画面(報酬カード・能力強化・装備・ショップ・能力リセット) |
| `gameoverScreen.js` | ゲームオーバー画面 |
| `story.js` | ストーリー(`STORIES`)・ストーリー画面・エンディング・ストーリー確認モード |
| `battleBg.js` | 戦闘画面(対戦も)の背景。奥にWAVEで移り変わる空と街(昼→夕方→夜→WAVE16からは戦場。`story.js` の `drawSky` を別のキャンバスに粗く描いて薄く敷き、ドローン君と逆へ少しずらす)、手前に戦いに反応する方眼(目の大きさと出すかどうかはタイトルの「設定」で選ぶ：`viewOpt.grid`・`viewOpt.gridSize`、細かい7.5px／普通15px／大きい30px は `BG_CELL_SIZES`。光る範囲は普通の方眼のマス数で決め、細かいでは2倍のマス数にする。はじめの設定は「あり・大きい」。空と街の絵は、方眼の設定にかかわらずいつも出す。大きい・なしは方眼と演出が公開版と同じ(`battleBg.classic()`。大きいは `drawClassic` で絵の上にごく薄い30pxの方眼、なしは線なし)で、光るマス・波は出さず、ジャストのゆっくりの演出も公開版のまま(`mainScreen.js` の `JUST_FX` の `classic`。方眼ありは弱めた `bg`)。衝撃波・ジャスト衝撃波・ボスの着地で波打つ `ripple`、かすったマスが光る `graze`(黄色)、ドローン君の下のマスがいつも灰色に光り、かすりコンボ中は黄色く派手になる `drawAura`、ジャスト衝撃波でドローン君のまわりが水色のひし形に光り、外へひし形の輪になって伝わる `justSpread`)。WAVEの番号と自分の画面の出来事だけで決まるので通信は要らない |
| `bossDebug.js` | デバッグのメニュー：ボス戦だけを遊ぶ・武器試用・ストーリー確認(`#debug` で開いたときだけ) |
| `timeStop.js` | ショップのバフ「時止めワープ」(被弾の瞬間に自動で時が止まり、選んだ場所へ粒子になって移る。クールタイム `BUFF_WARP_CD` 秒・WAVEの始めは使える・協力プレイ／対戦では働かない)。デバッグのメニューで「オン」にすると、クールタイムなしで試せる |
| `lib/peerjs.min.js` | PeerJS 1.5.5(外部ライブラリ。MITライセンス、`lib/PEERJS-LICENSE`)。協力プレイの通信に使う。手を加えない |
| `coop.js` | ふたりで協力プレイ(下記「協力プレイ」参照)。対戦も同じ部屋・通信を使う |
| `versus.js` | ふたりで対戦(下記「対戦」参照)。page 7 |
| `draw.js` | 1/60秒刻みの更新ループと描画。最後に読み込む |

画像は `images/game/` 以下(ポインタと、ドローン君の見た目「クラシック」用の元の6方向のドット絵 `Drone/Drone_*.png`)。それ以外の見た目はすべてキャンバスに図形で描いている(下の「ドローン君の絵」参照)。
`images/icon-180.png`・`icon-192.png`・`icon-512.png` はホーム画面のアイコン(`tools/make-icon.html` で描いてヘッドレスEdgeで撮る。作り方はファイルの先頭)。
iPhone の Safari は全画面(Fullscreen API)が使えないので、全画面ボタンの代わりに「ホーム画面に追加」の案内(`#homeHint`)を出す。ホーム画面から開くと(`manifest.webmanifest`・`apple-mobile-web-app-capable`)ブラウザの枠なしになり、`index.html` の先頭で `html` に `app` を付けて、ゲーム画面だけを黒地に最大化する。ホーム画面から開いたときのセーブは、Safari で開いたときと別になる。
`images/ogp.png`(1200×630)は、リンクを貼ったときのプレビュー画像(`index.html` の OGP タグ)。WAVE5の女王蜂戦をヘッドレスEdgeで撮ったもの。ページの紹介文やプレビューには、ストーリーのネタバレ(同胞・人間の兵器・真実)を出さない。

## 仕組み

- キャンバスは 960×540 固定(32×18 マスで `GS = 30px`)。CSSで縮めても座標はこの大きさのまま。
- 画面の細かさ(`common.js` の `fitCanvas`)：大きなモニター・全画面でぼやけないよう、キャンバスの実際の大きさを「表示される大きさ×画素の密度」に合わせ(最大 `RENDER_MAX` = 4倍)、`ctx.setTransform` で全体を拡大して描く。座標はいつも 960×540 のままなので、ふだんのコードは気にしなくてよい。ただし `canvas.width`/`canvas.height` はゲームの大きさではない(`CW`/`CH` を使う)。キャンバス自身を写し取るときは、元の位置に `renderScale` を掛ける。フレームレートが `RENDER_FPS_LOW` を下回る秒が `RENDER_DROP_SEC` 続くと、細かさを1段下げる(`draw.js` の `fps`。画面上部の表示に「×倍率」が出る)。
- 画面(page)の番号: 0 タイトル / 1 戦闘 / 2 強化 / 3 ゲームオーバー / 4 ストーリー / 5 エンディング / 6 協力プレイ・対戦の部屋選び / 7 対戦。
  各画面は `{ enter(), update(), draw() }` を持つオブジェクトで、`draw.js` の `screens` 配列に並ぶ。切り替えは `page.change(n)`。
- 更新は `draw.js` で1/60秒ごと(画面のリフレッシュレートに依存しない)。`update()` が1コマ、`draw()` が描画。
- クリックは `Click == 1` が1コマだけ立つ。ボタンは `drawRect` の `clicked()` / `button()` を使う。
- タッチ操作(`common.js`)：戦闘中・対戦の戦闘中・タイトル画面は、どこをドラッグしても指の動いた分だけドローン君の目標が動く(`isTouchDrag()`)。タイトル画面では、ボタンの上を触ったときだけタップとして押し(`startScreen.touchUI()`)、押し終わったら目標を元に戻す(`tapAt()`・`endTap()`。目標がボタンへ飛ばないように)。それ以外の画面はタップ。
- セーブは `localStorage`。この周の進み具合は `dronekun_save`(強化画面に入ったときに自動セーブ。倒れる・クリアすると消える)、周をまたいで残るもの(パーツ・能力・見たストーリー)は `dronekun_meta`(`save.writeMeta`・`loadMeta`。タイトルに入るたびに読み直す)、ハイスコア `dronekun_best`・クリア済み `dronekun_cleared`。前の作り(能力はレベル5まで)のセーブは、はじめて読むときに `dronekun_meta` へ移す(能力は `OLD_LEVEL_MAP` で近い強さのレベルに)。
- 周回(ローグライト)：タイトルの「出撃」で難易度(`DIFFICULTIES`。イージー・ノーマル・ハード・ベリーハード、いつでも4つとも選べる)を選び、WAVE1から始める(`startScreen.startRun` → `game.newRun`)。倒れてもパーツと能力は残り、装備・ショップのバフ・WAVEは毎回はじめから。2周目からは、出撃の前に強化画面でパーツを使って能力を上げられる。難易度は敵の体力・弾・WAVEの敵の数・出てくる間隔・撃ち返し・落とすパーツに掛かる(`difficulty()`。協力プレイはホストが選んだ難易度 `coop.diff`、対戦はいつもノーマル)。`game.reset()` は残るものまで全部消す(テスト用)。
- 画面右下のボタン(`sound.js` の `sound.buttons`)：BGM・SEはいつでも、「かすり範囲」「当たり判定」「ポインタ」の表示/非表示は戦闘中だけ出す(`when`。かすり範囲・当たり判定は対戦では出さない)。表示の設定は `common.js` の `viewOpt`(`localStorage` の `dronekun_view`。戦闘画面の方眼の設定もここに覚える)。ポインタを隠すのは戦闘中だけ(メニューでは操作に要るので出す)。
- 全20WAVE(`FINAL_WAVE`)。5WAVEごとにボス。WAVE15(`REVEAL_WAVE`)のボス後に真実が明かされ、WAVE16からは人間の兵器が敵になる。何周もして能力(最大レベル `MAX_LEVEL` = 20)を上げて先へ進む前提なので、WAVEごとの敵の伸びは大きめ(`DANMAKU_*`・`ENEMY_HP_GROW`)、落とすパーツは少なめ(`PARTS_DROP_MUL`)。

## 書き方の決まり

既存のコードに合わせる:
- `var`・関数式・オブジェクトリテラルで書く(モジュールやクラス構文は使っていない)。
- インデント4スペース・ダブルクォート。
- 調整用の数値はファイル先頭の `UPPER_CASE` 定数にまとめ、日本語コメントで意味と単位を書く。
- コメントは「何のためにそうしているか」を日本語で短く。

してはいけないこと・注意:
- **`getImageData` を使わない**。ローカルの file:// で開くとキャンバスが汚染扱いになり動かない。色違いの絵は `tintedImage()`(合成モード `source-atop` で色を重ねる)で作る。
- **グローバル変数 `parent` がある**(`common.js` で `Bigbox` 要素を入れている)。`window.parent` を上書きしているので、iframe から親ページへ送るテストコードでは `top.postMessage` を使う。
- `index.html` を直接開いて動くこと(外部サーバーやビルドに依存しない)を保つ。外部から読み込んでよいのは Google Fonts だけ。ライブラリが必要なときは `lib/` に置く(PeerJS がその例)。
- 例外は協力プレイ・対戦の通信で、最初のつなぎ合わせに PeerJS の公開サーバー(0.peerjs.com)を使う。1人用はインターネットなしで動くこと。
- 敵が「自分のドローン君」を狙う処理は `drone` ではなく `aimAt`(または `nearestPlayer()`)を使う。被弾の判定だけは `drone`(自分)を使う。協力プレイで相方も狙われるため。

## 主な調整値の場所

| 内容 | 場所 |
|---|---|
| 能力の値・強化コスト・ショップのバフ | `common.js` の `MAX_LEVEL`・`STATS`(`statValues(レベル1の値, レベル20の値)` で作る。伸び方は `STAT_CURVE`)・`UPGRADE_COST_*`・`BUFFS`・`BUFF_*`(時止めワープのクールタイムは `BUFF_WARP_CD`、演出の時間は `timeStop.js` の `WARP_*`) |
| 難易度・パーツの数 | `common.js` の `DIFFICULTIES`(敵の数は `count`・`extra`)、`mainScreen.js` の `PARTS_DROP_MUL`・`PARTS_REWARD`・`DANMAKU_*`・`ENEMY_HP_GROW`・`WAVE_ENEMY_*`(`waveEnemies()`) |
| 装備の強さ・攻撃間隔・ショップの値段 | `equipment.js` の `WEAPONS`・`SLOT_COST`・`SHOP_*`、水鉄砲は `WATER_*`。追加の装備は `armsExtra.js` の `WEAPONS` と `FIRE_*`・`BURN_*`・`DISC_*`・`WELL_*`・`BARRIER_*`・`SNIPE_*`・`FREEZE_*`・`ICE_*` |
| シナジーの組み合わせ・色 | `equipment.js` の `SYNERGIES`・`SYN_COLOR`(追加の装備のものは `armsExtra.js`) |
| 敵の種類・弾幕の増え方 | `mainScreen.js` の `ENEMY_TYPES`・`pickEnemyType()`・`danmaku()`・`HIT_CORE`・`GRAZE_RANGE`、敵が出てくる間隔は `SPAWN_*`、虫がときどき狙って撃つのは `BUG_SHOT_*`、虫・突進が倒れるときの撃ち返しは `REVENGE_*` |
| 雑魚敵の見た目・色 | `enemyArt.js` の `enemyArt`・`ENEMY_COLOR`、ボスの動きは `QUEEN_*`・`FORT_*`・`KAI_*` |
| 衝撃波・ジャスト衝撃波・ジャスト・カウンター | `mainScreen.js` の `BLAST_*`・`JUST_*`・`COUNTER_*`(ジャストの段階 PERFECT／JUST は `JUST_PERFECT`・`JUST_RAM_PERFECT`・`JUST_GOOD`)、衝撃波に使う「やる気」(動く・かする・ジャスト・敵が落とす「やる気」でたまる)は `YARUKI_*`・`MOVE_MIN`、対戦でのダメージは `versus.js` の `VS_DAMAGE_MUL.blast` |
| 突進の予備動作(パリィの試作) | `mainScreen.js` の `TELL_*`・`pickDashStyle()`(構え方の出やすさ)・`JUST_SHOTS`(弾でもジャストにするか)。動きは `updateDasher`、絵は `enemyArt.dasher` |
| かすりコンボ・かすりバースト(強スキル) | `mainScreen.js` の `GRAZE_*`・`COMBO_*`・`SKILL_*` |
| レア敵・ボス | `bosses.js` の `RARE_*`・`BOSS_EVERY`・`makeBoss()`・`KAI_PATTERNS`、女王蜂の突進の予備動作(構えのばらつき・合図・フェイント・連続突進・弾いたときのダメージ)は `QUEEN_*` |
| 同胞・人間の兵器 | `forces.js` の `kinRate()`・`pickHuman()` |
| ストーリーの文章・背景・流れる時期 | `story.js` の `STORIES`・`STORY_SKY`・`STORY_AFTER` |
| BGM | `sound.js` の `TRACKS` |
| 戦闘画面の背景(空の薄さ・奥行き・方眼の波) | `battleBg.js` の `BG_*`・`RIPPLE_*`・`GLOW_*`・`CELL_STYLES`・`CELL_STYLE`(光るマスの描き方の候補と、ふだん使うもの。見比べは `tools/bg-glow.html`、ゲームでは `#bgstyle=C` で試せる)・`AURA_*`・`BG_COMBO_COLOR`・`JUST_DIAMOND_R`・`JUST_SPREAD_*`、空の色は `story.js` の `SKY_COLORS` |
| 対戦の耐久・装備ごとのダメージ倍率 | `versus.js` の `VS_HP`・`VS_DAMAGE_MUL` |
| ドローン君の色・振り向き・傾き | `common.js` の `FLAT_COLOR`・`FLAT_YAWS`・`FLAT_ELEVS`・`TURN_*`・`TILT_*` |
| 画面の細かさの上限・重いときに下げる条件 | `common.js` の `RENDER_MAX`・`RENDER_FPS_LOW`・`RENDER_DROP_SEC` |

難易度は「プレイヤーを弱くする方向」と「敵の弾幕を増やす方向」で上げてきた経緯がある。敵の体力を上げる調整は控えめにする。

## ドローン君の絵

- 向きごとの絵を1枚に並べた「シート」を使う。横に水平の向き(0が正面、増えると左を向く)、縦に高さ(見上げる → 見下ろす。まんなかの段がふだんの高さ)。段の数はシートごとに持つ(`yaws`・`elevs`。標準は24×7段、画像の見た目は16×5段。書き出した画像は大きさから決まる)。シートは等倍・2倍・4倍の3枚(`droneSheets`)で、描く大きさに近いものを使う。
- `DroneLook` は、向きの角度(水平は度、高さは -1～1)をばねで目標へ近づけ(少し行きすぎて落ち着く)、いちばん近いコマを出す。回っている間は少し横に縮んでコマの切り替わりをなじませる。目標は移動の向き(0:正面 1:上 2:下 3:左 4:右 5:後ろ。`DIR_YAW`・`DIR_ELEV`)から決めるが、`update()` に縦の速さも渡すと動く向きそのものに向く(自分のドローン君。斜めにも向く)。傾き・ふわふわもここ。
- 色違いは、使ったコマだけを1コマずつ作って覚える(`tintedFrame()`)。コマを増やしても色違いの分のメモリは増えない。
- 見た目(スキン)はタイトルの「設定」で選ぶ(`droneSkin`。選んだものは `localStorage` の `dronekun_skin`)。協力プレイ・対戦でも、それぞれの画面では自分の選んだ見た目で全員(同胞・ドローン君改も)が描かれる。
  - 標準(案E)：`drawFlatDrone()` が起動時に図形で描く(画像ファイルはない)。元の絵の2次元のテイストで、暗い影絵のような色に、質感はハイライトの線で足している。胴体の箱の形は向きで変えず、目・棒・通気口・後ろのふたを箱のまわりの角度として持ち、向きに合わせて横へすべらせる。
  - クラシック：元の6方向のドット絵を、角度ごとにいちばん近い絵としてシートに並べ直す(`origFrame()`)。ドット絵なので、傾いておらず整数倍で描くときはなめらかにしない(`droneSheets.pixel`)。
  - 見た目を足すときは、`droneSkin.list` に並べ、`droneSkin.prepare()` でシートの作り方を足す。
- 開発用：`index.html#art=A` のように開くと `images/game/Drone/drone_A.png` を読む(覚えない。見つからなければ標準)。3Dで描いた案A〜Dは、`feature/drone-art-3d-candidates` ブランチに保管してある。
  - 3Dの絵は `tools/drone-art.html`(WebGLで形・光・影を計算。案の見比べページ)で作り、`tools/bake-drone.ps1 A` でシートに書き出す。GPUで描くとヘッドレスEdgeのGPUプロセスが落ちることがあるので、書き出しはソフトウェア描画(SwiftShader)で行う。
- `tools/drone-motion.html`：ゲームと同じ `DroneLook` で、自分・同胞の色違い・ドローン君改・ストーリーの大きさを動かして見る。`#art=O` で見た目を選び、`#art=E,film` で動きをコマ送りの1枚にする。
- 1枚の絵として使うところ(ストーリーの残骸など)には、正面の絵を切り出した `Drone_front` がある。

## 雑魚敵の見た目(enemyArt.js)

- ドローン君(標準)と同じ画風：平らな塗り・濃いふちどり・左上から光が当たるハイライトの線。グラデーションや影のぼかし(`shadowBlur`)は使わない(数が多くても軽く描けるように。1体あたり約10µs)。光るランプのにじみは薄い円を重ねて表す(`halo`)。
- 大きさ・当たり判定(`r`)と色の役割(虫の灰色の羽・突進の赤・回転砲台のオレンジ・人間の兵器のオリーブ)は変えない。被弾したときは胴体を白く塗る(`_body`)。
- 協力プレイのゲストの画面でも同じに見えるよう、絵に使う値はホストから届くもの(`t`・`vx`・`vy`・`face`・`timer`・`spin`・`firing`・`fuse`・`aimX`/`aimY`・`turret`・`flash`)だけにする。新しい値を使うときは `coop.js` の `packEnemy` と受け取り側も直す。
- `tools/enemy-art.html`：雑魚敵を大きく並べ、等倍と状態の違い(被弾・濡れ・EMP・傷)も並べて動かす。`#still` で撮影用に止める。
- 女王蜂(ボス)は Undertale の敵のように、頭・胸・お尻・針・羽・脚・触角・冠を別々に、つけ根を軸に動かす。部位ごとに周期とタイミングをずらし、頭は体の傾きを先取りし、お尻・針・冠・触角は遅れてついてくる。突進の構え(`mode` の `aim`・`count`)で縮こまって震え、突進(`dash`)で羽をたたむ。使う値は `t`・`vx`・`mode`・`count`・`enraged`・`flash`・`fake`(協力プレイのゲストにも届く)だけ。本物の突進の前だけ、最後の `QUEEN_CUE` の間に羽を開き、針の先に星のきらめきを出す(フェイントでは出ない)。突進をジャスト衝撃波で弾かれると `stagger` でよろける(`special.parry`)。
- 移動要塞(ボス)も同じ考え方で、装甲の板8枚(波のように順にふくらむ。渦巻き弾で開いて中の光が見え、輪が半周まわる)・コア(目のように狙う向きを見て、ときどきシャッターが閉じる。レーザーの予告で開いて光る)・主砲(3方向弾の反動・レーザーで伸びる)・左右の砲台(主砲に遅れて揺れ、少し遅れて撃つ)・噴射口3つ(炎がばらばらにゆらぐ)を動かす。使う値は `t`・`vx`・`mode`・`count`・`angle`・`enraged`・`flash`。
- ドローン君改(ボス)は、本体がスキンのシートの絵(1枚に焼き込まれている)なので、絵を上(プロペラ・棒)と下(胴体)に切り抜いて2回描き(`KAI_SPLIT`)、上を遅れて弾ませ、傾きにも遅れてしならせる。まわりに図形の改造部品を足して別々に動かす：左右の副砲(エネルギーの線でつながって浮かび、狙う相手は `nearestPlayer` なのでどちらの画面でも同じ。レーザーの予告で前へ出て光をためる)・背中の装甲の輪とケーブル(出力の段階 `phase` で数が増える。五龍の陣 `circleT` で広がる)・胸の鼓動の光・落雷の予告(`strikes`)で副砲から走る稲妻。ブレード・地雷・予告の円は前と同じく `bosses.js` の `drawKaiParts`。
- `tools/boss-art.html`：ボスの前の絵と新しい絵・怒り・被弾を並べ、下に時間をずらしたコマを並べる(1枚で動きがわかる)。ふだんは女王蜂、`#fortress` で移動要塞、`#kai` でドローン君改。`#still` で撮影用に止める。

## 開発用の機能

- **デバッグのメニューの入口は専用のリンクだけ**(キーボードの操作はない)。URL に `#debug` を付けて開く(`…/dronekun/#debug`、手元なら `index.html#debug`)と、タイトルの「設定」の左に「DEBUG」ボタンが出る(`bossDebug.js` の `debugUrl()`)。スマホでも同じ。セーブ・ハイスコア・見たストーリーの記録は変えない(始める前の状態に戻す)。
  - ボス戦：WAVE5/10/15/20のボスをすぐ始める。「装備」で強さ(弱い/標準/最強)、「無敵」で被弾しない。
  - 武器試用：装備を3つまで選び(押した順に装備枠へ)、装備のレベル・能力のレベル・敵の強さ(`TRIAL_WAVES` のWAVEの雑魚敵)を決めて戦う。敵は尽きずに出続け(`TRIAL_MAX_ENEMIES` 体まで)、いつも無敵。画面上に直近 `TRIAL_DPS_SEC` 秒の毎秒ダメージと撃破数、戻ると始めからの平均を出す(`mainScreen.hitEnemy` から `bossDebug.dealt` で数える)。
  - ストーリー確認：戦闘なしで全ストーリーを順に流す。終わるとメニューへ戻る。
  - 時止めワープ「オン」(ショップのバフと同じ能力。`timeStop.js`)：クールタイムなしで、ボス戦・武器試用で、被弾する瞬間に時が止まり(ダメージなし)、クリック・タップした場所へ、体が粒子にほどけて飛び、組み上がる。そのあと `WARP_GUARD` の間は無敵。協力プレイ・対戦では働かない。粒子はドローン君の今のコマを別のキャンバスに写して小さく切って描く(`getImageData` は使わない)。
  - 途中でメニューへ戻るのは、右下の「DEBUG：戻る」(`sound.buttons` の `debugBack`)。
- `common.js` の `DEBUG = true` で、マウス座標などを左上に表示。
- 画面上部の中央に、フレームレート(1秒あたりの描画回数)を常に表示している(`draw.js` の `fps`)。`FPS_WARN` 未満でオレンジ、`FPS_BAD` 未満で赤。

## 協力プレイ(coop.js)

- ホストが敵・弾・アイテムを動かし、状態を約30回/秒でゲストへ送る。ゲストは自分のドローン君と武器を自分の画面で動かし、与えたダメージ・拾ったアイテム・衝撃波を「合計値」で送り返す。被弾判定はそれぞれが自分について行う。
- 送る量は1回 `COOP_LIMIT`(12000バイト)以内。超えるときはゲストから遠いものから削る。
- 敵の状態：減速(EMP)・濡れ(水鉄砲)・燃える(火炎放射)・凍る(冷凍)は、ゲストが付けた回数をダメージと一緒に送り(`guestHit` の `dm`)、ホストが自分の敵に付ける。ホストからは状態の印を送る(`packEnemy` の `flags`)。燃えて削れる分と、凍った敵への2倍はホストだけで数える。ゲストの重力弾の渦は、相方の武器の見た目(`armsSummary`)で届いた位置でホストが敵を吸い寄せる。ゲストのバリアが防いだ弾は、防いだ位置を送り(`br`)、ホストがいちばん近い弾を消す。
- ジャスト衝撃波(`mainScreen.justBlast`)：ひとり用は画面のすべてをゆっくりにするが、協力プレイでは画面がずれないよう、出来事(`addEvent` の3)で相方に知らせ、敵と弾を動かしているホストが `slowmo` でゆっくりにする(`JUST_COOP_SLOW`)。
- ジャスト・カウンター(`mainScreen.counter`)：ぶつかる直前の突進・人間のドローン(`COUNTER_TYPES`)をジャスト衝撃波で弾き返す。ゲストは出来事の4(敵の番号)で知らせ、ホストが弾き返す。弾き返した突進は状態の印(`flags` の64)で届き、ゲストには当たらない。
- 協力プレイの難易度は、ホストが部屋を作る前に部屋選びの画面で選ぶ(`coop.diff`)。ホストの状態(`buildHost` の `d`)でゲストに届き、ゲストも同じ難易度になる。
- 協力プレイ中は敵の体力2倍(`COOP_HP_MUL`。難易度の倍率に掛ける)、強化・装備は各自、セーブしない。毎回レベル1・パーツ0から始める(ひとり用の能力は使わない)が、集めたパーツはひとり用の持っているパーツに足す(`game.gainParts` が `coop.unbanked` に数え、強化画面に入ったとき・ゲームオーバー・エンディング・抜けたときに `save.bankParts` で書く)。
- 拾ったパーツはふたりとも受け取る。自分が拾った数の合計(`partsGot`)を送り合い、増えた分を足す(`shareParts`)。報酬カプセル・やる気は拾った人だけ。
- コンティニュー：強化画面で `save.write` が呼ばれると、協力プレイ中はセーブの代わりに `coop.checkpoint` に覚える。ふたりとも撃墜されたらゲームオーバー画面でコンティニューを押せて、ふたりとも押すと(相方がいなければすぐ)ホストが `checkpoint` に戻して強化画面へ。ゲストはホストが強化画面へ戻ったのを見てついていく(`continueGame`)。
- 通信は PeerJS(WebRTC)。ブラウザ同士が直接つながり、アカウントは不要。
  - ホストは4文字の部屋コードを作り、`COOP_ID_PREFIX` + コードを PeerJS の ID にして待つ。ゲストはその ID へつなぐ。
  - 招待リンクは `…#join=コード`。開くと自動で部屋に入る(`coop.js` の末尾)。
  - つなぎ方は送り直さない(状態は毎回まるごと送り、ゲストからは合計値を送るので、途中が抜けても困らない)。PeerJS の `reliable:false` は「順番を守らない」だけで、届くまで送り直してしまう。回線が悪くなると送り直しが詰まり、回線が戻っても30秒以上なにも届かず切れていた。そのため `coop.js` で `RTCPeerConnection.prototype.createDataChannel` を包み、名前が `COOP_CHANNEL` で始まるチャンネルに `maxRetransmits:0` を足している(PeerJS には手を加えない)。送れずにたまっている量が `COOP_BUFFER_MAX` を超えたら新しい状態を積まない。順番が入れ替わって届いた古い状態は、番号(`q`)で捨てる。
  - 始まった後に `COOP_TIMEOUT`(30秒。回線が十数秒悪くなっても続けられるよう長め。以前の8秒では切れていた)の間なにも届かなければ切断とみなす。`COOP_LAG_SHOW` を超えて届かない間は、画面の上に「通信が不安定です」と待っている秒数を出す(`coop.drawLag`。`coop-test.html` の `mute` で、ホストから15秒届かなくても切れないことを確かめる)。始まる前は数えない(ホストが招待リンクを送るために別のアプリへ切り替えている間は、画面が止まるため)。
  - 状態は描画のループ(`requestAnimationFrame`)の中で送るので、ウィンドウが隠れる・覆われて描画が止まると送れない。そのため、タイマーで `COOP_KEEPALIVE` ごとに生きている合図(`ka`)だけ送り、切断とみなされないようにしている(`coop-test.html` で、ゲストの更新を12秒止めて確かめる)。
  - 切れたときの文は、理由で分ける(`partnerLeft`)：相方が自分から抜けた(抜ける前に `bye` を送る)「退出しました」、なにも届かない「通信が途絶えました」、合図なしに閉じた「接続が切れました」。
  - 相方とつながった後は、PeerJS のエラー(`peer.on("error")`)で部屋を閉じない(`ignorePeerError`)。回線が一瞬途切れると、仲介サーバーとのつながりが切れて `network` エラーが出るが、相方との通信は続いているため。以前はこれで切れていた(`coop-test.html` の `netError` で確かめる)。
  - つなぎ直し：回線が途切れると、前の経路が使えなくなって戻らないことがある(ルーターが割り当てる番号が変わるなど。「通信が不安定です」が30秒続いて切れていた)。ゲストは、ホストから `COOP_RECONNECT_AFTER` の間届かなければ、同じ部屋へ新しくつなぎ直す(`tryReconnect`。届くまで `COOP_RECONNECT_EVERY` ごと。画面が止まっていても動くようタイマーから呼ぶ)。ホストは、今の相方(`partnerId`)からのつなぎ直しなら受け入れ、開いたら新しいほうに入れ替える(`adoptConn`)。前のつながりは閉じない(閉じると、まだ入れ替えていない側で「接続が切れた」になる)。つなぎ直しには仲介サーバーとのつながりが要るので、部屋にいる間は切れたら `COOP_SERVER_RETRY` あとにつなぎ直す(`serverLost`)。`coop-test.html` の `mute` で、ホストの今のつながりを止めて確かめる。偽の PeerJS の `conn.peer` は、本物と同じく相手の ID。
  - ゲストが抜けたら、ホストはひとりで続ける。ホストが抜けたら、ゲストはタイトルへ戻る。始まった後の途中参加はできない。
- 通信部分(`createRoom`・`joinRoom`・`setupConn`・`update` の相方の読み取り・`send`)と、状態の作り方(`buildHost`/`buildGuest`/`readHost`/`readGuest`/`guestSync`)は分けてある。
- 本物の通信の確認は、ヘッドレスEdgeを `--remote-debugging-port` で起動し、DevTools プロトコルで2つのウィンドウを操作して行った。ヘッドレスでは、裏に回ったタブの `requestAnimationFrame` が止まる。2つ目は `Target.createTarget`(`newWindow:true`)で別ウィンドウとして開く。
- 協力プレイは GitHub Pages 版だけ。claude.ai の Artifact の中では外部との通信も WebRTC も止められているため、PeerJS は使えない(以前あった Artifact 版は 2026-10-03 に削除した)。

## 対戦(versus.js)

- 部屋作り・参加・招待リンク・切断の扱いは協力プレイと同じ(`coop.js`)。`coop.mode` が `"vs"` のとき対戦になる。ゲストはホストから届いた `m` に合わせるので、どちらの画面から入っても、招待リンクからでもよい。
- 対戦中は `coop.active` は false(協力プレイ用の処理が動かないように)。`versus.active` で見分ける。
- 流れ：装備選び(`select`) → ふたりとも準備OKで戦闘(`fight`。最初の `VS_COUNTDOWN` は秒読み) → 結果(`result`) → 「もう一度」でラウンドを進めて装備選びへ。
- 相手は自分の画面では `enemies` に入った敵(`rival:true`)。装備はいつもどおり自動で狙い、`mainScreen.hitEnemy` が `versus.hit` へ回す。与えたダメージ(`VS_DAMAGE_MUL` をかけた値)の合計を送り、受けた側が自分の耐久から引く。被弾の判定は攻撃した側の画面で行う。
- 衝撃波は円い衝撃波で、範囲(`BLAST_RADIUS`)にいる相手にダメージ。出した直後(`mainScreen.guard`)は受けたダメージを無視する。相手の衝撃波は `mainScreen.blastFx(…, true)` で見た目だけ描く。
- 能力・装備は対戦用に `game` を作り直す(ひとり用のセーブには書き込まない。つづきからはセーブから読み直す)。
- 追加の装備の対戦での効き方：冷凍は凍らせる代わりに相手を遅くする(`VS_ICE_SLOW`。EMPと同じく回数を送る)。バリアは、受けたダメージを板1枚で `VS_BARRIER_ABSORB` 防ぐ(`arms.absorbVs`)。重力弾は相手を吸い寄せない(相手の位置は相手の画面で決まる)が、渦のダメージは入る。
- バランス調整：`tools/vs-balance.html`(組み合わせを変えて自動で何戦もする。`#8` で戦数)と `tools/vs-dps.html`(装備1つずつの毎秒のダメージ。`#ids=fire,disc` で測る装備を選べる。全部だと時間がかかる)。自動プレイは近づかないので、ブレード・地雷は実際より弱く出る。

## Git の運用

- `main`: 公開版(GitHub Pages がこのブランチ直下を公開する)。
- `develop`: 開発の本流。方向性ごとの試作は `develop` から枝分かれしたブランチで行い、ときどき `develop` を取り込んで差を広げすぎない。
- コミットメッセージは日本語でよい。コミット前に `tools/run-smoke.ps1` を通す。

### 公開版(main)の更新

- **`main` の更新は必ず `tools/release.ps1` で行う**。`main` へ直接 push・merge しない。`--no-verify` でフックを飛ばさない。
- スクリプトがすること：確認(変更が残っていない・`develop` と `main` が GitHub と同じ・`main` をそのまま進められる) → テスト → `main` を `develop` まで進める → 公開版のタグ(`v年.月.日`、同じ日の2回目からは `.2`…)を付ける → `main` とタグを一緒に push → GitHub の Releases を作る → GitHub Pages の作り直しを待ち、公開サイトの `index.html` が今のコミットと同じになるまで確かめる(push しても作り直しが始まらないことがあったので、始まらなければこちらから頼む)。タグのメモと Releases の本文は同じ。
- 公開を頼まれたら、Claude が本文をまとめる：
  1. 前の公開版のタグから `develop` までのコミットと変更を読み、遊ぶ人から見た変化を、見出し(`### 見た目・演出` など)と短い箇条書きでまとめる。開発用の変更は最後に分ける。ストーリーのネタバレ(同胞・人間の兵器・真実)は書かない。
  2. 本文はユーザーに確認を取らずに、ファイルに書いて `powershell -ExecutionPolicy Bypass -File tools\release.ps1 -NotesFile <本文.md>` を実行する(`-DryRun` で、確認と本文の表示だけを試せる)。公開したあとで、本文と Releases の URL を伝える。
  - 本文を渡さずに実行すると、コミット一覧の下書きをメモ帳で開く(人が自分で公開するとき用)。
- `.githooks/pre-push` が、公開版のタグの付いていないコミットを `main` に push するのを止める。クローンごとに一度 `git config core.hooksPath .githooks` で有効にする。
- Releases の作成には `gh`(GitHub CLI。`gh auth login` 済み)が要る。
- 公開版の一覧は `git tag -n9`・`gh release list`・GitHub の Releases のページ。2つの公開版の差は `git log --oneline v2026.10.02..v2026.10.03`。
- 昔の公開版で遊ぶ・協力プレイするとき：タグからブランチを作って push し(`git branch release/v2026.10.02 v2026.10.02`)、GitHub Pages の公開ブランチをそれに切り替える。終わったら `main` に戻す。切り替えている間は公開サイトがその版になり、今の版とセーブ(`localStorage`)を共有する。
