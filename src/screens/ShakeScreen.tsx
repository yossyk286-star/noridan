import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Animated, StyleSheet, Text, Vibration, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { DeviceMotion } from 'expo-sensors';
import { BigButton, Frame, GachaCard, RulesSheet, ScoreBar, DeckStack } from '../components/Stage';
import { HandWho, IntroCard, LevelBox, ModeCard, Note, Prog } from '../components/ModeParts';
import { Icon } from '../components/Icon';
import { HELP } from '../lib/help';
import GameMenu from '../components/GameMenu';
import { Decks } from '../lib/game';
import { play } from '../lib/sound';
import { newStats, type Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, alpha, colorOf } from '../theme';
import type { GachaItem, Level, Member, Night } from '../types';

type Props = {
  members: Member[];
  level: Level;
  night: Night;
  onQuit: () => void;
  onSettings: () => void;
  onFinish: (pen: number[], turns: number, stats: Stats) => void;
  skipIntro?: boolean;
};
type Phase = 'intro' | 'hand' | 'count' | 'play' | 'done' | 'rank' | 'batsu';

const SEC = 10;
/** m/s²（重力ぬき）。これより強い揺れだけ数える */
const HI = 10;
/** ms。これより短い間隔は同じ1回 */
const GAP = 70;

/** 注意書き（毎回の番で出す） */
function Safety({ fg }: { fg: string }) {
  return (
    <View style={s.safe}>
      <Text style={s.safeTitle}>⚠ スマホが飛ばんように</Text>
      <Text style={[s.safeText, { color: fg }]}>ガッチリ握る（ストラップは手首に）・周りの人やグラスから離れる・濡れた手はNG・手は絶対に離さへん</Text>
    </View>
  );
}

/**
 * 全力シェイク：1人ずつ10秒間スマホを振って、振った回数を数える。全員振ったら一番少ない人が罰（地獄は2倍）。
 * 縦・横・前後どの向きでもOK。強い加速度の向きが切り返すのを見て、1往復（振り下ろして戻す）で1回。
 * 激しく振ると加速度が下がりきらへんので、強さが落ちるのを待たんと向きで数える。センサーが無いスマホは画面の連打
 */
