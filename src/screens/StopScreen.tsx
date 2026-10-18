import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Animated, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, Frame, GachaCard, RulesSheet, ScoreBar, DeckStack } from '../components/Stage';
import { HandWho, IntroCard, LevelBox, ModeCard, Note, Prog } from '../components/ModeParts';
import { Tap } from '../components/Tap';
import { HELP } from '../lib/help';
import GameMenu from '../components/GameMenu';
import { Decks } from '../lib/game';
import { play } from '../lib/sound';
import { load, save } from '../lib/storage';
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
type Phase = 'intro' | 'hand' | 'count' | 'play' | 'check' | 'done' | 'rank' | 'batsu';
type Dir = 'down' | 'up';
type Res = { v: number; diff: number; over: boolean; exact: boolean };

const RATES = [0.5, 1.5, 2, 0.5, 1.5, 2, 1];
/** これだけ行き過ぎたら勝手に止まる */
const OVER = 1.5;
/** -0.00 にならんように丸めてから */
const fmt = (v: number) => {
  const r = Math.round(v * 100) / 100;
  return (r < 0 ? '-' : '') + Math.abs(r).toFixed(2);
};
const rnd = (n: number) => Math.floor(Math.random() * n);
const LV_TEXT: Record<Level, string> = { yurume: '速さは一定', futsu: '途中で速さが変わる（×0.5〜×2）', jigoku: '速さが変わる＋数字が消える＋邪魔が入る' };

/**
 * ピタッとストップ：数字が減っていく（or 増えていく）のを、0（or 目標の秒数）ちょうどで止める。行き過ぎたらオーバーでアウト。
 * ゆるめ＝一定の速さ／普通＝途中で速さが変わる（×0.5〜×2）／地獄＝それに加えて数字が消えたり邪魔が入ったり。
 * 全員1回ずつ止めたら答え合わせ：オーバーした人が罰。誰もオーバーしてへんかったら一番遠い人が罰。ピッタリが出たら罰2倍
 */
