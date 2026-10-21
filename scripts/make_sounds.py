"""効果音を合成してWAVで書き出す（お試し版のWebAudioと同じ音）。
python3 scripts/make_sounds.py で assets/sounds/*.wav を作り直せる。"""
import math, random, struct, wave, os

SR = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')
random.seed(7)

def blank(sec):
    return [0.0] * int(SR * sec)

def add_tone(buf, freq, dur, kind='sine', vol=0.2, slide=0, delay=0):
    start, n = int(SR * delay), int(SR * dur)
    phase = 0.0
    for i in range(n):
        t = i / n
        f = freq * ((slide / freq) ** t) if slide else freq
        phase += 2 * math.pi * f / SR
        if kind == 'sine': v = math.sin(phase)
        elif kind == 'square': v = 1.0 if math.sin(phase) >= 0 else -1.0
        elif kind == 'triangle': v = 2 / math.pi * math.asin(math.sin(phase))
        else: v = 2 * ((phase / (2 * math.pi)) % 1) - 1  # saw
        env = vol * (0.0001 / vol) ** t  # exponential decay like the web version
        if start + i < len(buf): buf[start + i] += v * env

def add_noise(buf, dur, vol=0.3, cutoff=2000, delay=0):
    start, n = int(SR * delay), int(SR * dur)
    a = 1 - math.exp(-2 * math.pi * cutoff / SR)  # one-pole lowpass
    y = 0.0
    for i in range(n):
        y += a * ((random.random() * 2 - 1) - y)
        if start + i < len(buf): buf[start + i] += y * vol * (1 - i / n)

def save(name, buf, norm=0):
    """norm を指定したら、その大きさまで持ち上げる（追加の音はWeb版と同じ小さめの値で作ってるので）"""
    peak = max(1e-6, max(abs(x) for x in buf))
    scale = norm / peak if norm else min(1.0, 0.9 / peak)
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, x * scale)) * 32767)) for x in buf))

b = blank(0.15); add_noise(b, .09, .5, 3500); add_tone(b, 420, .07, 'triangle', .12, 700, .02); save('flip', b)
b = blank(0.04); add_tone(b, 1500, .025, 'square', .2); save('tick', b)
b = blank(0.3); add_tone(b, 1320, .07, 'square', .2); add_tone(b, 1760, .16, 'square', .2, 0, .08); save('coin', b)
b = blank(0.25); add_tone(b, 500, .09, 'sine', .5, 1100); add_tone(b, 900, .12, 'sine', .4, 1500, .09); save('pop', b)
b = blank(0.55); [add_tone(b, 880, .12, 'square', .25, 0, d) for d in (0, .18, .36)]; save('alarm', b)
b = blank(1.2); add_noise(b, 1.1, .9, 700); add_tone(b, 90, .8, 'sine', .8, 35); save('boom', b)
b = blank(0.35); add_tone(b, 660, .12, 'saw', .25); add_tone(b, 440, .18, 'saw', .25, 0, .12); save('warn', b)
b = blank(0.9); [add_tone(b, f, .45 if i == 3 else .13, 'triangle', .4, 0, i * .12) for i, f in enumerate((523, 659, 784, 1047))]; save('fanfare', b)
b = blank(0.5); [add_tone(b, f, .18, 'sine', .35, 0, i * .07) for i, f in enumerate((784, 988, 1175, 1568))]; save('lucky', b)
# 罰ガチャ（約1秒）：ガラガラ → コロン（カプセルが出る）→ パカッ（割れる）→ ドン／キラキラ
GT = 1.0
def rattle(buf, T):
    t, k = 0.0, 0
    while t < T:
        add_tone(buf, 1250 if k % 2 else 980, .03, 'square', .18, 0, t); t += .07 + k * .006; k += 1
