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
  - `tools/smoke-test.html`: ストーリーの流れ・各WAVEの戦闘・全シナジー・強化画面・ストーリー確認モード・ドローン君の絵と振り向き・タイトルの設定(見た目の切り替え)・雑魚敵の見た目
  - `tools/coop-test.html`: 協力プレイ。ゲーム2つ(`tools/coop-frame.html`)を iframe で開き、偽のPeerJS(`tools/fake-peer.js`)の通信を親ページが中継する。部屋作り・コード違い・参加・出撃・WAVEクリアの同期・ゲストの攻撃の反映・退出と、対戦(参加・開始・決着・勝敗の一致・もう一度・退出)を確かめる(インターネット不要)
- 新しい機能を足したら、`tools/smoke-test.html`(協力プレイに関わるものは `tools/coop-test.html`)にも確認項目を足す。
- 見た目の確認はヘッドレスEdgeのスクリーンショットで行う:
  `msedge --headless=new --disable-gpu --allow-file-access-from-files --virtual-time-budget=3000 --window-size=960,540 --screenshot=<出力.png> <file:///...html>`
  特定の画面を撮りたいときは、`<base href="../">` を入れたテスト用HTMLで状態を作ってから撮る(`tools/smoke-test.html` の書き方を参照)。
- バランス調整は、よけて動く自動プレイ(`smoke-test.html` の `bot()`)を何回か回して、到達WAVEで比べる。1回だけの結果は運の差が大きい。

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
| `bosses.js` | レア敵・ボス(女王蜂・移動要塞・ドローン君改)。`special` |
| `startScreen.js` | タイトル画面 |
| `mainScreen.js` | 戦闘画面。敵の種類(`ENEMY_TYPES`)・敵の弾・アイテム・HUD |
| `dragons.js` | 衝撃波(クリック)＝五龍の大技 |
| `forces.js` | 同胞(色違いのドローン君)と人間の兵器。`ENEMY_TYPES` に種類を追加している |
| `enemyArt.js` | 雑魚敵(`mainScreen.js` の6種類と人間の兵器3種類)の見た目(`enemyArt`)。`mainScreen.drawEnemy` から呼ぶ |
| `upgradeScreen.js` | 強化画面(報酬カード・能力強化・装備・能力リセット) |
| `gameoverScreen.js` | ゲームオーバー画面 |
| `story.js` | ストーリー(`STORIES`)・ストーリー画面・エンディング・ストーリー確認モード |
| `bossDebug.js` | デバッグ：ボス戦だけを遊ぶ(タイトルで B キー) |
| `lib/peerjs.min.js` | PeerJS 1.5.5(外部ライブラリ。MITライセンス、`lib/PEERJS-LICENSE`)。協力プレイの通信に使う。手を加えない |
| `coop.js` | ふたりで協力プレイ(下記「協力プレイ」参照)。対戦も同じ部屋・通信を使う |
| `versus.js` | ふたりで対戦(下記「対戦」参照)。page 7 |
| `draw.js` | 1/60秒刻みの更新ループと描画。最後に読み込む |

画像は `images/game/` 以下(ポインタと、ドローン君の見た目「クラシック」用の元の6方向のドット絵 `Drone/Drone_*.png`)。それ以外の見た目はすべてキャンバスに図形で描いている(下の「ドローン君の絵」参照)。
`images/ogp.png`(1200×630)は、リンクを貼ったときのプレビュー画像(`index.html` の OGP タグ)。WAVE5の女王蜂戦をヘッドレスEdgeで撮ったもの。ページの紹介文やプレビューには、ストーリーのネタバレ(同胞・人間の兵器・真実)を出さない。

## 仕組み

