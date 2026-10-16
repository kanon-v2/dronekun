# 録音した曲(mp3 など)を、ゲームでループして流せる JS ファイルにする(開発用)
#   python tools/music-loop.py <元の曲> <出力.js> <変数名> <ループの始まり(秒)> <ループの終わり(秒)>
#   例：python tools/music-loop.py The_Monarch_s_Last_Stand.mp3 music/monarch.js BGM_MONARCH 48.06 120.06
#   つなぎ目のなじませ(秒)と、終わりを付ける(下)ときは続けて：... <なじませ(秒)> <終わりの前に足す長さ(秒)>
#   例：python tools/music-loop.py "Triumph in D Major.mp3" music/triumph.js BGM_TRIUMPH 155.9095 184.3057 0.06 1.0
# - 終わりを付けると、くり返しのあとに、元の曲の(ループの終わり - 足す長さ)から最後までをそのまま足す(endAt。くり返しを抜けて
#   曲を終わらせるときに、同じ時刻のこちらへ切り替える。切り替える所はなじませていないので、元の曲のまま聞こえる)
# - ループの終わりの手前 XFADE 秒を、ループの始まりの手前の音へなめらかに移し、そのあとに始まりの続きを少し足す
#   (デコーダーが頭に無音を足して全体が少しずれても、つなぎ目で音が切れないように)
# - mp3 にして base64 で JS に埋める(index.html を file:// で直接開いても読めるように。fetch は file:// で使えない)
# - 要るもの：numpy、ffmpeg(PATH にないときは環境変数 FFMPEG にフルパス)
import sys, os, subprocess, base64, tempfile
import numpy as np

XFADE = float(sys.argv[6]) if len(sys.argv) > 6 else 0.3   # つなぎ目のなじませ(秒)
PRE = float(sys.argv[7]) if len(sys.argv) > 7 else None     # 終わりを付けるとき、ループの終わりの何秒前から足すか
TAIL = 1.0        # ループの終わりのあとに足す、始まりの続き(秒)
BITRATE = "160k"  # mp3 の音質
SR = 44100

src, dst, name, a_sec, b_sec = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4]), float(sys.argv[5])
ff = os.environ.get("FFMPEG", "ffmpeg")
raw = subprocess.run([ff, "-v", "error", "-i", src, "-ac", "2", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype=np.int16).reshape(-1, 2).astype(np.float32) / 32768
a, b, n = int(round(a_sec*SR)), int(round(b_sec*SR)), int(XFADE*SR)
w = np.linspace(0, 1, n)[:, None]
mix = x[b-n:b]*np.sqrt(1 - w) + x[a-n:a]*np.sqrt(w)   # 同じ大きさのまま移る
y = np.concatenate([x[:b-n], mix, x[a:a+int(TAIL*SR)]])
end_at = None
if PRE is not None:
    end_at = len(y)/SR      # 足した終わりの頭(元の曲の b - PRE 秒にあたる)
    y = np.concatenate([y, x[b-int(round(PRE*SR)):]])
y = np.clip(y, -1, 1)
tmp = tempfile.mkdtemp()
wav = os.path.join(tmp, "loop.raw"); mp3 = os.path.join(tmp, "loop.mp3")
(y*32767).astype(np.int16).tofile(wav)
subprocess.run([ff, "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", wav, "-b:a", BITRATE, mp3], check=True)
data = base64.b64encode(open(mp3, "rb").read()).decode()
with open(dst, "w", encoding="utf-8", newline="\n") as f:
    f.write("//%s をループ用に切り抜いたもの(tools/music-loop.py で作った。手で直さない)\n" % os.path.basename(src))
    extra = "" if end_at is None else " endAt:%.4f, endFrom:%.4f," % (end_at, b/SR - PRE)
    f.write("var %s = { loopStart:%.4f, loopEnd:%.4f,%s mp3:\"%s\" };\n" % (name, a/SR, b/SR, extra, data))
print("ok", dst, len(data)//1024, "KB", "rms", float(np.sqrt(np.mean(x[a:b]**2))))