b = blank(GT + 0.4); rattle(b, .5); add_tone(b, 700, .06, 'triangle', .3, 400, .45); add_noise(b, .08, .7, 4000, .76); add_tone(b, 1200, .05, 'square', .15, 0, .76)
add_noise(b, .25, .8, 900, GT); add_tone(b, 140, .35, 'sine', .7, 60, GT); save('gacha', b)
b = blank(GT + 0.4); rattle(b, .5); add_tone(b, 700, .06, 'triangle', .3, 400, .45); add_noise(b, .08, .6, 5000, .76)
[add_tone(b, f, .18, 'sine', .35, 0, .8 + i * .07) for i, f in enumerate((784, 988, 1175, 1568))]; save('gachaLucky', b)
# 結果発表のドラムロール（2.4秒）→ ジャーン
DT = 2.4
b = blank(DT + 1.0); t = 0.0
while t < DT:
    add_noise(b, .05, .25 + .35 * (t / DT), 1400, t); t += .055
[add_tone(b, f, .55 if i == 3 else .13, 'triangle', .4, 0, DT + i * .1) for i, f in enumerate((523, 659, 784, 1047))]; add_noise(b, .5, .5, 5000, DT + .3); save('drumroll', b)
# 残り10秒のカチッ
b = blank(0.06); add_tone(b, 1800, .04, 'square', .3); save('hurry', b)

# ===== 追加の効果音（Web版 views.js の SFX と同じ作り）=====
def add_voice(buf, freq, dur, kind='saw', vol=0.1, delay=0, att=0.02, cut=1200, bp=False, q=1, vib=0, rate=5.5, slide=0):
    """ふわっと立ち上がる声っぽい音（フィルター＋ゆらぎ）"""
    start, n = int(SR * delay), int(SR * dur)
    w0 = 2 * math.pi * cut / SR; alpha = math.sin(w0) / (2 * q); cw = math.cos(w0)
    if bp: b0, b1, b2 = alpha, 0, -alpha
    else: b0, b1, b2 = (1 - cw) / 2, 1 - cw, (1 - cw) / 2
    a0, a1, a2 = 1 + alpha, -2 * cw, 1 - alpha
    b0, b1, b2, a1, a2 = b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0
    x1 = x2 = y1 = y2 = 0.0; phase = 0.0
    for i in range(n):
        t = i / n; sec = i / SR
        f = freq * ((slide / freq) ** t) if slide else freq
        if vib: f += vib * math.sin(2 * math.pi * rate * sec)
        phase += 2 * math.pi * f / SR
        if kind == 'sine': x = math.sin(phase)
        elif kind == 'square': x = 1.0 if math.sin(phase) >= 0 else -1.0
        elif kind == 'triangle': x = 2 / math.pi * math.asin(math.sin(phase))
        else: x = 2 * ((phase / (2 * math.pi)) % 1) - 1
        y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, x, y1, y
        env = vol * (sec / att) if sec < att else vol * (0.0001 / vol) ** ((sec - att) / max(1e-6, dur - att))
        if start + i < len(buf): buf[start + i] += y * env

def seeded(n):
    x = [n]
    def r():
        x[0] = (x[0] * 16807) % 2147483647
        return x[0] / 2147483647
    return r