export default function StopScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const n = members.length;
  const decks = useRef(new Decks()).current;
  decks.night = night;
  decks.level = level;
  const [phase, setPhase] = useState<Phase>('intro');
  const [dir, setDir] = useState<Dir>('down');
  const [round, setRound] = useState(1);
  const [k, setK] = useState(0);
  const who = (k + round - 1) % n;
  const [target, setTarget] = useState(10);
  const [count, setCount] = useState(3);
  const [res, setRes] = useState<(Res | null)[]>(() => Array(n).fill(null));
  const [losers, setLosers] = useState<number[]>([]);
  const [exactAny, setExactAny] = useState(false);
  const [pen, setPen] = useState<number[]>(() => Array(n).fill(0));
  const [turns, setTurns] = useState(0);
  const [gacha, setGacha] = useState<GachaItem[]>([]);
  const stats = useRef<Stats>(newStats(n)).current;
  const exact = useRef<number[]>(Array(n).fill(0)).current;
  const [menu, setMenu] = useState(false);
  const [rules, setRules] = useState(false);
  const [flipped, setFlipped] = useState(false);
  // 走ってる間の表示（毎フレーム）
  const [view, setView] = useState({ text: '0.00', hide: false, jam: false, over: false, badge: '' });
  const phaseRef = useRef<Phase>('intro');
  phaseRef.current = phase;
  const run = useRef({ el: 0, prev: 0, rate: 1, nextChange: 0, hideUntil: 0, nextHide: 0, jamUntil: 0, jamVal: 0, nextJam: 0, rateShow: 0, raf: 0 });
  const shake = useRef(new Animated.Value(0)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    cancelAnimationFrame(run.current.raf);
  };

  useEffect(() => {
    load<Dir>('nd_spdir', 'down').then((v) => { if (v === 'up' || v === 'down') setDir(v); }).catch(() => {});
    if (skipIntro) newRound(1);
    return clear;
  }, []);

  const shown = (el: number, t = target) => (dir === 'down' ? t - el : el);
  const goal = dir === 'down' ? '0.00' : `${target}.00`;

  const newRound = (r: number) => {
    setRound(r);
    setK(0);
    setRes(Array(n).fill(null));
    setLosers([]);
    setExactAny(false);
    setTarget(6 + rnd(7));
    setPhase('hand');
  };
  const countdown = () => {
    setPhase('count');
    setCount(3);
    play('tick');
    [1, 2].forEach((j) => timers.current.push(setTimeout(() => { setCount(3 - j); play('tick'); }, j * 700)));
    timers.current.push(setTimeout(go, 2100));
  };
  const go = () => {
    const now = performance.now();
    const R = run.current;
    Object.assign(R, { el: 0, prev: now, rate: 1, nextChange: now + 900 + Math.random() * 900, hideUntil: 0, nextHide: now + 1400 + Math.random() * 1500, jamUntil: 0, jamVal: 0, nextJam: now + 1100 + Math.random() * 1600, rateShow: 0 });
    setView({ text: fmt(shown(0)), hide: false, jam: false, over: false, badge: '' });
    setPhase('play');
    phaseRef.current = 'play';
    play('coin');
    const loop = (t: number) => {
      if (phaseRef.current !== 'play') return;
      const dt = (t - R.prev) / 1000;
      R.prev = t;
      R.el += dt * R.rate;
      if (level !== 'yurume' && t > R.nextChange) {
        let r: number;
        do r = RATES[rnd(RATES.length)];
        while (r === R.rate);
        R.rate = r;
        R.nextChange = t + 700 + Math.random() * 1300;
        R.rateShow = t + 900;
        if (level === 'futsu') play('tick');
      }
      if (level === 'jigoku') {
        if (t > R.nextHide && R.hideUntil < t) {
          R.hideUntil = t + 600 + Math.random() * 900;
          R.nextHide = R.hideUntil + 900 + Math.random() * 1500;
        }
        if (t > R.nextJam && R.jamUntil < t) {
          R.jamUntil = t + 220 + Math.random() * 200;
          R.jamVal = Math.random() * target;
          R.nextJam = R.jamUntil + 700 + Math.random() * 1400;
          // 邪魔：ウソの数字＋画面がブレる
          Animated.sequence([
            Animated.timing(shake, { toValue: 1, duration: 50, useNativeDriver: true }),
            Animated.timing(shake, { toValue: -1, duration: 80, useNativeDriver: true }),
            Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
          ]).start();
        }
      }
      if (R.el - target > OVER) return stop();
      const hide = t < R.hideUntil;
      const jam = t < R.jamUntil;
      setView({
        text: hide ? '??.??' : fmt(shown(jam ? R.jamVal : R.el)),
        hide,
        jam,
        over: !hide && R.el > target,
        badge: level === 'futsu' && t < R.rateShow ? (R.rate > 1 ? `×${R.rate} 加速！` : `×${R.rate} 減速…`) : '',
      });
      R.raf = requestAnimationFrame(loop);
    };
    R.raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    if (phaseRef.current !== 'play') return;
    const R = run.current;
    cancelAnimationFrame(R.raf);
    R.el += ((performance.now() - R.prev) / 1000) * R.rate;
    const diff = Math.round((target - R.el) * 100) / 100;
    const r: Res = { v: shown(R.el), diff, over: diff < 0, exact: diff === 0 };
    const nr = res.slice();
    nr[who] = r;
    setRes(nr);
    if (r.exact) {
      exact[who]++;
      setExactAny(true);
    }
    setTurns((x) => x + 1);
    // まず止めた秒数だけ見せて、ボタンで答え合わせ
    play('pop');
    if (k + 1 >= n) {
      const idx = members.map((_, i) => i);
      const overs = idx.filter((i) => nr[i]!.over);
      if (overs.length) setLosers(overs);
      else {
        const far = Math.max(...idx.map((i) => nr[i]!.diff));
        setLosers(far > 0 ? idx.filter((i) => nr[i]!.diff === far) : []);
      }
      after.current = 'rank';
    } else after.current = 'done';
    setPhase('check');
  };
  const after = useRef<Phase>('done');
  const reveal = () => {
    const r = res[who]!;
    if (r.over) {
      play('boom');
      Vibration.vibrate([0, 120, 60, 200]);
    } else play(r.exact ? 'fanfare' : 'coin');
    setPhase(after.current);
  };
  const doGacha = () => {
    const x = exactAny ? 2 : 1;
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
        stats.why[x.i].stop = (stats.why[x.i].stop ?? 0) + x.n;
      }
    });
    setPen(np);
    newRound(round + 1);
  };
  const finish = () => {
    clear();
    stats.stopExact = exact.slice();
    onFinish(pen, turns, stats);
  };
  const pickDir = (d: Dir) => {
    setDir(d);
    save('nd_spdir', d);
  };

  const pal = STAGE[level];
  const fg = pal.cardFg;
  const frame = phase === 'intro' ? C.muted : (phase === 'rank' && losers.length) || (phase === 'done' && res[who]?.over) ? '#ff2a2a' : colorOf(who);
  const nextWho = (k + 1 + round - 1) % n;
  const diffText = (r: Res) => (r.exact ? 'ピッタリ！' : r.over ? `${Math.abs(r.diff).toFixed(2)}秒オーバー` : `あと${r.diff.toFixed(2)}秒`);

  const board = (hi: number) => {
    const rows = members.map((_, i) => i).filter((i) => res[i]).sort((a, b) => {
      const A = res[a]!, B = res[b]!;
      if (A.over !== B.over) return A.over ? 1 : -1;
      return Math.abs(A.diff) - Math.abs(B.diff);
    });
    const wait = members.map((_, i) => i).filter((i) => !res[i]);
    const lose = phase === 'rank' || phase === 'batsu' ? losers : [];
    return (
      <View style={s.board}>
        {rows.map((i, r) => {
          const x = res[i]!;
          const bad = lose.includes(i);
          const col = bad || x.over ? '#ff3b3b' : x.exact ? '#1f9d55' : fg;
          return (
            <View key={i} style={[s.row, i === hi && { borderColor: colorOf(i) }]}>
              <Text style={[s.rk, { color: fg }]}>{x.over ? '×' : r + 1}</Text>
              <Text style={[s.nm, { color: bad ? '#ff3b3b' : fg }]} numberOfLines={1}>{members[i].name}</Text>
              <Text style={[s.v, { color: fg }]}>{fmt(x.v)}</Text>
              <Text style={[s.d, { color: col }]} numberOfLines={1}>{diffText(x)}</Text>
            </View>
          );
        })}
        {wait.map((i) => (
          <View key={i} style={[s.row, { opacity: 0.4 }]}>
            <Text style={[s.rk, { color: fg }]}>-</Text>
            <Text style={[s.nm, { color: fg }]} numberOfLines={1}>{members[i].name}</Text>
            <Text style={[s.v, { color: fg }]} />
            <Text style={[s.d, { color: fg }]}>?</Text>
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
        <IntroCard pal={pal} mode="stop" tag={`${n}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」：${LV_TEXT[level]}`} />
          <View style={s.dirRow}>
            {(['down', 'up'] as Dir[]).map((d) => {
              const on = dir === d;
              return (
                <Tap key={d} onPress={() => pickDir(d)} style={[s.dirBtn, { borderColor: on ? pal.cardEdge : alpha('#888888', 0.4), backgroundColor: on ? alpha(pal.cardEdge, 0.2) : 'transparent' }]}>
                  <Text style={[s.dirT, { color: fg }]}>{d === 'down' ? '減る' : '増える'}</Text>
                  <Text style={[s.dirS, { color: fg }]}>{d === 'down' ? '0.00で止める' : '目標の秒数で止める'}</Text>
                </Tap>
              );
            })}
          </View>
        </IntroCard>
      );
      controls = <BigButton pal={pal} label="スタート" onPress={() => newRound(1)} />;
      break;
    case 'hand':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`第${round}回戦・${k + 1}/${n}人目`}</Prog>
          <HandWho members={members} i={who} sub="の番" fg={fg} />
          <Text style={[s.goalLead, { color: fg }]}>{dir === 'down' ? `${target}.00 から減っていく` : '0.00 から増えていく'}</Text>
          <Text style={[s.goal, { color: fg }]}>
            {goal}
            <Text style={s.goalSub}> ちょうどで止めろ</Text>
          </Text>
          <Note fg={fg}>{`${level === 'yurume' ? '速さは一定' : level === 'futsu' ? '途中で速さが変わる' : '速さが変わる・数字が消える・邪魔が入る'}。行き過ぎたらオーバーでアウト`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="スタート" onPress={countdown} />;
      break;
    case 'count':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`${members[who].name}、準備して…`}</Prog>
          <Text style={[s.count, { color: fg }]}>{count}</Text>
          <Note fg={fg}>{`${goal}で止める`}</Note>
        </ModeCard>
      );
      controls = <Text style={[s.hint, { color: pal.muted }]}>ボタンに指を置いて待って</Text>;
      break;
    case 'play':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`${members[who].name}・${goal}で止めろ`}</Prog>
          <Animated.View style={[s.box, { transform: [{ translateX: Animated.multiply(shake, 6) }] }]}>
            <Text
              style={[s.num, { color: view.over ? '#ff3b3b' : view.jam ? '#b69cff' : fg, opacity: view.hide ? 0.35 : 1 }, view.jam && { textShadowColor: '#ff5d8f', textShadowOffset: { width: 3, height: 0 }, textShadowRadius: 0 }]}
              adjustsFontSizeToFit
              numberOfLines={1}
            >
              {view.text}
            </Text>
            {!!view.badge && <Text style={s.badge}>{view.badge}</Text>}
          </Animated.View>
          <Note fg={fg}>{dir === 'down' ? '0を過ぎたらオーバー' : `${target}秒を過ぎたらオーバー`}</Note>
        </ModeCard>
      );
      controls = (
        <Pressable onPressIn={stop} style={({ pressed }) => [s.stopBtn, pressed && { transform: [{ scale: 0.97 }] }]}>
          <Text style={s.stopText}>ストップ！</Text>
        </Pressable>
      );
      break;
    case 'check':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`${members[who].name}が止めた秒数は…`}</Prog>
          <Text style={[s.resNum, { color: fg }]}>{fmt(res[who]!.v)}</Text>
          <Note fg={fg}>{`目標は ${goal}`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="結果を見る" onPress={reveal} />;
      break;
    case 'done': {
      const r = res[who]!;
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`${members[who].name}の記録`}</Prog>
          <Text style={[s.resNum, { color: r.over ? '#ff3b3b' : r.exact ? '#1f9d55' : fg }]}>{fmt(r.v)}</Text>
          <Text style={[s.verdict, { color: r.over ? '#ff3b3b' : '#1f9d55' }]}>{diffText(r)}</Text>
          {board(who)}
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={`次は${members[nextWho].name}`} onPress={() => { setK(k + 1); setPhase('hand'); }} />;
      break;
    }
    case 'rank':
      card = (
        <ModeCard pal={pal} center bg="#1a0606" edge="#e8202a">
          <Prog fg="#f7f3ea">{`第${round}回戦の結果`}</Prog>
          {board(-1)}
          <Text style={[s.lose, { color: losers.length ? '#ff3b3b' : '#1f9d55' }]}>
            {losers.length ? `${losers.map((i) => members[i].name).join('・')}が${losers.some((i) => res[i]?.over) ? 'オーバー' : '一番遠い'}${exactAny ? '（ピッタリが出たので罰2倍）' : ''}` : '全員ピッタリ！罰なし'}
          </Text>
        </ModeCard>
      );
      controls = losers.length ? (
        <BigButton pal={pal} danger label={`${losers.map((i) => members[i].name).join('・')}に罰ガチャ`} onPress={doGacha} />
      ) : (
        <BigButton pal={pal} label="次の回戦" onPress={() => newRound(round + 1)} />
      );
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
      <RulesSheet visible={rules} custom={HELP.stop.rules} onClose={() => setRules(false)} />
      <GameMenu
        visible={menu}
        meta={`ピタッとストップ・${LEVEL_LABEL[level]}・${round}回戦`}
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
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
  count: { fontFamily: F.display, fontSize: 130, lineHeight: 140 },
  goalLead: { fontSize: 15, fontWeight: '800', marginTop: 6 },
  goal: { fontFamily: F.display, fontSize: 40, lineHeight: 48 },
  goalSub: { fontSize: 15, fontFamily: undefined, fontWeight: '800' },
  box: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 8, borderRadius: 18, backgroundColor: 'rgba(136,136,136,0.1)', marginVertical: 12 },
  num: { fontFamily: F.display, fontSize: 110, lineHeight: 120, fontVariant: ['tabular-nums'] },
  badge: { position: 'absolute', top: -12, right: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#ff5d8f', color: '#fff', fontWeight: '900', fontSize: 14, overflow: 'hidden' },
  stopBtn: { minHeight: 84, borderRadius: 20, backgroundColor: '#ff3b3b', alignItems: 'center', justifyContent: 'center' },
  stopText: { color: '#fff', fontSize: 26, fontWeight: '900' },
  resNum: { fontFamily: F.display, fontSize: 84, lineHeight: 92, fontVariant: ['tabular-nums'] },
  verdict: { fontFamily: F.display, fontSize: 30, lineHeight: 36 },
  board: { alignSelf: 'stretch', gap: 6, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderColor: 'transparent', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 2 },
  rk: { width: 16, textAlign: 'center', fontFamily: F.display, opacity: 0.55 },
  nm: { width: 68, fontSize: 15, fontWeight: '800' },
  v: { flex: 1, textAlign: 'right', fontFamily: F.display, fontSize: 14, opacity: 0.7, fontVariant: ['tabular-nums'] },
  d: { fontSize: 13, fontWeight: '800' },
  lose: { fontFamily: F.display, fontSize: 24, lineHeight: 30, textAlign: 'center', marginTop: 8 },
  dirRow: { flexDirection: 'row', gap: 8 },
  dirBtn: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 14, borderWidth: 2 },
  dirT: { fontSize: 18, fontWeight: '900' },
  dirS: { fontSize: 11, opacity: 0.65 },
});
