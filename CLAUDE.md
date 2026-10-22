# ドローン君 — 開発メモ(Claude Code向け)

ブラウザで動く2Dシューティング。ビルドなし・ライブラリなしの素のHTML/JavaScriptで、
`index.html` をブラウザで直接開くだけで動く(サーバー不要)。公開先は GitHub Pages(`main` ブランチ直下)。

ユーザーとのやりとりは日本語。コード中のコメントも日本語で書く。

## 動作確認

変更したら必ず実行する(数秒):

```powershell
powershell -ExecutionPolicy Bypass -File tools\run-smoke.ps1
```

- ヘッドレスのEdgeで `tools/smoke-test.html` を開き、`RESULT: OK` なら成功(終了コード0)。
  - `tools/smoke-test.html`: 画面の流れ(ストーリーを流さないことも)・各WAVEの戦闘・衝撃波とジャスト衝撃波(突進を弾き返すジャスト・カウンターも)・回避ダッシュ・かすりコンボとかすりバースト・ライバル(中ボス)・ボスの試作(強襲ヘリ・傀儡師)・全シナジー・強化画面(ショップも)・デバッグのメニュー(ボス戦・武器試用)・最終局面の試作(Lyria・Suno)・BGMの本格版の楽譜・ドローン君の絵と振り向き・表情・タイトルの設定(見た目の切り替え)・雑魚敵の見た目
  - `tools/coop-test.html`(凍結。`run-smoke.ps1 -Coop` のときだけ流す。下の「協力プレイ・対戦は凍結」を参照): 協力プレイ。ゲーム2つ(`tools/coop-frame.html`)を iframe で開き、偽のPeerJS(`tools/fake-peer.js`)の通信を親ページが中継する。部屋作り・コード違い・参加・出撃・WAVEクリアの同期・ゲストの攻撃の反映(追加の装備の燃やす・凍らせる・渦の吸い寄せ・バリアで防いだ弾も)・ゲストのジャスト衝撃波でホストがゆっくりになる・ゲストのジャスト・カウンターでホストが突進を弾き返す・ライバルがゲストにも見える・退出と、対戦(参加・開始・決着・勝敗の一致・もう一度・退出)を確かめる(インターネット不要)
- `tools/smoke-test.html` は乱数(`Math.random`)を決まった種から出すので、毎回同じ結果になる(乱数の運でたまに落ちる項目をなくすため)。種は `smoke-test.html#seed=数` で変えられる。確認項目を足したら、種を何通りか変えても通ることを確かめる。(`coop-test.html` は2つの画面の通信を実際の時間で中継するので、時間待ちの関係でたまに落ちる項目がある)
- 新しい機能を足したら、`tools/smoke-test.html` にも確認項目を足す(協力プレイ・対戦の確認は足さない)。
- 見た目の確認はヘッドレスEdgeのスクリーンショットで行う:
  `msedge --headless=new --disable-gpu --allow-file-access-from-files --virtual-time-budget=3000 --window-size=960,540 --screenshot=<出力.png> <file:///...html>`
  特定の画面を撮りたいときは、`<base href="../">` を入れたテスト用HTMLで状態を作ってから撮る(`tools/smoke-test.html` の書き方を参照)。