# お題が出る「ジャン！」3種類
b = blank(0.4); add_noise(b, .12, .3, 6000); [add_tone(b, f, .2, 'square', .05) for f in (523, 659, 784)]; add_tone(b, 1047, .32, 'triangle', .13, 0, .04); save('jan1', b, 0.8)
b = blank(0.8); add_noise(b, .22, .16, 2600); add_tone(b, 300, .2, 'sine', .12, 1200); add_tone(b, 1568, .55, 'sine', .14, 0, .19); add_tone(b, 2093, .4, 'sine', .06, 0, .19); save('jan2', b, 0.8)
b = blank(0.5); [add_tone(b, f, .32 if i == 3 else .09, 'triangle', .13, 0, i * .05) for i, f in enumerate((659, 784, 988, 1319))]; save('jan3', b, 0.8)
# 罰：ワワワワーン／チーン
b = blank(2.0); [add_voice(b, f, .3, 'saw', .12, i * .3, .03, 1400) for i, f in enumerate((392, 370, 349))]; add_voice(b, 330, 1.0, 'saw', .12, .9, .03, 1400, vib=9, rate=6, slide=300); save('sad', b, 0.8)
b = blank(1.5); add_tone(b, 2093, 1.4, 'sine', .2); add_tone(b, 2093 * 2.76, .6, 'sine', .05); add_tone(b, 1046, 1.2, 'sine', .05); save('chin', b, 0.8)
# ラッキー：キラキラ＋天使の「ア〜」
b = blank(1.7); r = seeded(11)
for k in range(9): add_tone(b, 2000 + r() * 2200, .14, 'sine', .06, 0, k * .06)
[add_voice(b, f, 1.5, 'triangle', .05, .1, .35, 3000, vib=5, rate=5) for f in (523, 659, 784, 1047)]; save('kira', b, 0.8)
# すごろく
b = blank(0.05); add_noise(b, .03, .25, 3500); add_tone(b, 480, .03, 'triangle', .08); save('clack', b, 0.4)
b = blank(0.09); add_tone(b, 620, .07, 'triangle', .16); add_tone(b, 310, .06, 'sine', .14); save('step', b, 0.6)
b = blank(0.28); add_tone(b, 880, .09, 'sine', .2, 1320); add_tone(b, 1320, .18, 'sine', .1, 0, .07); save('land', b, 0.8)
# 正解・ハズレ・時間切れ
b = blank(1.2); add_tone(b, 1319, .5, 'sine', .2); add_tone(b, 1047, .85, 'sine', .2, 0, .28); save('pinpon', b, 0.8)
b = blank(0.75)
for i, d in enumerate((0, .24)):
    add_tone(b, 140, .45 if i else .17, 'square', .07, 0, d); add_tone(b, 143, .45 if i else .17, 'saw', .05, 0, d)
save('buzzer', b, 0.8)
b = blank(1.05); add_voice(b, 110, 1.0, 'saw', .16, 0, .01, 1800); add_voice(b, 113, 1.0, 'square', .1, 0, .01, 1500); save('timeup', b, 0.8)
# 爆弾のチクタク・心臓
b = blank(0.04); add_tone(b, 2300, .02, 'square', .05); add_noise(b, .015, .12, 7000); save('tik', b, 0.45)
b = blank(0.05); add_tone(b, 1500, .03, 'square', .05); add_noise(b, .02, .12, 4000); save('tok', b, 0.45)
b = blank(0.4); add_tone(b, 72, .13, 'sine', .7, 45); add_tone(b, 66, .16, 'sine', .5, 40, .19); save('heart', b, 0.9)
# 結果発表：ブーイングと笑い声
b = blank(1.5); r = seeded(5)
for k in range(7):
    f = 105 + r() * 60; d = r() * .12; rt = 3 + r() * 3; sl = 90 + r() * 30
    add_voice(b, f, 1.3, 'saw', .06, d, .18, 650, vib=4, rate=rt, slide=sl)
add_noise(b, 1.2, .12, 500); save('boo', b, 0.75)
b = blank(1.3); r = seeded(9)
for v in range(4):
    base = 210 + r() * 120; off = v * .05 + r() * .08; d = off
    for k in range(6):
        d = off + k * (.12 + r() * .03)
        add_voice(b, base * (1 - k * .025), .09, 'saw', .09, d, .01, 950, bp=True, q=2.2); add_noise(b, .06, .05, 2500, d)
save('laugh', b, 0.75)
# 連続罰の「ボウッ」
b = blank(0.85); add_noise(b, .6, .35, 1800); add_voice(b, 180, .55, 'saw', .1, 0, .05, 2000, slide=520); add_tone(b, 80, .45, 'sine', .45, 40, .32); save('streak', b, 0.8)
print('ok')
