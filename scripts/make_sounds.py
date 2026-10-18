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

def save(name, buf):
    peak = max(1e-6, max(abs(x) for x in buf))
    scale = min(1.0, 0.9 / peak)
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
# 罰ガチャのガラガラ（1.4秒、だんだんゆっくり）→ ドン
GT = 1.4
b = blank(GT + 0.5); t, k = 0.0, 0
while t < GT - 0.15:
    add_tone(b, 1250 if k % 2 else 980, .03, 'square', .18, 0, t); t += .07 + k * .006; k += 1
add_noise(b, .25, .8, 900, GT); add_tone(b, 140, .35, 'sine', .7, 60, GT); add_tone(b, 500, .09, 'sine', .4, 1100, GT + .25); save('gacha', b)
b = blank(GT + 0.5); t, k = 0.0, 0
while t < GT - 0.15:
    add_tone(b, 1250 if k % 2 else 980, .03, 'square', .18, 0, t); t += .07 + k * .006; k += 1
[add_tone(b, f, .18, 'sine', .35, 0, GT + i * .07) for i, f in enumerate((784, 988, 1175, 1568))]; save('gachaLucky', b)
# 結果発表のドラムロール（2.4秒）→ ジャーン
DT = 2.4
b = blank(DT + 1.0); t = 0.0
while t < DT:
    add_noise(b, .05, .25 + .35 * (t / DT), 1400, t); t += .055
[add_tone(b, f, .55 if i == 3 else .13, 'triangle', .4, 0, DT + i * .1) for i, f in enumerate((523, 659, 784, 1047))]; add_noise(b, .5, .5, 5000, DT + .3); save('drumroll', b)
# 残り10秒のカチッ
b = blank(0.06); add_tone(b, 1800, .04, 'square', .3); save('hurry', b)
print('ok')