export default function ShakeScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const n = members.length;
  const decks = useRef(new Decks()).current;
  decks.night = night;
  decks.level = level;
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(1);
  const [k, setK] = useState(0); // この回戦の何人目か
  const who = (k + round - 1) % n; // 毎回スタートの人をずらす
  const [count, setCount] = useState(3);
  const [left, setLeft] = useState(SEC);
  const [cur, setCur] = useState(0);
  const [manual, setManual] = useState(false);
  const [sensor, setSensor] = useState<'unknown' | 'ok' | 'none'>('unknown');
  const [cnt, setCnt] = useState<(number | null)[]>(() => Array(n).fill(null));
  const [losers, setLosers] = useState<number[]>([]);
  const [pen, setPen] = useState<number[]>(() => Array(n).fill(0));
  const [turns, setTurns] = useState(0);
  const [gacha, setGacha] = useState<GachaItem[]>([]);
  const stats = useRef<Stats>(newStats(n)).current;
  const best = useRef<(number | null)[]>(Array(n).fill(null)).current;
  const tapped = useRef<boolean[]>(Array(n).fill(false)).current;
  const [menu, setMenu] = useState(false);
  const [rules, setRules] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const phaseRef = useRef<Phase>('intro');
  phaseRef.current = phase;
  const manualRef = useRef(false);
  const curRef = useRef(0);
  const dir = useRef<[number, number, number] | null>(null);
  const flip = useRef(0);
  const lastHit = useRef(0);
  const latestAt = useRef(0);
  const startAt = useRef(0);
  const lastSec = useRef(SEC);
  const beat = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const meter = useRef(new Animated.Value(0)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => {
    if (skipIntro) start();
  }, []);

  // センサーを聞く（無い・許可が無い時は連打）
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    (async () => {
      try {
        const ok = await DeviceMotion.isAvailableAsync();
        if (!ok) return setSensor('none');
        const perm = await DeviceMotion.requestPermissionsAsync?.();
        if (perm && perm.granted === false) return setSensor('none');
        DeviceMotion.setUpdateInterval(16);
        sub = DeviceMotion.addListener((e: { acceleration?: { x: number; y: number; z: number } | null }) => {
          const a = e.acceleration;
          if (!a) return;
          latestAt.current = Date.now();
          sampleRef.current(a.x, a.y, a.z);
        });
        setSensor('ok');
      } catch {
        setSensor('none');
      }
    })();
    return () => {
      sub?.remove();
      clear();
    };
  }, []);

  const hit = () => {
    curRef.current++;
    lastHit.current = Date.now();
    setCur(curRef.current);
    pop.setValue(1.25);
    Animated.timing(pop, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    tilt.setValue(curRef.current % 2 ? 1 : -1);
  };
  const sampleRef = useRef<(x: number, y: number, z: number) => void>(() => {});
  sampleRef.current = (x: number, y: number, z: number) => {
    if (phaseRef.current !== 'play' || manualRef.current) return;
    const mag = Math.hypot(x, y, z);
    meter.setValue(Math.min(1, mag / 40));
    if (mag > HI && Date.now() - lastHit.current > GAP) {
      const u: [number, number, number] = [x / mag, y / mag, z / mag];
      const d = dir.current;
      if (!d) dir.current = u;
      else if (u[0] * d[0] + u[1] * d[1] + u[2] * d[2] < -0.3) {
        // 切り返しは1往復で2回来るので、1回おきに数える
        dir.current = u;
        flip.current++;
        lastHit.current = Date.now();
        if (flip.current % 2 === 1) hit();
      }
    }
  };

  const start = () => {
    setRound(1);
    setK(0);
    setPhase('hand');
  };
  const countdown = () => {
    setPhase('count');
    setCount(3);
    play('tick');
    [1, 2].forEach((j) => timers.current.push(setTimeout(() => { setCount(3 - j); play('tick'); }, j * 800)));
    timers.current.push(setTimeout(go, 2400));
  };
  const go = () => {
    const live = Date.now() - latestAt.current < 1500;
    manualRef.current = !live;
    setManual(!live);
    curRef.current = 0;
    dir.current = null;
    flip.current = 0;
    lastHit.current = 0;
    setCur(0);
    startAt.current = Date.now();
    setLeft(SEC);
    lastSec.current = SEC;
    setPhase('play');
    phaseRef.current = 'play';
    play('coin');
    const tick = () => {
      const ms = SEC * 1000 - (Date.now() - startAt.current);
      if (phaseRef.current !== 'play') return;
      if (ms <= 0) return done();
      setLeft(ms / 1000);
      const sec = Math.ceil(ms / 1000);
      if (sec !== lastSec.current) {
        lastSec.current = sec;
        beat.setValue(1.28);
        Animated.spring(beat, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
        play('tick');
      }
      timers.current.push(setTimeout(tick, 50));
    };
    timers.current.push(setTimeout(tick, 50));
  };
  const done = () => {
    if (phaseRef.current !== 'play') return;
    clear();
    const c = curRef.current;
    const nc = cnt.slice();
    nc[who] = c;
    setCnt(nc);
    if (c > (best[who] ?? -1)) best[who] = c;
    if (manualRef.current) tapped[who] = true;
    setTurns((t) => t + 1);
    play('fanfare');
    // タイムアップの「ブブッ」：振ってる最中は画面を見てへんので、手に伝える
    Vibration.vibrate([0, 300, 120, 300]);
    if (k + 1 >= n) {
      const min = Math.min(...(nc as number[]));
      setLosers(members.map((_, i) => i).filter((i) => nc[i] === min));
      setPhase('rank');
    } else setPhase('done');
  };
  const doGacha = () => {
    const x = level === 'jigoku' ? 2 : 1;
    const items = losers.map((i) => ({ i, n: x, ...decks.batsu(members, i, x) }));
    setGacha(items);
    setPhase('batsu');
    play(items.every((it) => it.lucky) ? 'gachaLucky' : 'gacha');
  };
  const accept = () => {
    const np = pen.slice();
    gacha.forEach((x) => {
      if (x.lucky) stats.lucky[x.i]++;
      else {
        np[x.i] += x.n;
        stats.why[x.i].shake = (stats.why[x.i].shake ?? 0) + x.n;
      }
    });
    setPen(np);
    setRound((r) => r + 1);
    setK(0);
    setCnt(Array(n).fill(null));
    setLosers([]);
    setPhase('hand');
  };
  const finish = () => {
    clear();
    stats.shakeBest = best.slice();
    onFinish(pen, turns, stats);
  };

  const pal = STAGE[level];
  const fg = pal.cardFg;
  const frame = phase === 'intro' ? C.muted : phase === 'rank' && losers.length ? '#ff2a2a' : colorOf(who);
  const nextWho = (k + 1 + round - 1) % n;

  const board = (hi: number) => {
    const done = members.map((_, i) => i).filter((i) => cnt[i] != null).sort((a, b) => (cnt[b] as number) - (cnt[a] as number));
    const wait = members.map((_, i) => i).filter((i) => cnt[i] == null);
    const max = Math.max(1, ...done.map((i) => cnt[i] as number));
    const lose = phase === 'rank' || phase === 'batsu' ? losers : [];
    return (
      <View style={s.board}>
        {done.map((i, r) => {
          const bad = lose.includes(i);
          return (
            <View key={i} style={[s.row, i === hi && { borderColor: colorOf(i) }]}>
              <Text style={[s.rk, { color: fg }]}>{r + 1}</Text>
              <Text style={[s.nm, { color: bad ? '#ff3b3b' : fg }]} numberOfLines={1}>{members[i].name}</Text>
              <View style={s.barBox}>
                <View style={[s.bar, { width: `${((cnt[i] as number) / max) * 100}%`, backgroundColor: bad ? '#ff3b3b' : colorOf(i) }]} />
              </View>
              <Text style={[s.num, { color: bad ? '#ff3b3b' : fg }]}>{cnt[i]}</Text>
              {tapped[i] && <Text style={[s.tapTag, { color: fg }]}>連打</Text>}
            </View>
          );
        })}
        {wait.map((i) => (
          <View key={i} style={[s.row, { opacity: 0.4 }]}>
            <Text style={[s.rk, { color: fg }]}>-</Text>
            <Text style={[s.nm, { color: fg }]} numberOfLines={1}>{members[i].name}</Text>
            <View style={s.barBox} />
            <Text style={[s.num, { color: fg }]}>?</Text>
          </View>
        ))}
      </View>
    );
  };

  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="shake" tag={`${n}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」：${level === 'jigoku' ? '最下位の罰が2倍' : '最下位が罰'}`} />
          <Safety fg={fg} />
          {sensor === 'none' && <Text style={[s.small, { color: fg }]}>このスマホは振ったのがとられへんので、画面の連打で勝負するモードになる</Text>}
        </IntroCard>
      );
      controls = <BigButton pal={pal} label="スタート" onPress={start} />;
      break;
    case 'hand':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`第${round}回戦・${k + 1}/${n}人目`}</Prog>
          <HandWho members={members} i={who} sub="の番" fg={fg} />
          <Safety fg={fg} />
          <Note fg={fg}>{`3・2・1のあと${SEC}秒間、ひたすら振る`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="ガッチリ握った → カウントダウン" onPress={countdown} />;
      break;
    case 'count':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`${members[who].name}、ガッチリ握って…`}</Prog>
          <Text style={[s.count, { color: fg }]}>{count}</Text>
          <Note fg={fg}>手は絶対に離さへんこと</Note>
        </ModeCard>
      );
      controls = <Text style={[s.hint, { color: pal.muted }]}>まだ振らんといて</Text>;
      break;
    case 'play':
      card = (
        <View style={{ flex: 1 }} onTouchStart={manual ? hit : undefined}>
          <ModeCard pal={pal} center>
            <View style={s.clock}>
              <Animated.Text style={[s.sec, { color: left <= 3 ? '#ff3b3b' : fg, transform: [{ scale: beat }] }]}>
                {Math.floor(left)}
                <Text style={s.frac}>.{Math.floor((left % 1) * 10)}</Text>
                <Text style={s.secUnit}> 秒</Text>
              </Animated.Text>
              <View style={s.pips}>
                {Array.from({ length: SEC }, (_, i) => {
                  const now = Math.ceil(left) - 1;
                  const col = left <= 3 ? '#ff3b3b' : colorOf(who);
                  return (
                    <View key={i} style={[s.pip, { backgroundColor: i < now ? col : alpha('#888888', 0.22) }]}>
                      {i === now && <View style={{ width: `${(left % 1 || 1) * 100}%`, height: '100%', backgroundColor: col }} />}
                    </View>
                  );
                })}
              </View>
            </View>
            <View style={s.mid}>
              <Animated.View style={{ transform: [{ rotate: tilt.interpolate({ inputRange: [-1, 1], outputRange: ['-16deg', '16deg'] }) }] }}>
                <Icon name="shake" size={96} color={colorOf(who)} />
              </Animated.View>
              <Animated.Text style={[s.cnt, { color: fg, transform: [{ scale: pop }] }]}>
                {cur}
                <Text style={s.cntUnit}> 回</Text>
              </Animated.Text>
              {manual ? (
                <Note fg={fg}>{'このスマホは振ったのがとられへんので、\n画面を連打した回数で勝負'}</Note>
              ) : (
                <View style={s.meter}>
                  <Animated.View style={[s.meterFill, { width: meter.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
                </View>
              )}
            </View>
          </ModeCard>
        </View>
      );
      controls = <Text style={[s.hint, { color: pal.muted }]}>{manual ? '画面を連打！' : '振れ振れ振れ！（手は離さへん）'}</Text>;
      break;
    case 'done':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`${members[who].name}の記録`}</Prog>
          <Text style={[s.cnt, { color: fg }]}>
            {cnt[who]}
            <Text style={s.cntUnit}> 回</Text>
          </Text>
          {board(who)}
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={`次は${members[nextWho].name}`} onPress={() => { setK(k + 1); setPhase('hand'); }} />;
      break;
    case 'rank':
      card = (
        <ModeCard pal={pal} center bg="#1a0606" edge="#e8202a">
          <Prog fg="#f7f3ea">{`第${round}回戦の結果`}</Prog>
          {board(-1)}
          <Text style={[s.lose, { color: '#ff3b3b' }]}>{`${losers.map((i) => members[i].name).join('・')}が最下位${level === 'jigoku' ? '（罰2倍）' : ''}`}</Text>
        </ModeCard>
      );
      controls = <BigButton pal={pal} danger label={`${losers.map((i) => members[i].name).join('・')}に罰ガチャ`} onPress={doGacha} />;
      break;
    case 'batsu':
      card = (
        <DeckStack pal={pal} minHeight={0}>
          <GachaCard pal={pal} members={members} items={gacha} />
        </DeckStack>
      );
      controls = <BigButton pal={pal} label={`${gacha.every((x) => x.lucky) ? 'ラッキー！' : '受け入れた'} → 次の回戦`} onPress={accept} />;
      break;
  }

  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      <View style={[s.wrap, flipped && { transform: [{ rotate: '180deg' }] }]}>
        <ScoreBar pal={pal} members={members} pen={pen} rev={Array(n).fill(false)} doer={phase === 'intro' || phase === 'rank' || phase === 'batsu' ? -1 : who} onMenu={() => setMenu(true)} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
        <View style={{ flex: 1 }}>{card}</View>
        {controls}
      </View>
      <Frame color={frame} />
      <RulesSheet visible={rules} custom={HELP.shake.rules} onClose={() => setRules(false)} />
      <GameMenu
        visible={menu}
        meta={`全力シェイク・${LEVEL_LABEL[level]}・${round}回戦`}
        rulesSub="このモードの遊び方"
        onRules={() => setRules(true)}
        onEnd={finish}
        onSettings={onSettings}
        onQuit={() => { clear(); onQuit(); }}
        onClose={() => setMenu(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  small: { fontSize: 12, fontWeight: '700', opacity: 0.65, lineHeight: 18, textAlign: 'center' },
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
  safe: { alignSelf: 'stretch', gap: 4, padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#ffb02e', backgroundColor: 'rgba(255,176,46,0.16)' },
  safeTitle: { color: '#e8780a', fontSize: 14, fontWeight: '900' },
  safeText: { fontSize: 13, lineHeight: 20, fontWeight: '600' },
  count: { fontFamily: F.display, fontSize: 130, lineHeight: 140 },
  clock: { width: '100%', alignItems: 'center', gap: 8, paddingTop: 4 },
  sec: { fontFamily: F.display, fontSize: 96, lineHeight: 100, fontVariant: ['tabular-nums'] },
  frac: { fontSize: 36, opacity: 0.55 },
  secUnit: { fontSize: 18, opacity: 0.6 },
  pips: { flexDirection: 'row', gap: 5, width: '100%', maxWidth: 280 },
  pip: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  mid: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', gap: 12 },
  cnt: { fontFamily: F.display, fontSize: 104, lineHeight: 112, fontVariant: ['tabular-nums'] },
  cntUnit: { fontSize: 20, opacity: 0.6 },
  meter: { width: '100%', maxWidth: 260, height: 14, borderRadius: 7, backgroundColor: 'rgba(136,136,136,0.2)', overflow: 'hidden' },
  meterFill: { height: '100%', backgroundColor: '#ffb02e' },
  board: { alignSelf: 'stretch', gap: 6, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderColor: 'transparent', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 2 },
  rk: { width: 18, textAlign: 'center', fontFamily: F.display, opacity: 0.55 },
  nm: { width: 78, fontSize: 15, fontWeight: '800' },
  barBox: { flex: 1, height: 12 },
  bar: { height: 12, borderRadius: 6 },
  num: { minWidth: 36, textAlign: 'right', fontFamily: F.display, fontSize: 20 },
  tapTag: { fontSize: 10, opacity: 0.6 },
  lose: { fontFamily: F.display, fontSize: 26, lineHeight: 32, textAlign: 'center', marginTop: 8 },
});