- キャンバスは 960×540 固定(32×18 マスで `GS = 30px`)。CSSで縮めても座標はこの大きさのまま。
- 画面(page)の番号: 0 タイトル / 1 戦闘 / 2 強化 / 3 ゲームオーバー / 4 ストーリー / 5 エンディング / 6 協力プレイ・対戦の部屋選び / 7 対戦。
  各画面は `{ enter(), update(), draw() }` を持つオブジェクトで、`draw.js` の `screens` 配列に並ぶ。切り替えは `page.change(n)`。
- 更新は `draw.js` で1/60秒ごと(画面のリフレッシュレートに依存しない)。`update()` が1コマ、`draw()` が描画。
- クリックは `Click == 1` が1コマだけ立つ。ボタンは `drawRect` の `clicked()` / `button()` を使う。
- セーブは `localStorage`(`dronekun_save`・ハイスコア `dronekun_best`・クリア済み `dronekun_cleared`)。強化画面に入ったときに自動セーブ。
- 画面右下のボタン(`sound.js` の `sound.buttons`)：BGM・SEはいつでも、「当たり判定」「ポインタ」の表示/非表示は戦闘中だけ出す(`when`)。表示の設定は `common.js` の `viewOpt`(`localStorage` の `dronekun_view`)。ポインタを隠すのは戦闘中だけ(メニューでは操作に要るので出す)。
- 全20WAVE(`FINAL_WAVE`)。5WAVEごとにボス。WAVE15(`REVEAL_WAVE`)のボス後に真実が明かされ、WAVE16からは人間の兵器が敵になる。

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
| 能力の値・強化コスト | `common.js` の `STATS`・`UPGRADE_COST` |
| 装備の強さ・攻撃間隔 | `equipment.js` の `WEAPONS`・`SLOT_COST`、水鉄砲は `WATER_*` |
| シナジーの組み合わせ・色 | `equipment.js` の `SYNERGIES`・`SYN_COLOR` |
| 敵の種類・弾幕の増え方 | `mainScreen.js` の `ENEMY_TYPES`・`danmaku()`・`HIT_CORE`・`GRAZE_RANGE` |
| 雑魚敵の見た目・色 | `enemyArt.js` の `enemyArt`・`ENEMY_COLOR` |
| 衝撃波(五龍) | `mainScreen.js` の `BLAST_*`、`dragons.js` の `DRAGON_*` |
| レア敵・ボス | `bosses.js` の `RARE_*`・`BOSS_EVERY`・`makeBoss()`・`KAI_PATTERNS` |
| 同胞・人間の兵器 | `forces.js` の `kinRate()`・`pickHuman()` |
| ストーリーの文章・背景・流れる時期 | `story.js` の `STORIES`・`STORY_SKY`・`STORY_AFTER` |
| BGM | `sound.js` の `TRACKS` |
| 対戦の耐久・装備ごとのダメージ倍率 | `versus.js` の `VS_HP`・`VS_DAMAGE_MUL` |
| ドローン君の色・振り向き・傾き | `common.js` の `FLAT_COLOR`・`FLAT_YAWS`・`FLAT_ELEVS`・`TURN_*`・`TILT_*` |

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

## 開発用の機能

- **デバッグのメニューの入口は専用のリンクだけ**(キーボードの操作はない)。URL に `#debug` を付けて開く(`…/dronekun/#debug`、手元なら `index.html#debug`)と、タイトルの「設定」の左に「DEBUG」ボタンが出る(`bossDebug.js` の `debugUrl()`)。スマホでも同じ。セーブ・ハイスコア・見たストーリーの記録は変えない(始める前の状態に戻す)。
  - ボス戦：WAVE5/10/15/20のボスをすぐ始める。「装備」で強さ(弱い/標準/最強)、「無敵」で被弾しない。
  - ストーリー確認：戦闘なしで全ストーリーを順に流す。終わるとメニューへ戻る。
  - 途中でメニューへ戻るのは、右下の「DEBUG：戻る」(`sound.buttons` の `debugBack`)。