- バランス調整は、よけて動く自動プレイ(`smoke-test.html` の `bot()`)を何回か回して、到達WAVEで比べる。1回だけの結果は運の差が大きい。
- 難易度の測定は `tools/difficulty.html`。WAVEごとに「動かない」と「よけて動く」で戦い、被弾の回数とクリアまでの秒数を表にする(`#runs=6&waves=1-9&gear=std` で回数・WAVE・装備を選ぶ。ヘッドレスEdgeの `--dump-dom` で結果を読む)。自動プレイはレーザーをよけないので、レーザーを使うボス(移動要塞・天蓋母艦)の被弾は実際より多く出る。

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
| `bgmTrial.js` | BGMの切り替え。**ふつうに遊ぶときの曲は、タイトルの「設定」の「曲」で選ぶ**(`viewOpt.music`。`bgmTrial.useSetting`。2026-10-18〜)：標準は Suno の録音の曲(戦闘曲・タイトル・強化画面・人間との戦い。`FIGHT_DEFAULT`)、クラシックは今の曲(`sound.js` の `TRACKS`)。**最終局面(ドローン君改の第二形態)の戦いは、どちらでも Suno 版**(`finaleTriumph.js`。`FINALE_DEFAULT`)。クラシックでは曲は今の曲(`kai2`)を流し、戦いの時刻を決める Suno の曲(`triumph`)は音を消して裏で流す(`bgmTrial.clock()`・`recTrack` の `mute`。曲と演出は合わないが、ユーザーの判断でそのままにしている。体験を損なうとわかったら、クラシックを選べなくする予定)。録音の曲は、今の場面とこの先に使いそうなもの(今のWAVEの戦闘曲・強化画面・ボス・ライバル・最終局面、タイトルの画面ではタイトル)だけを読み込んで開き、ほかは手放す(`bgmTrial.prefetch`。`sound.music` のたびに呼ぶ。開いた音はメモリを多く使うため)。`tools/smoke-test.html` は今の曲でテストする(読み込んだ直後に `finale`・`fight` を0にする)。デバッグのメニューで今の曲や試作の案に替えて聞き比べられる。デバッグのメニューの「BGM」「最終局面」で選ぶと、`sound.music`・`sound.playStep` を包んで、曲の鳴らし方を試作の案(案D 和の怪談風・案F 尺八が主役・案H 管弦と篠笛・案I カリンバ)に替える。曲の並び(`TRACKS`)はそのまま。「最終局面」はドローン君改の第二形態の曲(`kai2`)の代わりに、`finale`(原点回帰。今の音で作ったアレンジ)か `monarch`(Lyria。Google Lyria で作った録音の曲。`monarch` が `AudioBufferSourceNode` の `loopStart`・`loopEnd` で前奏のあとをくり返し、`sound.bgmGain` へつなぐ。音量は `MONARCH_VOL`)か `triumph`(Suno。Suno で作った録音の曲「Triumph in D Major」。音量は `TRIUMPH_VOL`。`triumph.finish()` でくり返しを抜けて、元の曲の終わりまで流す)を流す(`bgmTrial.finales`)。「戦闘曲」は序盤・中盤の戦闘曲・ボス戦・ライバル戦の曲(`heroic`・`battle`・`boss`・`rival`)の代わりに、Suno でカバーした録音の曲(`sunoHeroic`・`sunoBattle`・`sunoBoss`・`sunoRival`。`music/sunoHeroic.js`・`sunoBattle.js`・`sunoBoss.js`・`sunoRival.js`、音量は `SUNO_HEROIC_VOL`・`SUNO_BATTLE_VOL`・`SUNO_BOSS_VOL`・`SUNO_RIVAL_VOL`。録音なのでWAVEが進んでも速くならない)を流す(`bgmTrial.fights`)。同じ「Suno」で、人間との戦い・タイトル・強化画面の曲(`revolt`・`title`・`shop`)も Suno の曲(`sunoRevolt`「Final Surge」・`sunoTitle`「遠景の丘」・`sunoShop`。音量は `SUNO_REVOLT_VOL`・`SUNO_TITLE_VOL`・`SUNO_SHOP_VOL`)に替わる。録音の曲を流すのは `recorded()`(中身は `recTrack()`。Lyria・Suno で共通。`recorded.list` に並べる)。選んだものは覚えない(読み込み直すと、はじめの選び方に戻る)。案は試聴ページ(Artifact)で作ったもの |
| `bgmFull.js` | BGMの「本格版」(試し聞き)。デバッグのメニューの「BGM」で「本格版」を選ぶと鳴る(`bgmTrial.list` に足し、`sound.playStep` を包む)。音色は今の音のまま、曲を区切り(前奏は1回・A・B・サビ・つなぎ)に分けて作り込んだもの。今の曲のメロディは A に使い、B・サビを書き足した。楽譜は `BGM_FULL`(和音は名前、メロディは MML、低音・分散和音・ドラムは16分音符の並び。書き方はファイルの先頭)。ドラムのフィルは `FULL_FILLS`。合成のコーラス(母音の響きの山を通した男声・女声・ささやき。区切りの `choir`・`chant`、調整値は `FULL_CHOIR_*`・`FULL_FORMANTS`)も鳴らせる。コーラス入りの試作曲(ゲームでは使わない)は `tools/bgm-choir-demo.js`。試聴ページは `tools/bgm-full.html`(`#check` で書き間違いと和音に合わない音を出す) |
| `equipment.js` | 装備(`WEAPONS`)・シナジー(`SYNERGIES`)・戦闘中の装備の動作(`arms`)・シナジー演出(`fx`) |
| `armsExtra.js` | 追加の装備(火炎放射・円盤・重力弾・バリア・狙撃・冷凍)とそのシナジー。`WEAPONS`・`SYNERGIES`・`arms` に足す(`arms` から `fire2`・`update2`・`draw2` などを呼ぶ)。敵の状態「燃える」「凍る」もここ |
| `bosses.js` | レア敵・ボス(女王蜂・移動要塞・天蓋母艦・ドローン君改)。`special` |
| `startScreen.js` | タイトル画面 |
| `titleArt.js` | タイトル画面の背景とロゴ・文字の色(`titleArt`)。**曲の設定(`viewOpt.music`)が標準(Suno)なら案D「崖の上の草原」、クラシックなら元のタイトル画面**(`titleArt.sync`・`TART_SUNO`。`startScreen.drawBackground` を包み、文字の色は `startScreen` の `titleCol` が読む)。案D：夕方の崖の際の草原から谷と遠い山なみを見下ろす。草は5層(`CLIFF_GRASS`。層ごとに3つの緑を混ぜ、根元から細くなってしなり、長い草は先が垂れる。日の当たる右側のふちの光・緑の穂・幅の広い葉・層の根元の暗がり。`titleArt.blade`)で、曲の速さ(`TART_BPM`)の `CLIFF_GUST_BARS` 小節ごとに風の波が渡る。ドローン君はポインタに付いていかず(`titleArt.ownDrone` のときは `drone.draw` を呼ばない)、遠くの空を何体も横切る(大きさ・数・速さは元のタイトル画面の影 `TITLE_SHADOWS` に合わせる。遠い(小さい)ほど雲や靄に隠れて淡く見えるよう、透けさせずに空・靄の色を重ねる(`drawFogged`。別のキャンバスに描いて `source-atop` で色を重ねる。透明にすると後ろの町が透けて不自然なため)。上下にふらふら揺れながら飛び、たまに止まって谷の先を眺める後ろ姿になる。画面の端から出ると、しばらくして反対側から別の高さ(草原より上)で帰ってくる。高く飛ぶものは雲の間、低いものは谷の上に描く。風の波で傾く。`CLIFF_DRONE`・`titleArt.fliers`)。ドローン君たちは人の世界に溶け込んで暮らしている。見せるためではなく世界観として、たいていはふつうに飛び、ときどき暮らしぶりが見える(`CLIFF_KINDS`。現れるたびに重み `w` で選ぶ。数は元のまま)：荷物をぶら下げて運ぶ(段ボール箱・紙袋・鉢植え `CLIFF_CARRY`。振り子で揺れる `CLIFF_SWING`)・ふたりではしごを運ぶ(`CLIFF_PAIR`)・急いでいる(速く、止まらない)・寝ぼけている(「z」を出して沈み、はっと持ち直す `CLIFF_SLEEP`)・親子(`CLIFF_FAMILY`)・日傘・手紙を配る(カバンから谷へ手紙を落とす `CLIFF_MAIL`)・風船の束(浮きすぎては下りる `CLIFF_BALLOON`)・鳥と飛ぶ(1羽は頭に乗る `CLIFF_BIRDS`)・迷子(引き返し、止まるときょろきょろ `CLIFF_LOST`)。ふつうのもの同士がすれ違うと、止まってくるっと回ってあいさつすることがある(`CLIFF_GREET`。高さと遠さが近いときだけなので、めったにない)。種類ごとの見え方は `tools/title-fliers.html`(`#zoom` で大きく並べる)。重さの対策(見た目は変えない)：動かない所(遠い山なみと谷の床・川ぞいの町・岩の崖と霞・草原の地面)は別のキャンバスに一度だけ描いて貼り(`titleArt.cached`・`CLIFF_CACHE`。細かさが変わると描き直し、タイトルを出ると手放す)、空は隠れない所だけ塗り(`CLIFF_SKY_BOT`)、草は横に近いものどうしで小さくまとめて塗る(`grassBins`・`CLIFF_GRASS_BIN`。画面の幅いっぱいを1つの形で塗ると、とても重い)。見比べ用に案A～C(夕暮れの丘・薄明の丘・墨の遠景)もあり、`index.html#title=a`～`d` で曲の設定にかかわらずその案になる |
| `mainScreen.js` | 戦闘画面。敵の種類(`ENEMY_TYPES`)・敵の弾・アイテム・HUD |
| `forces.js` | 同胞(色違いのドローン君)と人間の兵器。`ENEMY_TYPES` に種類を追加している |
| `enemyArt.js` | 雑魚敵(`mainScreen.js` の6種類と人間の兵器3種類)の見た目(`enemyArt`)。`mainScreen.drawEnemy` から呼ぶ。ボス(女王蜂・移動要塞・天蓋母艦とその砲台・ドローン君改)の絵もここ(`enemyArt.queen`・`fortress`・`canopy`・`pod`・`kai`。`bosses.js` の `special.draw` から呼ぶ) |
| `upgradeScreen.js` | 強化画面(報酬カード・能力強化・装備・ショップ・能力リセット) |
| `gameoverScreen.js` | ゲームオーバー画面 |
| `story.js` | ストーリー(`STORIES`)・ストーリー画面・エンディング。**ストーリーはふつうの周では流さない**(プロローグ・WAVEのあと・エンディング前の文章とも。2026-10-18〜)。文章と画面のコードは残してあるが、どこからも流さない(デバッグのストーリー確認もなくした)。空の絵(`drawSky`)・`hash` は戦闘の背景も使う。`game.seen.prologue` は「1周目が済んだ」印として使う |
| `battleBg.js` | 戦闘画面(対戦も)の背景。奥の空と街は、試作から遠ざける(`far`。マイナスで寄る)・大きく描く(`zoom`)ことができる。奥にWAVEで移り変わる空と街(昼→夕方→夜→WAVE16からは戦場。描くのは `bgScene.js`。`#bgold` のときは前のとおり `story.js` の `drawSky` を別のキャンバスに粗く描いて薄く敷き、ドローン君と逆へ少しずらす)、手前に戦いに反応する方眼(目の大きさと出すかどうかはタイトルの「設定」で選ぶ：`viewOpt.grid`・`viewOpt.gridSize`、細かい7.5px／普通15px／大きい30px は `BG_CELL_SIZES`。光る範囲は普通の方眼のマス数で決め、細かいでは2倍のマス数にする。はじめの設定は「あり・大きい」。空と街の絵は、方眼の設定にかかわらずいつも出す。大きい・なしは方眼と演出が公開版と同じ(`battleBg.classic()`。大きいは `drawClassic` で絵の上にごく薄い30pxの方眼、なしは線なし)で、光るマス・波は出さず、ジャストのゆっくりの演出も公開版のまま(`mainScreen.js` の `JUST_FX` の `classic`。方眼ありは弱めた `bg`)。衝撃波・ジャスト衝撃波・ボスの着地で波打つ `ripple`、かすったマスが光る `graze`(黄色)、ドローン君の下のマスがいつも灰色に光り、かすりコンボ中は黄色く派手になる `drawAura`、ジャスト衝撃波でドローン君のまわりが水色のひし形に光り、外へひし形の輪になって伝わる `justSpread`)。WAVEの番号と自分の画面の出来事だけで決まるので通信は要らない |
| `bgScene.js` | 戦闘画面の奥の景色(`battleBg.drawSky` から呼ぶ)。空・雲・山・遠い街・近い街・地面を別々の層(`SCENE_LAYERS`)にして、奥ほどゆっくり左へ流し(疾走感。速さは `SCENE_FLOW`・`bgScene.flow`)、ドローン君と逆へもずらす。層は空が変わったときに別のキャンバスへ描いておき、毎フレームは貼るだけ。空ごとの動く物：昼(鳥・飛行機雲・太陽の光の筋)・夕方(鳥・高架を走る電車)・夜(星・航空障害灯・探照灯)・戦場(煙と炎・地平線の爆発・照明弾・曳光弾・対空砲火・爆撃機・火の粉)。最後に紙の色(`SCENE_WASH`)を重ねて敵・弾が見やすい明るさにそろえ、上のふちは表示が読めるよう明るくする(`SCENE_HUD_*`)。位置はWAVEと時間だけで決まる(乱数を使わない)。`#bgold` で前の背景(ストーリーの空を白で薄く敷く)に戻して見比べられる |
| `bossDebug.js` | デバッグのメニュー：ボス戦だけを遊ぶ・武器試用(`#debug` で開いたときだけ) |
| `timeStop.js` | ショップのバフ「時止めワープ」(被弾の瞬間に自動で時が止まり、選んだ場所へ粒子になって移る。クールタイム `BUFF_WARP_CD` 秒・WAVEの始めは使える・協力プレイ／対戦では働かない)。デバッグのメニューで「オン」にすると、クールタイムなしで試せる |
| `dodge.js` | 右クリックの回避ダッシュ。ポインタの方へ一気に飛び(`DODGE_DIST_MIN`～`MAX`、`DODGE_TIME` フレーム)、飛んでいる間と着いたあと少し(`DODGE_GUARD`)は当たらない。飛んでいる間、体は進む向きへ1回転し(`DODGE_SPIN`)、道すじも転がる側へ少し弧を描く(`DODGE_ARC`)。飛んでいる間に弾・レーザー・体当たりが芯に重なると「ジャスト回避」(一瞬止まり、残像が砕け、やる気・すぐまた飛べる。`DODGE_JUST_*`)。そのあと「見切り」で敵と弾だけがゆっくりになり、画面が青く沈んで曲がこもる(ドローン君と装備はふつうの速さ。`dodge.slowStep`・`DODGE_SLOW_*`)。見切りの間にもう一度右クリックすると「切り返し」(試作)：ポインタの方へ長くまっすぐ飛び(`DODGE_SLASH_DIST_*`)、通り道の敵を切って弾を切り落とす。切り込む先は破線で示す。着いて少ししてから(`DODGE_SLASH_DELAY`)切った敵にまとめてダメージ(`DODGE_SLASH_DMG`。敵の体力と同じ割合で伸びる)。倒せたら見切りが短くなって(`DODGE_SLASH_CHAIN`)もう一度切り返せる(一閃→二連斬…。`dodge.startSlash`・`cut`・`cutDown`、音は `dodgeSlash`・`dodgeCut`)。ジャスト回避のあと動き回って被弾しないよう、見切りの間は弾に対する当たり判定が小さく(`dodge.core()`・`DODGE_SLOW_CORE`)、見切りが解けるときにまわりの弾を消す(`DODGE_CLEAR_R`)。切り返しで着いたときも、まわりの弾を吹き飛ばし(`DODGE_SLASH_CLEAR_R`)、ダメージが入るまで＋少し当たらない(`DODGE_SLASH_GUARD`)。`mainScreen.update` から `dodge.update`、`drone.calcXY` から `steer`、`mainScreen.canBeHit` から `evade` を呼ぶ。協力プレイ・対戦では使わない。タッチ操作では、右下の衝撃波ボタンの左の「回避」ボタン(`DODGE_BTN`。見切りの間は「切り返し」)で、動いている向きへ決まった距離(`DODGE_TOUCH_DIST`・`DODGE_TOUCH_SLASH_DIST`)を飛び、指で動かす目標も同じだけ動かす(`dodge.moveTarget`。引き戻されないように) |
| `rival.js` | 中ボス：ライバル「クロノ」(下記「ライバル(中ボス)」参照)。曲の拍に合わせて戦う。ワープの粒子は `timeStop.js` と同じ描き方(`RivalWarp`)。針の弾(`chrono`)の動きと絵は `shotLab.step`・`draw` から呼ぶ |
| `rivalTime.js` | ライバル(`rival.js`)の時を操る力(`rivalTime`。下記「ライバル(中ボス)」の「時を操る攻撃」参照)：時の枷・加速世界・時飛ばし・時の裂け目・別の時間の自分と、第二形態の見た目(針の翼・光る目・暗い炎と歯車)。時の速さは `mainScreen.update` が `rivalTime.frame()`(加速の分だけ敵と弾を余分に動かす)・`takeSkip()`(時飛ばしの分)・`armsStep()`(ドローン君の時が遅い間は装備を何コマかに1回)で、ドローン君の動きは `drone.calcXY` が `rivalTime.delay` で遅らせる |
| `shotLab.js` | 敵の攻撃の試作。弾でない攻撃も持つ：範囲攻撃(`shotLab.zone`。円・横の帯・縦の帯を光の線がなぞり、ためのあと範囲全体を攻撃。衝撃波では消せない。`ZONE_*`)、バケツ(`shotLab.bucket`。画面の上でドローン君の上へ寄り、傾けて液体(弾 `goo`)を流す。続いた粒は糸でつながり、最後に口にしずくがたまって糸を引いて落ち、床でしぶきになって飛び散る。粘りは `GOO_VISCOSITY`(0 さらさら～1 どろどろ)1つで、落ち方・糸の長さ・しぶきがまとめて変わる。`BUCKET_*`・`GOO_*`)、雨攻撃(`shotLab.rain`。雨雲 `storm` が集まって画面が暗くなり、雲の下に硫酸の雨(弾 `acid`)が降る。雲はドローン君の上へゆっくりついてくる。床に落ちた粒は煙 `puddles`。稲光は見た目だけ。`RAIN_*`)、岩投げ(`shotLab.throwRock`。山なりに投げ、着く時刻に投げたときのドローン君の位置を通る。落ちる所に赤い印。床で砕けて破片(弾 `pebble`)が飛び散る。`ROCK_*`)、打ち上げ花火(`shotLab.firework`。星は球の表面に並べて画面へ映し(`fwSphere`。手前ほど明るい)、光は `lighter` でにじませ、花火の間は画面を夜の色にする(`FW_NIGHT`)。玉(弾 `shell`)を下・左右・上などから打ち上げ、減速してドローン君の近く(玉の来た側)で開いて星(弾 `star`)を散らす。開く所に薄い印。種類は `FW_TYPES`：牡丹(芯入り。外の球が途中で色が変わる)・柳(金色の尾を引いてしだれる)・花雷(散った玉が少しあとにはじけ、少しのあいだ大きく当たる)・型物(星がドローン君の形 `FW_KATA_SHAPE` に並び、止まってから落ちる)。`FW_*`)。画面の前後を使う攻撃(奥行き z は0がドローン君の面・1がいちばん奥・マイナスが手前。奥の物は消失点 `DEPTH_VP` へ寄って小さく見える `shotLab.depthAt`)：奥からの砲撃(`shotLab.deep`。着く瞬間に着く所の輪の中だけ当たる。`DEEP_*`)・奥からの突進(`shotLab.ram`。正面向きの絵 `drawRamArt`。着く直前 `RAM_JUST` に衝撃波を出すと弾き返す：`mainScreen.blast` から `shotLab.onBlast`。`RAM_*`)・立体の輪(`shotLab.hoop`。手前の半分だけ当たり、奥を通る弾は `b.behind` で当たらない・かすらない・ジャストにならない・衝撃波で消えない。`HOOP_*`)・奥へ潜る敵(`shotLab.diver`。`e.dive`・`e.depth`。潜る間は `phased`・`harmless`、描くのは `mainScreen.drawEnemy` から `shotLab.drawDeepEnemy`。`DIVER_*`)・手前を横切る影(`shotLab.veilStart`。`VEIL_*`)・ガラスに張り付く液体(`shotLab.glob`・`splat`。当たらず見えにくくする。`GLOB_*`・`GLASS_*`)。いちばん手前の物は `shotLab.drawFront`(`mainScreen.draw` の後ろのほうから)。障害物が横切るギミック(`shotLab.obstacles`。すき間の壁 `shotLab.wall`・流れるコンテナ `shotLab.crate`。動く四角で、ドローン君は `drone.calcXY` の最後で押し出され(`shotLab.pushOut`)、画面の端で押し出しきれないと「はさまれた！」で被弾。敵の弾もドローン君の飛んでいく弾も当たると消える。`OBST_*`)。核弾頭(`shotLab.nuke`。真上へ撃ち上げ、撃ったときのドローン君の位置へ再突入の炎をまとって落ちてくる。落ちる所に照準の範囲と秒読み。弾頭は敵(`e.nuke`。動きは `nukeStep`、絵は `mainScreen.drawEnemy` から `shotLab.drawEnemy`)で、撃ち落とせば爆発しない。着くと超高温の閃光で範囲の中が真っ白に焼け(`NUKE_STOP` の間は時が止まる)、範囲の中は被弾、敵の弾は焼き消える。爆心はしばらく赤熱し(入ると被弾)、熱で空気がゆらぎ(キャンバスを細い帯にずらして写す)、焦げ跡が残る。音は `sound.js` の `nuke`・`nukeLaunch`。`NUKE_*`)。空戦(ドッグファイト)の戦闘機(`shotLab.fighter`。敵 `e.fighter`。動きは `fighterStep`、絵は `drawFighter`、ロックの表示は `drawLockUi`)：機首の向きを持って曲がる速さに限りがあり、ドローン君の後ろ(動いてきた向きの逆。ドローン君の向きは `shotLab.head`)へ回り込む。後ろを取られ続けると急旋回で振り切る。「後ろの取り合い」(`tail`)は、後ろを取った戦闘機が機銃を撃ち、ドローン君が後ろを取るとダメージが `FIGHT_BACK_MUL` 倍(`mainScreen.hitEnemy` から `shotLab.fighterHit`)。「ロックオン」(`lock`)は、機首の前に入れ続けると戦闘機がロックして追尾ミサイル、ドローン君が向きの前に入れ続けるとロックして一撃(`FIGHT_*`・`LOCK_*`)。範囲攻撃・バケツは `shotLab.update`・`drawUnder`・`drawOver` で動かして描き、協力プレイのゲストにはまだ届かない(液体は弾なので届く)。弾の試作(分裂弾・加速弾・ため弾・波打ち弾・曲がり弾・跳ね弾・ブーメラン弾・針弾・ジャスト不可弾)。ジャスト不可弾(`SHOT_KINDS` の `noJust`)はジャスト衝撃波にならず、衝撃波でははね返らずに消えるだけ(当たりそうだったら「ジャスト不可」と出す。`shotLab.noJust`・`denied`)。見分けやすいよう白い芯の代わりに黒地に赤い×、回る赤白のしまの輪、近いと赤く脈打つ(`NOJUST_*`)。`SHOT_KINDS` に種類を足し、動き `shotLab.step`・絵 `shotLab.draw` を `mainScreen.updateShots`・`draw` から呼ぶ。まだ敵には持たせていない(撃つには `shotLab.fire`)。マウスに付いていく動きを使う試作：投げなわ(`shotLab.lasso`。ドローン君の跡が交わって輪になると、中の敵にダメージ・中の弾を消す。殻の敵 `e.shell` は輪でしか倒せない：`mainScreen.hitEnemy` から `shotLab.shellHit`。`LASSO_*`・`SHELL_*`)・ポインタ狙い(`shotLab.ptr`。ドローン君ではなくポインタ(これから行く所)を撃つ。`PTR_*`)・付いていく動きを邪魔する場(`shotLab.field`。風・鏡の円・クモの巣。`drone.calcXY` から `shotLab.steer` が目標と追従の遅れを変える。巣はポインタを振った分だけほどける。`WIND_*`・`MIRROR_*`・`WEB_*`)。敵の能力の試作「迎撃」：`e.intercept` を持つ敵は、範囲 `INTERCEPT_RANGE` に入ったドローン君の飛んでいく弾(機関銃・ミサイル・水鉄砲・冷凍・重力弾。ジャストではね返した弾は除く)を1秒に `INTERCEPT_PER_SEC` 発まで撃ち落とす(`shotLab.enemyStep` を `mainScreen.updateEnemies` から呼ぶ。攻撃の試作では砲台の代わりに動かない的 `e.lab` を置き、撃ち落とした数・当たった数を出す)。調整値は `SPLIT_*`・`ACCEL_*`・`REAIM_*`・`WAVE_*`・`CURVE_*`・`BOUNCE_*`・`BOOMER_*`・`NEEDLE_*`。協力プレイでは動きはホストだけで計算し、弾の種類の番号(`coop.js` の `COOP_SHOTS`)は `SHOT_KINDS` の並び |
| `finaleSync.js` | 最終局面の試作。デバッグのメニューの「最終局面」を「Lyria」にしたときだけ、ドローン君改の第二形態を曲の時刻(`monarch.pos()`)で動かす。曲は `FS_START` 秒から流し始める(`monarch.startAt`。前奏を飛ばして、ためまでを短くする)。区切り `FS_SECTIONS` ごとに攻撃の並び・間隔を変え、拍で撃ち、小節の頭で脈打つ。ため(72秒～。奥へ下がって奥から撃つ。奥の空と街も遠ざかって暗くなる：`battleBg.far`・`FS_FAR*`)→ 無音(82.5秒～。周りの色が抜け(`FS_DRAIN`)、拍ごとに鼓動。奥から迫り、サビの頭 `FS_HIT_T` に画面からはみ出す大きさ `FS_RAM_SCALE` で着く。ジャスト衝撃波を合わせると弾き返し、止まって(`FS_HIT_STOP`)吹き飛ぶ(`FS_FLING`))→ サビ(大きくなる `FS_GIANT`)→ 息つぎ(106.5秒)→ 108秒で放つ。最初のサビまでは体力が `FS_GATE` より減らない。第二形態の間は画面を夜の戦場の色にし(`battleBg.night`・`FS_NIGHT`。改が足もとを照らす `battleBg.light`)、改・弾の光を `lighter` でにじませ、火の粉を舞わせる(`finaleSync.drawUnder`)。第二形態は、改に組み込まれた認識阻害プログラム(ストーリーでドローン君の目をふさいでいたもの)の暴走として、改のまわりにノイズ(体の帯のずれ・赤と水色のかけら。`finaleSync.drawNoise`・`FS_NOISE*`)をまとう。ためで強まり画面にも漏れ出し(`drawLeak`・`FS_LEAK`)、無音で曲と一緒に消えて改が素顔(紫の色が抜けたドローン君の姿。`FS_TRUE_SEC`)になる。弾き返すとノイズが割れて飛び散る(`shatter`・`FS_SHARDS`、音は `fsSfx.shatter`)。上の表示には明るい板を敷く。効果音は細かいもの(`FS_SE_QUIET`)を小さくし(`FS_SE_DUCK`)、大事な瞬間に合成の重い音を鳴らす(`fsSfx`：ためのうなり・無音の高まる音・衝突・風を切る音。残響つき)。`special.kai`・`special.draw`・`shotLab.onBlast`・`shotLab.drawFront` を包む。テストでは `finaleSync.fakeT` で曲の時刻を決める |
| `finaleTriumph.js` | 最終局面の試作(Suno)。デバッグのメニューの「最終局面」を「Suno」にしたときだけ、ドローン君改の第二形態を曲(`triumph.pos()`)に合わせて動かす(Lyria の試作 `finaleSync.js` とは別。重い効果音 `fsSfx` と、細かい効果音を小さくする `FS_SE_QUIET` は借りる)。曲は少しずつ速くなる(160→160.6 BPM)ので、拍の時刻は測った式 `TR_BEAT_FIT` で出す(`finaleTri.beatTime`・`beatAt`)。区切りは小節で `TR_SECTIONS`。流れ：故障(曲の頭から `TR_PROTO_BAR` 小節目まで。倒れた改がノイズ・痙攣・火花を出し、画面の左下にエラーの記録 `TR_FAIL_LOG`、最後に鼓動) → 再構築(「再構築プロトコル 始動」の帯のあと、工程の記録 `TR_PROTO_LOG` と進み具合を出しながら、小節ごとに光の翼を設計図の点線の上へ組み上げ、最初の大きな一打 19.7秒で完全体。`rebuild`・`rebuildFx`・`rebuildBeat`・`drawRebuild`・`drawProtocol`。名前は `TR_NAME`「ドローン君改・天翼」) → 主題・高まり・サビ(拍で撃ち、小節の頭に攻撃。自前の攻撃 `TR_OWN`：翼の羽根 `feathers`(弾 `tFeather`)・すき間のある光輪 `halo`(弾 `tOrb`)・次の小節の拍に落ちる光の柱 `pillars`／横の帯 `bands`・ドローン君を囲んで小節の頭にいっせいに飛ぶ光の槍 `lances`(弾 `tLance`)。ほかは `special.kaiAttack`) → 沈む(93.1秒。身を起こして翼を広げてから、外側へ弧を描いて舞い上がり、背中を見せて奥へ飛び去る `flyAway`・`TR_FLY_*`。最後の突進の前半も同じ。拍ちょうどに着く奥からの砲撃 `deepOnBeat`) → 迫る(100.6秒。改の姿は見せない：タメ(はじめの `TR_MORPH_SEC` で、飛び去った改の姿が光に溶けながらタメの位置へ移る。奥の光。横へ伸びる光の筋 `TR_FLARE_W`・逆へ回る紋様の輪・光の中の目だけ。動き出すまでだんだん強まる `trCharge`・`TR_CHARGE_POW`：光の大きさ・筋の長さ・輪の数と速さ・吸い込む光・ちらつき・稲妻 `TR_ARCS`・震え) → 着く `TR_TELL_BEATS` 拍前に狙いが止まり、照準線が引かれ、拍ごとにその線を光の脈が走る(着く所の照準のかぎ括弧が拍ごとに回りながら締まる `drawReticle`・`TR_RETICLE`・`TR_SNAP_SEC`。迫るタイミングの合図は `drawTiming`：狙いが止まった瞬間から太い輪が一定の速さで縮み、着く `TR_RING_LEAD` 秒前に着く所の輪へ重なる(拍ごとに光る。押してから効く遅れの分だけ早める)。ジャスト衝撃波を出してよい間は着く所の輪が水色に光る) → 最後の `TR_HOLD_BEATS` 拍は照準線が消え、輪が吸い込まれて光が凝縮し、画面のふちが沈む  → 着く `TR_DASH_SEC` 前に奥の光が消え、光の塊が速くなりながら(手前に来るほど大きく)光の尾を引いて着く所へ突っ込む(画面のふちから集まる集中線・強まる揺れ・寄り。`drawRushIn`) → 着いた衝撃(はじめの `TR_INVERT_F` コマは色の反転、白い閃光、赤と水色にずれた衝撃の輪・放射の筋・かけら・寄る・揺れ・止まる。`drawImpact`。曲の時刻で進める)。`approach`・`drawCharge`。最後の突進も同じ) → 最高潮の頭(105.0秒)に着く。ジャスト衝撃波で弾き返す(翼に火がつく `trFire`。曲の拍に合わせて押すと少し遅れやすいので、着いたあとも `TR_LATE_SEC` の間は区切りを進めずに待ち(`trLate`)、その間に出せば弾き返す。`TR_LATE_PERFECT` 以内なら PERFECT。最後の突進も同じ) → 息つぎ(129.0秒。翼をたたむ `trFold`) → 132.0秒に放つ → 嵐 → 夜明け(155.9秒。空が明け(`drawDawn`。`battleBg.drawDark` を包む)、ドローン君に光の翼(`drawHeroWings`)、改へのダメージ `TR_DAWN_POW` 倍、改の羽根は体力とともに欠ける `TR_WING_LOSE`) → 最後の突進(179.8秒。奥へ下がって迫り、最後の和音 184.3秒に着く。体力が `TR_FINISH` 以下でジャスト衝撃波を合わせるととどめ：`triumph.finish()` で曲は最後まで鳴り、WAVEクリアの音・曲の停止を止める `holdMusic`。決められなければ曲は夜明けへ戻ってくり返す)。体力はふだんの第二形態の `TR_HP_MUL` 倍。体力の区切り(`TR_BREAKS`)：決まった割合まで削ると、短いムービー(`trCut`。`TR_CUT_SEC` 秒。止まって閃光と衝撃の音、上下の黒い帯と文、改はのけぞって羽根を散らし `TR_CUT_HOME` へ戻る。弾は消え、ドローン君は撃たない `special.holdFire`)に入り、曲をその先の区切り(沈む・夜明け・最後の突進)の `TR_CUT_SEC` 秒前へ飛ばして(`triumph.jump`。つなぎ目は閃光の陰で `TR_CUT_FADE` 秒なじませる)、ムービーの終わりがちょうど区切りの頭になる(`cutDue`・`startCut`・`cutStep`・`drawCut`)。削った分だけ展開が進み、「時間がたつまで体力が減らない」ことがないようにした。削りきれなければ曲の流れのまま進む。区切りの頭まではその割合より減らない(`floor`。`mainScreen.hitEnemy` を包み、その下で倒れないようにする)。翼の形は `TR_WINGS`(骨に沿って羽根が垂れる。大きな翼と下の小さな翼。`wingGeom`・`drawWings`)。戦闘中は羽ばたかずに滑空する(速いほど翼を後ろへ引く `TR_GLIDE_*`、減速で翼を前へ広げてブレーキ `TR_BRAKE_*`、ばねで行きすぎながら傾く `TR_ROLL`・`TR_ROLL_SPRING`、ゆっくりうねる `TR_SOAR`、縦の加速で遅れて沈む `TR_DIP`、速く滑ると沈んで止まると浮き上がる `TR_SWOOP`、上がる・下がるときに翼の先ほど遅れてしなる `TR_FLEX`・`TR_FLEX_TIP`、左右に動くときは進む向きへ体を回し、翼を縦の軸のまわりに回して遠近をつける `TR_TURN`・`turnWings`)。顔はドローン君をにらみ(`TR_GAZE`)、撃つ・攻撃するたびにのけぞる(`TR_KICK`)。bosses.js の動きのあとで `pose` が決める。テストでは `finaleTri.fakeT` で曲の時刻を決める。確認ページは `tools/finale-triumph.html`(`#t=秒`・`#film=秒,秒`・`#sim`・`&parry`・`&art`。書き方はファイルの先頭)。協力プレイには対応していない |
| `gunship.js` | ボスの試作「強襲ヘリ・疾風」(種類 `gunship`。雑魚敵の `heli` とは別)。今までのボスと違い画面の外も使う：ホバリング(画面の中を素早く跳び移り、機銃かロケット。ロケットの前に照準)→ 画面の外へ抜けて突撃(通り道の赤い帯で予告 `HELI_LANE_*` のあと一気に横切り、跡に弾を残す。ジャスト衝撃波で弾き返すときりもみ `spin`)・包囲射撃(画面の外をぐるりと回って追尾ミサイル `HELI_ORBIT_*`)・爆撃(画面の上を横切って爆弾 `hbomb`。落ちる所に印)。画面の前後も使う(ヘリが奥行き `z` を持つ。見え方は `shotLab.depthAt` と同じ)：奥からの砲撃と突っ込み(奥へ下がって地平線のあたりを横切りながら砲弾を撃ち込み(`gunship.shells`。着く所に印)、端から正面の姿 `artFront` で突っ込んできて手前へ通り抜ける。着く直前 `HELI_RAM_JUST` に衝撃波を出すと弾き返す：`shotLab.onBlast` を包む。`HELI_FAR_*`・`HELI_SHELL_*`・`HELI_RAM_*`)・手前を横切る(カメラのすぐ前を大きく薄い姿で横切り、手前から撃ち込む。着く所はドローン君の高さに沿って並ぶ。`HELI_NEAR_*`)。奥はほかの敵より後ろ(`drawAttack`)、手前はいちばん手前(`drawFront`)に描く。背景も一緒に動かす(`gunship.bgStep`)：戦いの間は空と街を少し大きく描き(`battleBg.zoom`・`HELI_BG_ZOOM`。遠ざかってもふちが見えないように)、ヘリが奥へ下がる間は遠ざかって暗くなり(`battleBg.far`・`HELI_BG_FAR`)、突っ込んでくるにつれて戻り、着いた・弾き返した瞬間はぐっと寄る(`far` をマイナスに。`HELI_BG_PUNCH`)。奥にいる間は赤い灯りが点滅する(`HELI_BEACON`)。倒すと、煙を吐きながらきりもみで奥の街へ落ち、地平線で爆発して燃える(`gunship.crash`・`wreck`。`special.onKill`・`mainScreen.updateEffects` を包む。`HELI_CRASH_*`)。順番は `HELI_PATTERNS`。画面の外・奥・手前では狙えず当たらない(`phased`・`harmless`)。いる所は画面のふちの印(`gunship.drawFront`)、戦っている間は風の筋(`drawUnder`)と残像で速さを見せる。登場は横から画面を一気に横切り、反対から戻って止まる(`gunship.entrance`)。`makeBoss`・`special.update`/`draw`/`drawAttack`/`parry`・`mainScreen.canCounter`/`bossArrive`/`bossEntrance`/`drawGogogo`・`shotLab.step`/`draw` を包む。デバッグのメニューの「ヘリ(試作)」で WAVE10 の強さで戦う(`bossDebug.gunship` の間は `bossTypeFor` が `gunship` を返す)。ふつうの周には出ない。協力プレイには対応していない |
| `puppeteer.js` | ボスの試作「傀儡師」(種類 `puppeteer`)。捕らえた同胞を糸で操る卑劣な敵(せりふ `PUP_LINES`)。人形(種類 `puppet`。手の操り板から糸で吊られ、振り子で揺れる)は撃っても倒れず、糸の強さ(体力 `PUP_PUPPET_HP`。糸の本数で見せる)を撃ち切ると解放されて味方になる(`puppeteer.free`。`special.revive` を包む)。投げつけてくる人形(構え `wind` → `throw`)はジャスト衝撃波で糸ごと断ち切れる(`mainScreen.canCounter`・`counter` を包む)。人形が吊られている間、傀儡師は盾にしていて撃てない(`phased`)。流れ：第1幕(人形3体)→ 全員解放でよろけて隙(`stun`。`PUP_STAGE_HP` まで削れる)→ 第2幕(4体)→ 隙 → 第3幕(ひとり。糸の斬撃・両手の扇・渦巻き `PUP_SOLO`)→ 体力 `PUP_RALLY_HP` で最後のあがき(`last`)→「衝撃波で合図！」(`mainScreen.blast` を包む。やる気は使わない)で一斉反撃(`rally`。上下の帯「みんな、いくぞ！」、味方とドローン君のビームで体力を0にする)。一斉反撃のほかでは `PUP_FLOOR` より減らない。解放した同胞(`puppeteer.allies`。`enemies` には入れない)はドローン君のまわり(`PUP_ALLY_SLOTS`)で傀儡師(盾の間はまだ操られている人形)を撃ち、近くの敵の弾をかばって消す。苦しむ見せ方はしない(操られている人形は紫の結び目と光だけ)。仮面は幕が進むたびにひびが入る。傀儡師のWAVEは雑魚敵が出ない。デバッグのメニューの「傀儡師(試作)」で WAVE10 の強さで戦う(`bossDebug.puppeteer`)。ふつうの周には出ない。絵は Blender で描いたもの(リアルで不気味に：中身のない破れたビロードのマント、ひびの入った磁器の仮面、長すぎる指の青白い手、古い木の操り板)。`tools/blender/puppeteer.py` で部位ごとに `images/game/puppeteer/`(マント・仮面のひびと口の16通り・左右の手・操り板)へ書き出し、ゲームでは図形の絵と同じ動きで重ねる(`puppeteer.artBaked`・`PUP_ART`。読み込むまでと `#pup2d` のときは図形の絵 `art2d`)。Cuphead・カービィのボスのように大きく見せる：体と仮面は `PUP_SCALE` 倍(マントの下半分は闇に溶けて透ける)、手と操り板は体から離れて `PUP_HAND_SCALE` 倍で、ばね(`PUP_HAND_SPRING`・`PUP_HAND_DAMP`)で大きく動く。攻撃を始めるたびに身を乗り出し(`lean`・`PUP_LEAN_KICK`)、撃たれるとつぶれて戻り(`squash`)、ドローン君が被弾すると高笑いする(`laugh`・`PUP_LAUGH_T`。`mainScreen.damage` を包む)。仮面はドローン君のほうを向く(`PUP_LOOK`)。当たり判定は仮面(`r` 48)。動きは大げさに：攻撃の前はのけぞって縦に伸び(ため `PUP_ANTIC_T`・`PUP_STRETCH`)、一気に大きくなって乗り出し(`PUP_LUNGE`。手もドローン君へ伸びる `PUP_HAND_THRUST`)、ばねで戻る。体は頭の上を支点に振り子のように揺れ(`PUP_BOB`)、高笑いでは跳ねて傾き、手をたたく(`PUP_LAUGH`)。体の変形は `bodyXf`。手の攻撃(`handAttack`・`stepHands`。手の形は手の絵の攻撃のコマ `PUP_POSE`、攻撃に出た手は `PUP_HAND_GROW` 倍に迫る。手が出ている間、操り板 `bars` はその場で揺れる)：叩きつけ(`PUP_SLAM`。床の影と点線で予告、床で漆の玉が跳ねる)・なぎ払い(`PUP_SWEEP`。払う高さの帯で予告)・つまみ取り(`PUP_GRAB`。縮む輪で予告)・指はじき(`PUP_FLICK`)。怒ると両手で(`PUP_RAGE_GAP`)。最後のあがきで「傀儡師も操られていた」と明かす(`PUP_TWIST`・`twist`)。はっきり伝わるよう短いムービーにする(`cine`・`drawCine`。`PUP_TWIST.cine` フレーム)：上下に黒い帯を出して上の表示とボスの体力を隠し、弾を消して戦いを止め、ドローン君も撃たない。傀儡師は画面のまんなかへ引きずり下ろされ(`drop`)、その真上に影の手が操り板を下ろし(赤いふちの黒い影 `shade`・左右の闇に赤い目)、傀儡師の頭と両手に糸が張って、ぎくしゃく動かされる(`puppeted`)。せりふは下の帯に大きく(`lines`。上の闇の声は赤、傀儡師は紫)。ムービーが終わってから一斉反撃の合図ができる。一斉反撃のとどめで影の糸が切れ、影は闇へ退く。確認ページ `tools/puppeteer-art.html` の `#film`(ため・高笑い)・`#film=atk`(手の攻撃)・`#film=act`(幕間と影)でコマ送りを撮れる。見た目の確認は `tools/puppeteer-art.html`(4場面を1枚に。`#only=番号` で1場面)。協力プレイには対応していない |
| `puppetStage.js` | 傀儡師戦の舞台(`puppetStage`)。傀儡師のWAVEの間だけ、戦いの画風と質感を傀儡師にそろえる(`puppetStage.on()`)：背景は Blender で描いた人形劇の舞台(`tools/blender/puppetStage.py` が `images/game/puppeteer/stage.jpg`(奥の書き割り・紙の月・切り抜きの町・上から垂れる操り糸・床)と `frame.png`(緞帳・垂れ幕・脚光)を書き出す。`battleBg.draw` を包み、方眼・光るマスの代わりに描く。奥はドローン君と逆へずらす `STAGE_PARALLAX`)、ドローン君と傀儡師を追うスポットライト(`STAGE_SPOT_*`)と漂うほこり、表示の手前で色調と四すみの暗さ(`STAGE_TONE`・`STAGE_VIGNETTE`)と、表示の下の古い紙の札(`plate`)。敵の弾は、赤(`normal`)を漆塗りの木の玉、オレンジ(`small`)を真ちゅうの鈴にし(`tools/blender/puppetShots.py` が `shots.png` を書き出す。`shotLab.draw` を包む `drawShot`)、後ろに操り糸を引かせる。外に細い明るいふち(`STAGE_SHOT_RIM`)と内に濃いふちを付け、暗い所でも敵の弾がいちばん目立つようにする。表示は芝居の番付風(`drawHud`・`drawBossBar`・`bubble`。`mainScreen.drawHud`・`special.drawBossBar`・`puppeteer.bubble`・`puppeteer.gauge` を包む)：古い紙の札(`card`。大きさごとに一度だけ描いて覚える)・明朝の文字(`STAGE_FONT`。Google Fonts の Shippori Mincho)・耐久は操り糸に通した漆の玉・やる気は真ちゅう枠のゲージ・装備は七宝のメダル・ボスの体力は木の溝に赤いビロードと幕の区切りの金の刻み。自分の装備は、形のある物(ふつうの実弾・ミサイル・地雷・虫)だけ小道具風(`drawArms`。`arms.draw` を包み、その間だけ配列を外して描く)にし、光の物(レーザー・電撃・刃・はね返した弾・追加の装備)はそのまま。ドローン君の見た目は、使い込まれたブリキのからくり人形風(`STAGE_SKIN` = `drone_P.png`。`tools/blender/droneStage.py`。形は標準のまま)に替え、出ると元に戻す(`sync`。`mainScreen.enter`・`page.change` を包む)。操られている同胞も同じシートなので一緒にそろう。幕が進むと(傀儡師の `stage`)緞帳が下りて(`curtain.png`)舞台が替わる(`act`：第2幕「血の月」`stage2.jpg`・第3幕「悪夢」`stage3.jpg`。`puppetStage.py --variant=2/3`・`--curtain`)。下りている間は弾を消し、傀儡師と人形を止め(`puppeteer.hold`)、ドローン君は撃たない(`stepCurtain`・`drawCurtain`・`STAGE_CURTAIN`)。`#pup2d` で前の見た目 |
| `emotion.js` | 感情を形にした攻撃の試作(`emotion`)。デバッグのメニューの「攻撃の試作」の「感情：怒り」「感情：悲しみ」「感情：恐怖」「感情：喜び」で見る(`shotLab` の `list`・`labStep`・`update`・`clear`・`steer`・`step`・`draw`・`drawUnder`・`drawFront`・`drawLab` を包む)。怒り(`emotion.anger`)：煮えたぎる核が鼓動を速めながら熱い破片(弾 `rage`)を荒い狙いで吐き、たまると爆発して全方向へ破片と、予告線のあとジグザグの稲妻(`cracks`)。破片は冷えると遅くなり、黒い灰になって舞い落ちる。画面は赤く焼け、ふちが鼓動で脈打つ。音は鼓動(そのたびに曲を押しつぶす)・半音でにごったうなり・咆哮。悲しみ(`emotion.sorrow`)：大きな雫がドローン君の上へついてきて涙(弾 `tear`)をこぼし(1粒ごとにイ短調の旋律の1音 `SORROW_MELODY`)、ときどきしゃくり上げて上へ放る。涙は下にたまって淵になり(`level`)、淵の中は付いていくのが遅く沈む(`SORROW_HEAVY`・`SORROW_SINK`)。水面に落ちた涙はしずく(弾 `splash`)をはね上げる。画面の色が抜けて青く沈み、曲がこもり(`SORROW_BGM_CUT`)、低い和音が鳴る。恐怖(`emotion.fear`)：画面が暗くなり、ドローン君のまわりの明かり(`light`。だんだん狭まり、ときどきちらつく)だけが見える。暗がりに赤い目(`eyes`)がドローン君の後ろ側(`shotLab.head` の逆)に開き、にらんでから暗い弾(弾 `dread`。だんだん速くなる。闇の中では赤い芯だけ見える)を撃つ。途中で目がいっせいに囲む驚かし(`FEAR_SCARE_*`)。曲はほとんど消え(`FEAR_BGM_CUT`)、うねる低音と高い弦の震え・ささやき・叫び。喜び(`emotion.joy`)：太陽が拍(`JOY_BEAT`)に合わせて跳ね、花びら(弾 `petal`。拍の頭にぴょんと進んでうずを巻く：`emotion.beatPhase`)の輪と、床で弾むたびに音階の音が鳴る玉(弾 `bouncy`)を撒く。色が鮮やかになり、光の筋・紙吹雪・音符。音は太鼓・手拍子・明るい和音(`JOY_CHORDS`)。効果音は `emoSfx`。調整値は `ANGER_*`・`SORROW_*`・`FEAR_*`・`JOY_*`。協力プレイには対応していない |
| `emotionHint.js` | 感情を「暗喩」で表す攻撃の試作(`hint`。`emotion.js` のはっきり見せる試作とは別)。涙・赤・顔のような、ひと目でわかる記号を使わず、動き・間・音の抜け方で表す(遊ぶ人が言われてみれば気付くくらい)。「攻撃の試作」の「暗喩：片割れ」(悲しみ。2つの光のかけ合いから片方が黙って消え、残った方は相方の番に休み、空いた所を回り続ける。`LOSS_*`)・「暗喩：張りつめる」(怒り。撃たれるほど余裕をなくし、丸 → 角ばった弾、輪 → 狙う扇、行き過ぎる動き、曲がわずかに速くなり、限界で吐き出す。本物の敵 `e.hint` で、体力は減らない。`TENSE_*`)・「暗喩：ついてくる」(恐怖。通った道を見えにくい影が遅れてたどり、止まると追いつかれてはじける。撃たない予告線。曲の低音が抜ける：`sound.bgmFilter` を highpass に。`FOLLOW_*`)・「暗喩：かろやか」(喜び。2つ組で回りながら昇る弾、かすると跳ねて「やる気」を置いていく、動きが少し軽い、ほんの少しあたたかい色。`LIGHT_*`)。流れが長いので、一覧で選んだときは `SHOT_LAB_SEC` ごとに切らない(`hint.keep`)。終わると曲の速さ・フィルターを戻す |
| `lib/peerjs.min.js` | PeerJS 1.5.5(外部ライブラリ。MITライセンス、`lib/PEERJS-LICENSE`)。協力プレイの通信に使う。手を加えない |
| `coop.js` | ふたりで協力プレイ(下記「協力プレイ」参照)。対戦も同じ部屋・通信を使う |
| `versus.js` | ふたりで対戦(下記「対戦」参照)。page 7 |
| `draw.js` | 1/60秒刻みの更新ループと描画。最後に読み込む |

録音の曲は `music/` 以下。`tools/music-loop.py`(numpy・ffmpeg)で、元の mp3 からループのつなぎ目をなじませて切り抜き、base64 の mp3 を埋めた JS にする(`fetch` は file:// で使えないため)。大きいので、使うときだけ読み込む(`index.html` では読まない)。今は `music/monarch.js`(Lyria の曲。160 BPM、前奏16小節のあと 48.06～120.06秒の48小節をくり返す)、`music/triumph.js`(Suno の曲。約160 BPM、最後の山 155.91～184.31秒(104～123小節目の頭)をくり返す。後ろに元の曲の終わり(183.31秒～)をそのまま付けてあり(`endAt`・`endFrom`)、`triumph.finish()` で同じ時刻のこちらへ切り替えて最後の和音まで流す。つなぎ目のなじませは0.06秒。`python tools/music-loop.py "Triumph in D Major.mp3" music/triumph.js BGM_TRIUMPH 155.9095 184.3057 0.06 1.0`)、Suno でカバーした戦闘曲 `music/sunoHeroic.js`(序盤。150 BPM、前奏1小節のあと 1.984～65.984秒の40小節をくり返す)・`music/sunoBattle.js`(中盤。138 BPM、前奏1小節のあと 1.8331～29.6592秒の16小節をくり返す)・`music/sunoBoss.js`(ボス戦「Boss Rush Protocol」。前半153.3 BPM・後半は約155 BPM と少し速くなる。前奏8小節のあと、主題3回と展開の 12.770～122.092秒をくり返す。122.09秒で主題が戻ってくる)・`music/sunoRival.js`(ライバル戦「Chronos Duel」。167 BPM から 175 BPM へ少しずつ速くなる(小節の頭は `rival.js` の `RIVAL_SONG_BARS`)。Em-C-D-B の最後の山 149.879～183.031秒(106～130小節目の頭の24小節)をくり返す。`python tools/music-loop.py "Chronos Duel.mp3" music/sunoRival.js BGM_SUNO_RIVAL 149.8790 183.0313 0.06`)・`music/sunoRevolt.js`(人間との戦い「Final Surge」。約145 BPM、前奏のあと 17.8155～59.2109秒の25小節をくり返す。つなぎ目のなじませは0.06秒)・`music/sunoTitle.js`(タイトル「遠景の丘」。約94 BPM、18.2596～137.6066秒をくり返す。0.1秒)・`music/sunoShop.js`(強化画面「无标题曲」。約98 BPM でテンポが揺れ、はっきりした刻みがないので、音色の似かたで 44.1992～161.7792秒を選び、なじませを0.3秒と長めにした)。くり返す範囲は、曲の中で音色(周波数の帯ごとの大きさ)が長く似ている所どうしを総当たりで探して決めた。

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
- セーブは `localStorage`。この周の進み具合は `dronekun_save`(強化画面に入ったときに自動セーブ。倒れる・クリアすると消える)、周をまたいで残るもの(パーツ・能力・見たストーリー・難易度ごとの出撃できるいちばん先のWAVE `game.reach`・最後の装備 `game.kept`)は `dronekun_meta`(`save.writeMeta`・`loadMeta`。タイトルに入るたびに読み直す)、ハイスコア `dronekun_best`・クリア済み `dronekun_cleared`。前の作り(能力はレベル5まで)のセーブは、はじめて読むときに `dronekun_meta` へ移す(能力は `OLD_LEVEL_MAP` で近い強さのレベルに)。
- 周回(ローグライト)：タイトルの「出撃」で難易度(`DIFFICULTIES`。イージー・ノーマル・ハード・ベリーハード、いつでも4つとも選べる)を選び、WAVE1から始める(`startScreen.startRun` → `game.newRun`)。倒れてもパーツ・能力・装備・ショップのバフは残る(`game.keepProgress`・`useKept`。`game.kept` に装備とバフを覚える)。2周目からは強化画面から始まり、その難易度でいちばん先のWAVE(`game.reachOf`)から出撃する。強化画面の「出撃先」・タイトルの「始めるWAVEを選択」(`startScreen.waveSel`。`startRun` に始めるWAVEを渡す)で、難易度ごとにクリア済みのWAVEの次までから選び直せる(協力プレイと同じ窓。`upgradeScreen.js` の `sortieButton`・`drawSortie`)。難易度は敵の体力・弾・WAVEの敵の数・出てくる間隔・撃ち返し・落とすパーツに掛かる(`difficulty()`。協力プレイはホストが選んだ難易度 `coop.diff`、対戦はいつもノーマル)。`game.reset()` は残るものまで全部消す(テスト用)。
- 画面右下のボタン(`sound.js` の `sound.buttons`)：BGM・SEはいつでも、「かすり範囲」「当たり判定」「ポインタ」の表示/非表示は戦闘中だけ出す(`when`。かすり範囲・当たり判定は対戦では出さない)。表示の設定は `common.js` の `viewOpt`(`localStorage` の `dronekun_view`。戦闘画面の方眼・曲の設定もここに覚える)。タッチ操作の衝撃波・回避のボタンは、タイトルの「設定」(タッチ操作のときだけ出る)で右下か左下を選べる(`viewOpt.btnSide`。左下は左右反対の位置 `viewOpt.touchX`)。ポインタを隠すのは戦闘中だけ(メニューでは操作に要るので出す)。
- 全20WAVE(`FINAL_WAVE`)。5WAVEごとにボス(WAVE5・10は女王蜂・移動要塞、WAVE15は天蓋母艦、WAVE20はドローン君改。`bossTypeFor`)。WAVE15(`REVEAL_WAVE`)のボス後に真実が明かされ、WAVE16からは人間の兵器が敵になる。何周もして能力(最大レベル `MAX_LEVEL` = 20)を上げて先へ進む前提なので、WAVEごとの敵の伸びは大きめ(`DANMAKU_*`・`ENEMY_HP_GROW`)、落とすパーツは少なめ(`PARTS_DROP_MUL`)。

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
- (凍結した協力プレイのための古い決まり。新しいコードでは守らなくてよい)敵が「自分のドローン君」を狙う処理は `drone` ではなく `aimAt`(または `nearestPlayer()`)を使う。被弾の判定だけは `drone`(自分)を使う。協力プレイで相方も狙われるため(書き方だけの決まりで手間はかからないので、協力プレイに取り込む前でも守る)。

## 主な調整値の場所

| 内容 | 場所 |
|---|---|
| 能力の値・強化コスト・ショップのバフ | `common.js` の `MAX_LEVEL`・`STATS`(`statValues(レベル1の値, レベル20の値)` で作る。伸び方は `STAT_CURVE`)・`UPGRADE_COST_*`・`BUFFS`・`BUFF_*`(時止めワープのクールタイムは `BUFF_WARP_CD`、演出の時間は `timeStop.js` の `WARP_*`) |
| 難易度・パーツの数 | `common.js` の `DIFFICULTIES`(敵の数は `count`・`extra`)、`mainScreen.js` の `PARTS_DROP_MUL`・`PARTS_REWARD`・`DANMAKU_*`・`ENEMY_HP_GROW`・`WAVE_ENEMY_*`(`waveEnemies()`) |
| 装備の強さ・攻撃間隔・ショップの値段 | `equipment.js` の `WEAPONS`・`SLOT_COST`・`SHOP_*`、水鉄砲は `WATER_*`。説明に出す性能(威力・間隔・速度・射程)は `WEAPON_SPEC`(追加の装備の分は `armsExtra.js`。装備の動きを変えたらここも直す。文字にするのは `weaponSpecText`)。追加の装備は `armsExtra.js` の `WEAPONS` と `FIRE_*`・`BURN_*`・`DISC_*`・`WELL_*`・`BARRIER_*`・`SNIPE_*`・`FREEZE_*`・`ICE_*` |
| シナジーの組み合わせ・色 | `equipment.js` の `SYNERGIES`・`SYN_COLOR`(追加の装備のものは `armsExtra.js`) |
| 敵の種類・弾幕の増え方 | `mainScreen.js` の `ENEMY_TYPES`・`pickEnemyType()`・`danmaku()`・`HIT_CORE`・`GRAZE_RANGE`、敵が出てくる間隔は `SPAWN_*`、虫がときどき狙って撃つのは `BUG_SHOT_*`、虫・突進が倒れるときの撃ち返しは `REVENGE_*` |
| 見た目の格付け(敵の弾をいちばん目立たせる) | `mainScreen.js` の `TIER_*`：自分の装備の濃さ `TIER_ARMS_ALPHA`・演出(爆発・火花など。敵の弾より奥に描く `drawFx`)の濃さ `TIER_FX_ALPHA`・敵の弾の内側のふちどり `TIER_SHOT_EDGE`・`TIER_SHOT_EDGE_W`(見た目の大きさは変えない)。背景を沈める案は、ぼやけて見えたのでやめた |
| 雑魚敵の見た目・色 | `enemyArt.js` の `enemyArt`・`ENEMY_COLOR`、ボスの動きは `QUEEN_*`・`FORT_*`・`KAI_*` |
| 衝撃波・ジャスト衝撃波・ジャスト・カウンター | `mainScreen.js` の `BLAST_*`・`JUST_*`・`COUNTER_*`(ジャストの段階 PERFECT／JUST は `JUST_PERFECT`・`JUST_RAM_PERFECT`・`JUST_GOOD`)、衝撃波に使う「やる気」(動く・かする・ジャスト・敵が落とす「やる気」でたまる)は `YARUKI_*`・`MOVE_MIN`、対戦でのダメージは `versus.js` の `VS_DAMAGE_MUL.blast` |
| 突進の予備動作(パリィの試作) | `mainScreen.js` の `TELL_*`・`pickDashStyle()`(構え方の出やすさ)・`JUST_SHOTS`(弾でもジャストにするか)。動きは `updateDasher`、絵は `enemyArt.dasher` |
| かすりコンボ・かすりバースト(強スキル) | `mainScreen.js` の `GRAZE_*`・`COMBO_*`・`SKILL_*` |
| レア敵・ボス | `bosses.js` の `RARE_*`・`BOSS_EVERY`・`makeBoss()`・`KAI_PATTERNS`、女王蜂の突進の予備動作(構えのばらつき・合図・フェイント・連続突進・弾いたときのダメージ)は `QUEEN_*`、ドローン君改の第二形態(体力・攻撃・突進・復活の長さ)は `KAI2*`、天蓋母艦(体力・砲台・攻撃の順番と長さ・船体の形)は `CANOPY_*` |
| ライバル(中ボス) | `rival.js` の `RIVAL_*`(出てくるWAVE・現れる時期・段階ごとの体力・攻撃の順番 `RIVAL_PATTERNS`・ワープの長さ・せりふ `RIVAL_LINES`)。曲は `sound.js` の `TRACKS.rival` |
| 同胞・人間の兵器 | `forces.js` の `kinRate()`・`pickHuman()` |
| ストーリーの文章・背景・流れる時期 | `story.js` の `STORIES`・`STORY_SKY`・`STORY_AFTER` |
| BGM | `sound.js` の `TRACKS` |
| 戦闘画面の奥の景色(層の流れる速さ・紙の色の濃さ・空ごとの色) | `bgScene.js` の `SCENE_LAYERS`・`SCENE_FLOW`・`SCENE_WASH`・`SCENE_PAL` |
| 戦闘画面の背景(空の薄さ・奥行き・方眼の波) | `battleBg.js` の `BG_*`・`RIPPLE_*`・`GLOW_*`・`CELL_STYLES`・`CELL_STYLE`(光るマスの描き方の候補と、ふだん使うもの。見比べは `tools/bg-glow.html`、ゲームでは `#bgstyle=C` で試せる)・`AURA_*`・`BG_COMBO_COLOR`・`JUST_DIAMOND_R`・`JUST_SPREAD_*`、空の色は `story.js` の `SKY_COLORS` |
| 対戦の耐久・装備ごとのダメージ倍率 | `versus.js` の `VS_HP`・`VS_DAMAGE_MUL` |
| ドローン君の色・振り向き・傾き | `common.js` の `FLAT_COLOR`・`FLAT_YAWS`・`FLAT_ELEVS`・`TURN_*`・`TILT_*` |
| 画面の細かさの上限・重いときに下げる条件 | `common.js` の `RENDER_MAX`・`RENDER_FPS_LOW`・`RENDER_DROP_SEC` |

難易度は「プレイヤーを弱くする方向」と「敵の弾幕を増やす方向」で上げてきた経緯がある。

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
- 表情(`common.js` の `DRONE_FACES`)：ふつう・まばたき・よろこび・本気・あせり・おどろき・いたい・ふらふら。標準の見た目では目の形が変わり(`drawFlatEye`。シートはふつうの顔のままで、表情のついたコマは使ったものだけ `faceFrame` で描いて覚える)、汗・きらきら・「！」・回る星の記号(`DroneLook.drawFaceFx`)はどの見た目でも出る。`DroneLook` の `setMood`(ふだんの顔)・`setFace`(しばらく出す顔。優先 `pri` の高い顔は上書きされない)・`blinks`(まばたき。自分のドローン君だけ)。戦闘ではふだんの顔を `mainScreen.droneMood` が決め(クリアで喜ぶ・耐久が `FACE_LOW_HP` 以下であせる・かすりコンボ中やボス戦は本気)、被弾(いたい／残り1でふらふら)・ジャスト衝撃波とかすりバースト(喜ぶ)・ボスWAVEの始めとライバルの登場(おどろき)で `setFace` する(`FACE_*`)。協力プレイの相方には届かない。見比べは `tools/drone-face.html`(`#still` で止める)。

## 雑魚敵の見た目(enemyArt.js)

- ドローン君(標準)と同じ画風：平らな塗り・濃いふちどり・左上から光が当たるハイライトの線。グラデーションや影のぼかし(`shadowBlur`)は使わない(数が多くても軽く描けるように。1体あたり約10µs)。光るランプのにじみは薄い円を重ねて表す(`halo`)。
- 大きさ・当たり判定(`r`)と色の役割(虫の灰色の羽・突進の赤・回転砲台のオレンジ・人間の兵器のオリーブ)は変えない。被弾したときは胴体を白く塗る(`_body`)。
- (協力プレイは凍結。新しい絵では守らなくてよい)協力プレイのゲストの画面でも同じに見えるよう、絵に使う値はホストから届くもの(`t`・`vx`・`vy`・`face`・`timer`・`spin`・`firing`・`fuse`・`aimX`/`aimY`・`turret`・`flash`)だけにするのが望ましい(あとで協力プレイに取り込むとき楽になる)。新しい値を使ってもよく、`coop.js` の `packEnemy` と受け取り側は、協力プレイへ取り込むときにまとめて直す。
- `tools/enemy-art.html`：雑魚敵を大きく並べ、等倍と状態の違い(被弾・濡れ・EMP・傷)も並べて動かす。`#still` で撮影用に止める。
- 女王蜂(ボス)は Undertale の敵のように、頭・胸・お尻・針・羽・脚・触角・冠を別々に、つけ根を軸に動かす。部位ごとに周期とタイミングをずらし、頭は体の傾きを先取りし、お尻・針・冠・触角は遅れてついてくる。突進の構え(`mode` の `aim`・`count`)で縮こまって震え、突進(`dash`)で羽をたたむ。使う値は `t`・`vx`・`mode`・`count`・`enraged`・`flash`・`fake`(協力プレイのゲストにも届く)だけ。本物の突進の前だけ、最後の `QUEEN_CUE` の間に羽を開き、針の先に星のきらめきを出す(フェイントでは出ない)。突進をジャスト衝撃波で弾かれると `stagger` でよろける(`special.parry`)。
- 移動要塞(ボス)も同じ考え方で、装甲の板8枚(波のように順にふくらむ。渦巻き弾で開いて中の光が見え、輪が半周まわる)・コア(目のように狙う向きを見て、ときどきシャッターが閉じる。レーザーの予告で開いて光る)・主砲(3方向弾の反動・レーザーで伸びる)・左右の砲台(主砲に遅れて揺れ、少し遅れて撃つ)・噴射口3つ(炎がばらばらにゆらぐ)を動かす。使う値は `t`・`vx`・`mode`・`count`・`angle`・`enraged`・`flash`。
- ドローン君改(ボス)は、本体がスキンのシートの絵(1枚に焼き込まれている)なので、絵を上(プロペラ・棒)と下(胴体)に切り抜いて2回描き(`KAI_SPLIT`)、上を遅れて弾ませ、傾きにも遅れてしならせる。まわりに図形の改造部品を足して別々に動かす：左右の副砲(エネルギーの線でつながって浮かび、狙う相手は `nearestPlayer` なのでどちらの画面でも同じ。レーザーの予告で前へ出て光をためる)・背中の装甲の輪とケーブル(出力の段階 `phase` で数が増える。五龍の陣 `circleT` で広がる。ケーブル(`kaiCable`。細い線と先の赤い玉。太くしない・途中で色を変えない)には、ときどき電気が全体を走る(`KAI_CABLE_ZAP`。根元から先へ伸びて消える。節で束ねた筋が何本も絡み、細かい枝・小枝が出る。白い芯に青紫・赤紫の光 `KAI_ZAP_COL`、形は `KAI_ZAP_SHAPE`)。見比べは `tools/kai-cable.html`)・落雷の予告(`strikes`)で副砲から走る稲妻。ブレード・地雷・予告の円は前と同じく `bosses.js` の `drawKaiParts`。
- ドローン君改の第二形態(`bosses.js` の `KAI2*`)：第一形態(体力・攻撃は前のまま。フェーズ1～3)の体力が0になると、`mainScreen.hitEnemy` が `special.revive` を呼び、倒れずにその場で止まる(`mode` の `down`。攻撃が効かず、体当たりもしない `harmless`。ドローン君の装備と衝撃波も止める `special.holdFire`) → 鼓動と始動音で体力が満ち、赤から紫へ色が変わる(`revive`) → 第二形態(`form` 2、体力は第一形態の `KAI2_HP_MUL` 倍、フェーズ4・5、曲は `kai2`)。第二形態は回るレーザー(`beams` 本)・渦巻き弾・弾の雨・続けての突進(ジャスト衝撃波で弾ける。`special.parry`)を足して使う。倒れる・復活の見た目と音は `special.kaiFx` で、届いた `mode` だけで決まる(協力プレイのゲストは `guestCollide` から呼ぶ。`form`・`beams` は `packEnemy` の `b` で届く)。
- 天蓋母艦(WAVE15のボス。`bosses.js` の `CANOPY_*`)：画面の上を端から端まで覆って動かない大ボス。当たり判定はまんなかのコア(`r`)だけで、船体は絵。船体の下のふちの形は `CANOPY_EDGE`(`canopyEdge()` で高さを出す。弾の雨・手下の出る位置と絵で同じものを使う)。
  - 降りきってからは、ドローン君は `CANOPY_FLOOR` より上へ行けない(`special.ceiling()`。`drone.calcXY` で止める。アイテムも下へ出す)。登場は `mainScreen.bossEntrance` で、ほかのボスより上から降りてくる(`special.landY`)。
  - 着地すると、船体の下に砲台(`pod`。別の敵。`makeCanopyPod`)が4つ降りてくる。砲台はドローン君を狙って扇に撃つ(目の前 `CANOPY_POD_NEAR` では撃たない)。壊すとコアに `CANOPY_POD_DMG` のダメージが入り、付け根が壊れた跡になる(`broken`)。コアを倒すと残った砲台も壊れる。
  - コアは 弾の雨(下のふちの口から、動くすき間を残して)→ レーザー(なぎ払い)→ 弾の波(大きな弾の扇)→ 手下(左右のハッチから虫)の順(`CANOPY_PATTERNS`)。
  - 倒すと、船体が傾きながら崩れ落ちて消える(`special.canopyWreck` → `mainScreen.wreck`。演出の数の上限で消えないよう別に持つ)。
  - 船体が上のHUDの後ろに来るので、いる間は左上・右上・ボスの体力ゲージ(上へ寄せる)に明るい板を敷く。
  - 協力プレイ：砲台は種類 `pod`(番号と撃つまでの残りを `packEnemy` の p2 で送る)、壊された砲台の印はボスの状態 `b` の12番目で届く。ゲストの画面では、天蓋母艦がいなくなったときに崩れ落ちる。
  - 絵(`enemyArt.canopy`・`pod`)に使う値は `t`・`mode`・`count`・`angle`・`enraged`・`broken`・`flash`(砲台は `face`・`timer`・`slot`)。`tools/boss-art.html` には入れていない(画面の幅いっぱいなので)。
- `tools/boss-art.html`：ボスの前の絵と新しい絵・怒り・被弾を並べ、下に時間をずらしたコマを並べる(1枚で動きがわかる)。ふだんは女王蜂、`#fortress` で移動要塞、`#kai` でドローン君改。`#still` で撮影用に止める。

## ライバル(中ボス。rival.js)

- 時止めワープを使いこなすライバル「クロノ」(紺色のドローン君に赤いハチマキ。テーマは「分身」と「時を操る」。奥行きのギミックは使わない)。WAVE4・9・14・19(`RIVAL_WAVES`)に現れる。そのWAVEは雑魚敵が出ず(一騎打ち。`mainScreen.enter` で `toSpawn` を0に)、始めてすぐ現れ(`rival.check`)、撃退するとWAVEクリア。登場の演出(`intro`。`RIVAL_INTRO_*`)：時が止まり(周りは止まり、色が抜ける。ドローン君も動かず撃たない：`rival.introStep`・`special.holdFire`)、画面の上から光が集まって組み上がり、上下の黒い帯と名前・せりふで名乗ってから、時が動き出す(少しのあいだドローン君は無敵)。描くのは `rival.drawIntro`(止まった世界の上)・`rival.drawUi`(名前)。会うたびに強くなる(段階 `lv` 0～3。体力・攻撃の種類・ワープの速さ)。曲は `rival`(デバッグのメニューの「戦闘曲」を「Suno」にすると、Suno でカバーした「Chronos Duel」(`sunoRival`)。第二形態は曲の `RIVAL2_SONG_AT` 秒から)。
- 拍(`rival.beat`・`tickBeat`)：曲の拍に合わせて戦う。撃つ・時計の針が進む・止めた弾が動き出す・分身が飛び出すのは拍の上(`onBeat`・半拍は `onHalf`。小節の頭は `downbeat`)。拍は鳴っている曲から読む(`musicBeat`。Suno の曲は小節の頭の表 `RIVAL_SONG_BARS` から(曲が167→175 BPM へ少しずつ速くなるため)、今の曲は `sound.nextTime` から逆算)。曲が鳴っていない(音なし・テスト)ときは `RIVAL_BPM` の拍をフレームで数えるので、テストは毎回同じになる。拍で長さを決めるところは `rival.beatF()`(1拍のフレーム数)。
- 見た目：背中の文字盤(`drawDial`。拍ごとに秒針が1目盛り進み、小節の頭で脈打つ。第二形態は秒針が逆に進み、外に点線の輪)・なびくハチマキ(`scarfStep`・`drawRibbon`。点の列を体の動きの慣性・重さ・はためきで動かす。`SCARF_*`)・突進の合図で結び目に星(`drawGlint`)・時のずれた残像(赤と水色の光の形 `RivalWarp.glow(色)`)。弾は針(種類 `chrono`。細長いひし形。`rival.stepShot`・`drawShot` を `shotLab.step`・`draw` の頭から呼ぶ。止まった針は目盛りの輪を付けてドローン君を指し、動き出す瞬間に輪がはじける)。突進の予告は2本のレールと流れる山形の印(`drawLane`)。時計の針は `drawHand`、文字盤は `drawFace`。時が止まった世界は `drawStopped`・`drawStopWave`、止まっている間は曲もこもる(`rival.muffle` → `sound.timeWarp`)。効果音は `rivalSfx`(時計のカチッ・鐘・巻き戻し)。見た目の確認は `tools/rival-art.html`(場面を並べて撮る。`#close` で体を拡大、`#time` で時を操る攻撃、`#only=番号` で1場面を等倍)。
- 動き：横へ跳ねながら動き回る(`idle`) → ワープ(`warp`。体が粒子にほどけ、別の場所で組み上がる。その間は当たらず狙われない：`harmless`・`phased`。`arms.nearest` は `phased` を飛ばす) → 攻撃(`RIVAL_PATTERNS` の順)。
  - 刻み撃ち(`shoot`。拍ごとに1発、小節の頭は扇)・残響突進(`aim` → `dash`。ジャスト衝撃波で弾ける：`COUNTER_TYPES`・`special.parry` → `rival.parry`。段階が上がるとワープで回り込んで続ける `chain`。Lv.2からは飛び出した場所に残響(分身 `echo`。さっきの自分)が残り、`RIVAL_ECHO_GAP` 拍ずつ遅れて同じ道を突っ込む `rival.echoDash`。出番待ちは `wait`)・時止め(`phantom`。短いワープ `blink` でまわりを跳び、止まった針(`held`)を置く。跳んだ跡は点線でつながる(`marks`) → `hold` の間は周りの色が抜けて時が止まり、隙 → 次の拍で時が動き出し、針がドローン君へ飛ぶ)・時計盤(`clock`。Lv.2から。自分を中心に文字盤を出し、拍ごとに長針が1目盛り進んでその向きへ速さの違う針を1列に撃つ。次に進む所を赤い点線で見せる。本気・Lv.4は反対の向きにも。`RIVAL_CLOCK_*`)。
  - 攻撃の合間に `RIVAL_DODGE` の割合を削られると、ワープでよける。
- 第二形態(WAVE9から。`lv` が `RIVAL2_FROM` 以上。`RIVAL2_*`)：第一形態(強さは `RIVAL_*` のまま)の体力が0になると、倒れずに目覚める(`rival.awaken`。`mode` の `awaken`、`form` 1.5 → 2)。登場と同じく時が止まり(`rival.introStep` → `awakenStep`)、分身が体のまわりを回って重なり、体力が満ちて(第一形態の体力×`RIVAL2_HP_MUL`)、名前「クロノ・ミラージュ」で名乗る。色は紫がかった紺(`RIVAL2_TINT`)。
  - 分身(種類 `chronoClone`。`clone` の印、`owner` が本物の番号)：本物と同じ姿の敵で、少し撃てば消える(`RIVAL2_CLONE_HP`。点・パーツなし。体力ゲージを出さず、ときどきちらつくのが見分ける手がかり)。本物が去る・目覚め直すと消える(`fade`)。動きは `rival.cloneUpdate`、絵は `rival.drawClone`。残響(`echo` の印。「過去の自分」)は、体が薄く、赤と水色にずれた光の形を重ねて描く(`drawEcho`)。
  - 攻撃(`RIVAL2_PATTERNS`)：過去の自分(`echo`。本物が動き回って拍で撃つ間、通った道と撃った向きを `hist` に書き、`RIVAL2_ECHO_DELAY` ずつ遅れた分身(`past`)がそのまま位置でたどって同じ向きへ撃つ `rival.echoReplay`)・鏡像(`mirror`。画面のまんなか(高さ `RIVAL2_MIRROR_CY`)を鏡にして、ドローン君を左右・上下・点対称・90度回した所(`rival.mirrorAt`)へ本物と分身がついていき、拍ごとに1体ずつ順に撃つ。近すぎるときは `RIVAL2_MIRROR_GAP` 離す。鏡の線とドローン君からの点線を描く `drawMirror`。どれが本物かは毎回変わる。前の「分身突進(`cross`)」は、囲んで突撃が十二時の決闘と重なるので取りやめた。分身もジャスト・カウンターで弾けて砕ける `rival.parryClone`)・分身の輪舞(`waltz`。始めたときのドローン君の位置 `wcx`・`wcy` を囲む輪になって回り、輪が縮んでから広がる。拍ごとに1体ずつ順に輪のまんなかへ撃つ。`RIVAL2_WALTZ_*`)・時戻し(`rewind` → `rstop`。画面のまんなか寄りで拍ごとに弾の輪を放ち、時を止めて弾を止め(隙)、次の小節の頭で来た道を逆向きに戻す(残像を引き、画面に巻き戻しの走査線)。弾の印は `rew`。ドローン君(自分)も、最初の輪を放ったときの場所まで、来た道を `RIVAL2_REWIND_PULL` フレームで巻き戻される(通った道は `e.dh`、巻き戻しは `rival.pull`。`drone.calcXY` から `rival.steer`。巻き戻される間は当たらない。止まっている間に戻される先と道すじを見せる `drawRewindPath`)。弾だけが戻ると、ドローン君は遠くへ逃げていて意味がなかったため。`RIVAL2_REWIND_*`)・時止め(跳んだ跡に分身 `stay` が残り、時が動き出すと消える)・時計盤・残響突進。
  - 十二時の決闘(`twelve`。第二形態で本気になると次の攻撃で、そのあとは `RIVAL2_TWELVE_EVERY` の攻撃ごと)：時が止まり、ドローン君を囲む楕円の文字盤(`tw`。`RIVAL2_TWELVE_RX`・`RY`)の十二時へ本物がワープし、半拍ごとに一時～十一時の位置へ分身(`hour`。ローマ数字)を出す。並んだら針が進むたびに(`RIVAL2_TWELVE_STEP` 半拍ごと)その時刻の分身が構えて突っ込み、最後に十二時の本物が長く構えて(`RIVAL2_TWELVE_CUE` 拍)突っ込む(`final`)。本物をジャスト衝撃波で弾き返すと `RIVAL2_TWELVE_DMG` のダメージで長くよろける。
- 時の前借り(第二形態。`RIVAL2_BORROW_*`)：体力が `RIVAL2_BORROW_HP`(半分)を切った次の攻撃の代わりに1度だけ(`borrowDue`・`borrowed`)。その場で `RIVAL2_BORROW_BEATS` 拍止まり(隙)、金色の文字盤の針が速く回って光の粒を吸い込み(`rival.drawBorrow`)、拍の上で力が満ちる(`borrowEnd`)。そのあとの攻撃はすべて強まる：針の速さ×`RIVAL2_BORROW_SPEED`(`rival.borrowK`。分身・連れてきた自分の針も。`stepShot` で初めて動かすときに速くする)・3発以上の扇に `RIVAL2_BORROW_FAN` 発足す(`needles`)・攻撃の合間×`RIVAL2_BORROW_REST`(`restTime`)・拍の裏(半拍)でも撃つ(刻み撃ち・過去の自分・鏡像・輪舞。`rival.halfOn`)。速くなった針は金色で尾を引く(`RIVAL2_BORROW_SHOT`・`RIVAL2_BORROW_TAIL`)。前借りの次の攻撃と、そのあと `RIVAL2_FUTURE_EVERY` の攻撃ごとに「未来の自分」(`future`。前借りのあとだけ)：本物の体から金色の分身(`c.future`)が抜け出して先に動き回り、拍と半拍で撃つ(`futureStep`)。本物は `RIVAL2_FUTURE_DELAY` 拍待ってから、その跡を同じ向きに撃ちながらたどる(`echoReplay`。これから通る道と撃つ所を金色の点線と点で見せる `drawFuture`)。未来の自分を倒すと「未来を断った！」で、本物はそこまでで止まる。体のまわりに金色の光、画面の上に札「時の前借り」。見た目の確認は `tools/rival-art.html#borrow`。
- 時を操る攻撃(`rivalTime.js`。Suno の曲「Chronos Duel」で戦うときに合わせて作った。どれも拍の上で動く)：
  - 時の枷(`shackle`)：ドローン君のまわりに鎖の輪(`rivalTime.rings`)が現れ、拍ごとに1段ずつ縮み(`CT_SHACKLE_TICKS`)、ドローン君を追う(`CT_SHACKLE_FOLLOW`。閉じる直前の1拍は `CT_SHACKLE_LUNGE` 倍の速さで詰め寄る。よけやすすぎたため)。閉じたときに輪の中にいると、`CT_SHACKLE_BEATS` 拍のあいだドローン君の時が遅くなる(`CT_SHACKLE_K`。動きも装備も遅い)。その間クロノは刻み撃ち。
  - 加速世界(`haste`)：ドローン君のほかの敵・弾の時が速くなる(`CT_HASTE_K`。はじめと終わりの1拍でなめらかに)。撃つのは拍の上のままなので、弾の数は増えず速さだけ上がる。
  - 時飛ばし(`skip`)：小節の頭に針の輪を放ち、拍ごとに狙い撃つ。小節の後半(`CT_SKIP_SHOW` 拍前)に1拍先の弾の位置を薄い輪と線で見せ(`preview`)、次の小節の頭で世界を1拍先へ飛ばす(敵と弾を1拍ぶん一気に動かす。飛ばした間に弾の通り道にいると当たる)。
  - 時の裂け目(`rift`)：ドローン君を囲むように裂け目(`rivalTime.rifts`)を開く。過去の裂け目(セピア)は `CT_RIFT_PAST` 拍前にドローン君がいた所(`rivalTime.trail`)、未来の裂け目(水色)はこれから行く所(今の動きの先)を、拍ごとに順に撃つ(弾の印 `b.era` で針の色が変わる)。次に撃つ裂け目から照準の線を引く。
  - 別の時間の自分(`era`。第二形態)：画面の左右に大きな裂け目を開き、`CT_ERA_OPEN` 拍のあと「過去のクロノ」(`CT_ERA_PAST`。初めて会ったときの姿で、セピアのフィルム。刻み撃ち。せりふも初めて会ったときのもの)と「未来のクロノ」(`CT_ERA_FUTURE`。暗い体に水色の傷。時計盤)を連れてくる(分身 `c.era`。体力 `CT_ERA_HP`。撃てば元の時間へ帰る `rivalTime.eraKilled`)。
  - 今かかっている介入は、画面の上に札で出す(`rivalTime.drawUi`)。枷のかかったドローン君は鎖と遅く回る文字盤、加速世界は流れる光の筋、時飛ばしは閃光と走査線(`drawFront`)。
- 第二形態の見た目(強敵らしく)：体を `RIVAL2_SCALE` 倍に大きくし、背中に時計の針の翼(`RIVAL2_WINGS`。拍の頭で跳ね上がり、構え・時が止まっている間は大きく開く `rivalTime.drawWings`)、光る目(`drawEyes`。動くと光の尾を引く。第一形態も弱く光る)、まわりに暗い炎と歯車のかけら(`drawAura`)、長く暗い赤のハチマキ(`RIVAL2_SCARF`・`RIVAL2_SCARF_SEGS`)。同じ姿の分身も同じ見た目(本物と見分けにくくするため)。
- 山場「時ノ奔流」(`over`。`RIVAL_OD_*`。第一形態は本気になった次の攻撃(`odDue`)、第二形態は体力が `RIVAL2_OD_HP` を切った次の攻撃で、それぞれ1度(`odDone`))：画面のまんなかへワープ → 着いたらすぐ加速(前はカットインで時を止めていたが、取りやめた。`RIVAL_OD_ACCEL` 拍。時の速さ `rival.timeK` が `RIVAL_OD_KMAX` まで上がり、飛んでいる針が速くなる(`stepShot` で足す)。ドローン君の時は少し遅くなる(取り残される。`CT_OD_DRONE_K`)。渦に撃つ間が拍 → 半拍 → 16分と細かくなる。大きな文字盤の針が速く回り、昼と夜が入れかわるようにちらつく) → 針の裁き(`RIVAL_OD_JUDGE` 拍。画面全体を文字盤にして、光の長針が拍ごとに1目盛り、Lv.2からは短針も2拍ごとに逆へ1目盛り、通り道をなぎ払う(前のコマからの角度の間で当たりを見る `beamHit`)。次になぎ払う所を扇形に見せ、はじめの1拍は予告で当たらない。`drawBeam`) → 時が巻き戻る(`snap`。加速で撃った針(`ov.fired`)が、画面から出ていった所に現れて、来た道を逆にまんなかへ戻り、手前で消える(`b.die`)) → 疲れて長い隙(`RIVAL_OD_TIRED`。よろける)。
  - 迎撃(WAVE14から。`RIVAL2_INTERCEPT_*`)：第二形態の本物は、近づいたドローン君の飛んでいく弾を撃ち落とす(`shotLab.js` の迎撃 `e.intercept` を使う。`per`・`range` で数と範囲、`quiet` で範囲の輪と砲身を描かず、撃ち落とす紫の線だけ出す)。ワープ中など `harmless` の間と分身はしない。
  - 協力プレイ：分身は `packEnemy` の p1(突進の向き)・p2(動き＋残り×32)で届く。`form` はボスの状態 `b` の9番目。新しい攻撃の動き(`clock`・`echo`・`mirror`・`twelve`・`over`・`wait`)と針の動き出す印・時戻しの巻き戻しなどは、まだ協力プレイに取り込んでいない(`COOP_MODES` にない)。協力プレイは凍結したので、取り込まない。
- 体力が0になっても倒れない(`special.revive` → `rival.retreat`。第二形態があるときは第二形態を倒したとき)：捨てぜりふを残してほどけて消える(撃退。報酬カプセル・パーツ・スコア)。せりふは吹き出しで出す(`RIVAL_LINES`。現れたとき・本気になったとき・去るとき)。
- ボスと同じ `boss` の印を持つ(衝撃波で飛ばされない・凍らない・上の体力ゲージ「RIVAL」)。`mid` の印で中ボスと見分ける。種類は `chrono`(`rival` は対戦の相手の印なので使わない)。
- 協力プレイ：ホストが動かす。ワープの出発点・長さはボスの状態 `b` の12～14番目で届き、ゲストは `rival.guestInit`・`rival.flags` で同じ見た目と当たり方にする。ワープの粒子・せりふ・残像は、届いた `mode`・`count` から描画のたびに決める(`rival.watch`)。

## 開発用の機能

- **デバッグのメニューの入口は専用のリンクだけ**(キーボードの操作はない)。URL に `#debug` を付けて開く(`…/dronekun/#debug`、手元なら `index.html#debug`)と、タイトルの「設定」の左に「DEBUG」ボタンが出る(`bossDebug.js` の `debugUrl()`)。スマホでも同じ。セーブ・ハイスコア・見たストーリーの記録は変えない(始める前の状態に戻す)。
  - ボス戦：WAVE5/10/15/20のボスをすぐ始める。「装備」で強さ(弱い/標準/最強)、「無敵」で被弾しない。
  - ライバル戦：「ライバル W4/W9/W14/W19」で、そのWAVEのライバル(中ボス。`rival.js`)とすぐ戦う(雑魚敵なし。`bossDebug.rival`)。
  - 「改・第二形態」：WAVE20を始め、第一形態が戦い始めたらすぐ復活して第二形態になる(`bossDebug.kai2`。最終局面の試作を試すため)。
  - 「ヘリ(試作)」：ボスの試作「強襲ヘリ」(`gunship.js`)と WAVE10 の強さで戦う(`bossDebug.gunship`)。
  - 「傀儡師(試作)」：ボスの試作「傀儡師」(`puppeteer.js`)と WAVE10 の強さで戦う(`bossDebug.puppeteer`)。
  - 武器試用：装備を3つまで選び(押した順に装備枠へ)、装備のレベル・能力のレベル・敵の強さ(`TRIAL_WAVES` のWAVEの雑魚敵)を決めて戦う。敵は尽きずに出続け(`TRIAL_MAX_ENEMIES` 体まで)、いつも無敵。画面上に直近 `TRIAL_DPS_SEC` 秒の毎秒ダメージと撃破数、戻ると始めからの平均を出す(`mainScreen.hitEnemy` から `bossDebug.dealt` で数える)。
  - 時止めワープ「オン」(ショップのバフと同じ能力。`timeStop.js`)：クールタイムなしで、ボス戦・武器試用で、被弾する瞬間に時が止まり(ダメージなし)、クリック・タップした場所へ、体が粒子にほどけて飛び、組み上がる。そのあと `WARP_GUARD` の間は無敵。協力プレイ・対戦では働かない。粒子はドローン君の今のコマを別のキャンバスに写して小さく切って描く(`getImageData` は使わない)。
  - 攻撃の試作：画面の上の砲台が、試作の弾・攻撃(`shotLab.js`)を `SHOT_LAB_SEC` 秒ずつ順に出す。左の一覧を押すと、その攻撃だけを繰り返す(「自動で順番に」で戻る。`shotLab.labPickAt`)(雑魚敵なし・無敵。弾の速さ・数は `SHOT_LAB_WAVE` のもの)。
  - BGM「今の音／本格版／案D／案F／案H／案I」・最終局面「今の曲／原点回帰／Lyria／Suno」・戦闘曲「今の曲／Suno」(`bgmTrial.js`。Lyria・Suno は選んだときに `music/monarch.js`・`music/triumph.js`・`music/sunoHeroic.js`・`sunoBattle.js`・`sunoBoss.js`・`sunoRival.js`・`sunoRevolt.js`・`sunoTitle.js`・`sunoShop.js` を読み込む。最終局面の Suno の動きは `finaleTriumph.js`。「改・第二形態」と組み合わせると、すぐ試せる)：押すとすぐ、流れている曲がその案で鳴り直す。このあと遊ぶ曲(タイトルから始めるふつうの周も)もその案で鳴る。
  - 途中でメニューへ戻るのは、右下の「DEBUG：戻る」(`sound.buttons` の `debugBack`)。
- `common.js` の `DEBUG = true` で、マウス座標などを左上に表示。
- 画面上部の中央に、フレームレート(1秒あたりの描画回数)を常に表示している(`draw.js` の `fps`)。`FPS_WARN` 未満でオレンジ、`FPS_BAD` 未満で赤。

## 協力プレイ・対戦は凍結(2026-10-17〜)

**協力プレイ(`coop.js`)と対戦(`versus.js`)は、開発とテストの対象にしない。** 機能とコードは消さずに残す(遊んでいる人はいない。廃止するかはあとで決める)。最後に確かめた版は公開版 v2026.10.17.3。
- 協力プレイ・対戦の機能は足さない・直さない。ひとり用の変更で壊れても、直さなくてよく、知らせなくてもよい(ユーザーに指示されたときだけ触る)。
- ひとり用に新しい敵・ボス・攻撃・演出を足しても、協力プレイ・対戦向けの対応(`packEnemy` と受け取り側・ゲストの見た目・`coop.isGuest()` などの分かれ道・`aimAt` で狙う決まり)はしなくてよい。
- `tools/run-smoke.ps1` は `smoke-test.html` だけを流す(公開の `release.ps1` も同じ)。`coop-test.html` は `-Coop` を付けたときだけ流し、落ちても気にしない。`smoke-test.html` にも協力プレイ・対戦の確認項目は足さない。
- 以下の「協力プレイ」「対戦」の説明は、凍結した時点の作りの記録。

## 協力プレイ(coop.js)

- ホストが敵・弾・アイテムを動かし、状態を約30回/秒でゲストへ送る。ゲストは自分のドローン君と武器を自分の画面で動かし、与えたダメージ・拾ったアイテム・衝撃波を「合計値」で送り返す。被弾判定はそれぞれが自分について行う。
- 送る量は1回 `COOP_LIMIT`(12000バイト)以内。超えるときはゲストから遠いものから削る。
- 敵の状態：減速(EMP)・濡れ(水鉄砲)・燃える(火炎放射)・凍る(冷凍)は、ゲストが付けた回数をダメージと一緒に送り(`guestHit` の `dm`)、ホストが自分の敵に付ける。ホストからは状態の印を送る(`packEnemy` の `flags`)。燃えて削れる分と、凍った敵への2倍はホストだけで数える。ゲストの重力弾の渦は、相方の武器の見た目(`armsSummary`)で届いた位置でホストが敵を吸い寄せる。ゲストのバリアが防いだ弾は、防いだ位置を送り(`br`)、ホストがいちばん近い弾を消す。
- ジャスト衝撃波(`mainScreen.justBlast`)：ひとり用は画面のすべてをゆっくりにするが、協力プレイでは画面がずれないよう、出来事(`addEvent` の3)で相方に知らせ、敵と弾を動かしているホストが `slowmo` でゆっくりにする(`JUST_COOP_SLOW`)。
- ジャスト・カウンター(`mainScreen.counter`)：ぶつかる直前の突進・人間のドローン(`COUNTER_TYPES`)をジャスト衝撃波で弾き返す。ゲストは出来事の4(敵の番号)で知らせ、ホストが弾き返す。弾き返した突進は状態の印(`flags` の64)で届き、ゲストには当たらない。
- 協力プレイの難易度は、ホストが部屋を作る前に部屋選びの画面で選ぶ(`coop.diff`)。ホストの状態(`buildHost` の `d`)でゲストに届き、ゲストも同じ難易度になる。
- 協力プレイ中は敵の体力2倍(`COOP_HP_MUL`。難易度の倍率に掛ける)、強化・装備は各自。この周の進み具合はセーブしない(コンティニュー用にメモリにだけ覚える)。能力・パーツ・最後の装備・難易度ごとの進み具合は、ひとり用とは別に協力プレイ用として周をまたいで残す(`localStorage` の `dronekun_coop`。`save.metaKey()` が協力プレイ中はこちらを返し、`writeMeta`・`loadMeta` が読み書きする。はじめてならレベル1・パーツ0から)。強化画面に入ったとき・ゲームオーバー・エンディング・抜けたときに書く。
- 拾ったパーツはふたりとも受け取る。自分が拾った数の合計(`partsGot`)を送り合い、増えた分を足す(`shareParts`)。報酬カプセル・やる気は拾った人だけ。
- コンティニュー：強化画面で `save.write` が呼ばれると、協力プレイ中はセーブの代わりに `coop.checkpoint` に覚える。ふたりとも撃墜されたらゲームオーバー画面でコンティニューを押せて、ふたりとも押すと(相方がいなければすぐ)ホストが `checkpoint` に戻して強化画面へ。ゲストはホストが強化画面へ戻ったのを見てついていく(`continueGame`)。
- 出撃先：ひとり用と同じく、ホストは強化画面の「出撃先」で、難易度ごとにクリア済みのWAVEの次まで(ホストの協力プレイ用の記録 `game.reachOf`)と難易度を選べる(`coop.playWave`・`coop.diff`。`buildHost` の `pw`・`d` でゲストも合わせる)。はじめはその難易度のいちばん先のWAVE(`startGame`)。出撃する直前に、ふたりとも `game.wave` を選んだWAVEにし(`beginBattle`。コンティニューもそのWAVEから)、そこから進む。`playWave` はクリアで0(今の進み具合)に戻す(`mainScreen` の `clear`。ゲストがホストの出撃に気付くとき、同じWAVEかを `pw` で確かめるため、出撃してもすぐには戻さない)。
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