- `common.js` の `DEBUG = true` で、マウス座標などを左上に表示。
- 画面上部の中央に、フレームレート(1秒あたりの描画回数)を常に表示している(`draw.js` の `fps`)。`FPS_WARN` 未満でオレンジ、`FPS_BAD` 未満で赤。

## 協力プレイ(coop.js)

- ホストが敵・弾・アイテムを動かし、状態を約30回/秒でゲストへ送る。ゲストは自分のドローン君と武器を自分の画面で動かし、与えたダメージ・拾ったアイテム・衝撃波を「合計値」で送り返す。被弾判定はそれぞれが自分について行う。
- 送る量は1回 `COOP_LIMIT`(12000バイト)以内。超えるときはゲストから遠いものから削る。
- 協力プレイ中は敵の体力2倍(`COOP_HP_MUL`)、強化・装備は各自、セーブしない。
- 拾ったパーツはふたりとも受け取る。自分が拾った数の合計(`partsGot`)を送り合い、増えた分を足す(`shareParts`)。報酬カプセル・燃料は拾った人だけ。
- コンティニュー：強化画面で `save.write` が呼ばれると、協力プレイ中はセーブの代わりに `coop.checkpoint` に覚える。ふたりとも撃墜されたらゲームオーバー画面でコンティニューを押せて、ふたりとも押すと(相方がいなければすぐ)ホストが `checkpoint` に戻して強化画面へ。ゲストはホストが強化画面へ戻ったのを見てついていく(`continueGame`)。
- 通信は PeerJS(WebRTC)。ブラウザ同士が直接つながり、アカウントは不要。
  - ホストは4文字の部屋コードを作り、`COOP_ID_PREFIX` + コードを PeerJS の ID にして待つ。ゲストはその ID へつなぐ。
  - 招待リンクは `…#join=コード`。開くと自動で部屋に入る(`coop.js` の末尾)。
  - つなぎ方は `reliable:false`(再送しない)。状態は毎回まるごと送り、ゲストからは合計値を送るので、途中が抜けても困らない。
  - 始まった後に `COOP_TIMEOUT` の間なにも届かなければ切断とみなす。始まる前は数えない(ホストが招待リンクを送るために別のアプリへ切り替えている間は、画面が止まるため)。
  - ゲストが抜けたら、ホストはひとりで続ける。ホストが抜けたら、ゲストはタイトルへ戻る。始まった後の途中参加はできない。
- 通信部分(`createRoom`・`joinRoom`・`setupConn`・`update` の相方の読み取り・`send`)と、状態の作り方(`buildHost`/`buildGuest`/`readHost`/`readGuest`/`guestSync`)は分けてある。
- 本物の通信の確認は、ヘッドレスEdgeを `--remote-debugging-port` で起動し、DevTools プロトコルで2つのウィンドウを操作して行った。ヘッドレスでは、裏に回ったタブの `requestAnimationFrame` が止まる。2つ目は `Target.createTarget`(`newWindow:true`)で別ウィンドウとして開く。
- 協力プレイは GitHub Pages 版だけ。Artifact の中では外部との通信も WebRTC も止められているため、PeerJS は使えない(Artifact 版に載っている協力プレイは古い room 方式のままで、実際にはつながらない)。

## 対戦(versus.js)

- 部屋作り・参加・招待リンク・切断の扱いは協力プレイと同じ(`coop.js`)。`coop.mode` が `"vs"` のとき対戦になる。ゲストはホストから届いた `m` に合わせるので、どちらの画面から入っても、招待リンクからでもよい。
- 対戦中は `coop.active` は false(協力プレイ用の処理が動かないように)。`versus.active` で見分ける。
- 流れ：装備選び(`select`) → ふたりとも準備OKで戦闘(`fight`。最初の `VS_COUNTDOWN` は秒読み) → 結果(`result`) → 「もう一度」でラウンドを進めて装備選びへ。
- 相手は自分の画面では `enemies` に入った敵(`rival:true`)。装備はいつもどおり自動で狙い、`mainScreen.hitEnemy` が `versus.hit` へ回す。与えたダメージ(`VS_DAMAGE_MUL` をかけた値)の合計を送り、受けた側が自分の耐久から引く。被弾の判定は攻撃した側の画面で行う。
- 衝撃波は五龍が相手に食らいつく。出した直後(`mainScreen.guard`)は受けたダメージを無視する。相手の衝撃波は `dragonBlast.cast(…, true, [versus.me])` で、龍が自分に向かってくる見た目だけ描く。
- 能力・装備は対戦用に `game` を作り直す(ひとり用のセーブには書き込まない。つづきからはセーブから読み直す)。
- バランス調整：`tools/vs-balance.html`(組み合わせを変えて自動で何戦もする。`#8` で戦数)と `tools/vs-dps.html`(装備1つずつの毎秒のダメージ)。自動プレイは近づかないので、ブレード・地雷は実際より弱く出る。

## Git の運用

- `main`: 公開版(GitHub Pages がこのブランチ直下を公開する)。
- `develop`: 開発の本流。方向性ごとの試作は `develop` から枝分かれしたブランチで行い、ときどき `develop` を取り込んで差を広げすぎない。
- コミットメッセージは日本語でよい。コミット前に `tools/run-smoke.ps1` を通す。

### 公開版(main)の更新

- **`main` の更新は必ず `tools/release.ps1` で行う**。`main` へ直接 push・merge しない。`--no-verify` でフックを飛ばさない。
- スクリプトがすること：確認(変更が残っていない・`develop` と `main` が GitHub と同じ・`main` をそのまま進められる) → テスト → `main` を `develop` まで進める → 公開版のタグ(`v年.月.日`、同じ日の2回目からは `.2`…)を付ける → `main` とタグを一緒に push → GitHub の Releases を作る。タグのメモと Releases の本文は同じ。
- 公開を頼まれたら、Claude が本文をまとめる：
  1. 前の公開版のタグから `develop` までのコミットと変更を読み、遊ぶ人から見た変化を、見出し(`### 見た目・演出` など)と短い箇条書きでまとめる。開発用の変更は最後に分ける。ストーリーのネタバレ(同胞・人間の兵器・真実)は書かない。
  2. 本文をユーザーに見せて OK をもらってから、ファイルに書いて `powershell -ExecutionPolicy Bypass -File tools\release.ps1 -NotesFile <本文.md>` を実行する(`-DryRun` で、確認と本文の表示だけを試せる)。
  - 本文を渡さずに実行すると、コミット一覧の下書きをメモ帳で開く(人が自分で公開するとき用)。
- `.githooks/pre-push` が、公開版のタグの付いていないコミットを `main` に push するのを止める。クローンごとに一度 `git config core.hooksPath .githooks` で有効にする。
- Releases の作成には `gh`(GitHub CLI。`gh auth login` 済み)が要る。
- 公開版の一覧は `git tag -n9`・`gh release list`・GitHub の Releases のページ。2つの公開版の差は `git log --oneline v2026.10.02..v2026.10.03`。
- 昔の公開版で遊ぶ・協力プレイするとき：タグからブランチを作って push し(`git branch release/v2026.10.02 v2026.10.02`)、GitHub Pages の公開ブランチをそれに切り替える。終わったら `main` に戻す。切り替えている間は公開サイトがその版になり、今の版とセーブ(`localStorage`)を共有する。

## Artifact 版

claude.ai の Artifact(https://claude.ai/artifact/7cWhxfs3eZsDrw7jDLmNWX)でも1人用を公開している。
Artifact に載せるページは `index.html` から `<!DOCTYPE>`・`<html>`・`<head>`・`<body>` の枠を取り除いたもの(Artifact 側が枠を付けるため)で、スクリプトと画像は同じパスで一緒に公開する。
