import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { HurryFrame } from '../components/Fx';
import { useHurry } from '../lib/useHurry';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { Tap } from '../components/Tap';
import { BigButton, DeckStack, Frame, GachaCard, RulesSheet, ScoreBar } from '../components/Stage';
import { HandWho, IntroCard, Lead, LevelBox, ModeCard, NameTiles, Note, Outline, Prog, Roulette } from '../components/ModeParts';
import { HELP } from '../lib/help';
import GameMenu from '../components/GameMenu';
import { Decks } from '../lib/game';
import { play } from '../lib/sound';
import { load, save } from '../lib/storage';
import { useCountdown } from '../lib/useCountdown';
import { newStats, type Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, alpha, colorOf } from '../theme';
import type { GachaItem, Level, Member, Night } from '../types';

type Props = {
  members: Member[];
  level: Level;
  night: Night;
  onQuit: () => void;
  onSettings: () => void;
  onFinish: (pen: number[], turns: number, stats: Stats, words?: string[], scores?: number[]) => void;
};
type Phase = 'intro' | 'roul' | 'hand' | 'act' | 'timeup' | 'over' | 'low' | 'end';
const SECS = [30, 60, 90];
const LV_DESC: Record<Level, string> = { yurume: '簡単なお題', futsu: 'ふつうのお題', jigoku: 'むずいお題' };


/** 早押しジェスチャー：演じる人だけお題を見て体で伝える。当てた人と演じた人に1点。全員演じたら最下位が罰 */
export default function GestureScreen({ members, level, night, onQuit, onSettings, onFinish }: Props) {
  useKeepAwake();
  const pal = STAGE[level];
  const fg = pal.cardFg;
  const n = members.length;
  const decks = useRef(new Decks()).current;
  decks.night = night;
  decks.level = level;
  const [phase, setPhase] = useState<Phase>('intro');
  const [sec, setSec] = useState(60);
  const [actor, setActor] = useState(0);
  const [acted, setActed] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [word, setWord] = useState(() => decks.gesture(level, night, members));
  const [got, setGot] = useState(0);
  const [last, setLast] = useState<number | null>(null);
  const [score, setScore] = useState<number[]>(() => Array(n).fill(0));
  const [pen, setPen] = useState<number[]>(() => Array(n).fill(0));
  const [correct, setCorrect] = useState(0);
  const [gacha, setGacha] = useState<GachaItem[]>([]);
  const stats = useRef<Stats>(newStats(n)).current;
  const [menu, setMenu] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const clock = useCountdown(() => {
    setPhase('timeup');
    play('alarm');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  });
  const hurry = useHurry(clock.left, phase === 'act');
  useEffect(() => {
    load<number>('nd_gs_sec', 60).then(setSec);
  }, []);

  const go = () => {
    setGot(0);
    setLast(null);
    setWord(decks.gesture(level, night, members));
    setPhase('act');
    clock.start(sec);
  };
  const hit = (i: number) => {
    setScore((s) => s.map((v, j) => (j === i || j === actor ? v + 1 : v)));
    setGot(got + 1);
    setCorrect(correct + 1);
    setLast(i);
    setWord(decks.gesture(level, night, members));
    play('coin');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };
  const nextActor = () => {
    if (acted + 1 >= n) return setPhase('over');
    setActed(acted + 1);
    setActor((actor + 1) % n);
    setPhase('hand');
  };
  const lowest = () => {
    const m = Math.min(...score);
    return score.map((v, i) => (v === m ? i : -1)).filter((i) => i >= 0);
  };
  const doLow = () => {
    const items = lowest().map((i) => ({ i, n: 1, ...decks.batsu(members, i) }));
    setGacha(items);
    setPhase('low');
    play(items.every((x) => x.lucky) ? 'gachaLucky' : 'gacha');
  };
  const accept = () => {
    const np = pen.slice();
    gacha.forEach((x) => {
      if (x.lucky) stats.lucky[x.i]++;
      else {
        np[x.i] += x.n;
        stats.why[x.i].glow = (stats.why[x.i].glow ?? 0) + x.n;
      }
    });
    setPen(np);
    setPhase('end');
  };
  const finish = () => {
    clock.stop();
    onFinish(pen, correct, stats, undefined, score);
  };

  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="gesture" tag={`${n}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」：${LV_DESC[level]}`} note={night && !members.some((m) => m.ng) ? `${night === 'shinya' ? '深夜' : '夜'}モードのお題も出る` : undefined} />
          <Text style={[s.small, { color: fg, fontWeight: '900' }]}>1人の持ち時間</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {SECS.map((v) => (
              <Tap key={v} onPress={() => { setSec(v); save('nd_gs_sec', v); }} style={[s.sec, { borderColor: alpha('#141210', 0.25) }, sec === v && { backgroundColor: fg, borderColor: fg }]}>
                <Text style={[s.secText, { color: sec === v ? pal.cardBg : fg }]}>{v}秒</Text>
              </Tap>
            ))}
          </View>
        </IntroCard>
      );
      controls = <BigButton pal={pal} label="ルーレットで最初の人を決める" onPress={() => { setPicked(null); setPhase('roul'); }} />;
      break;
    case 'roul':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>最初に演じる人は…</Prog>
          <Roulette members={members} fg={fg} tick={() => play('tick')} onDone={(i) => { setPicked(i); setActor(i); play('coin'); }} />
          <Lead fg={fg}>{picked != null ? `${members[picked].name}から演じる！` : 'ルーレット中…'}</Lead>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={picked != null ? `${members[picked].name}から始める` : 'ルーレット中…'} disabled={picked == null} onPress={() => setPhase('hand')} />;
      break;
    case 'hand':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`演じる人 ${acted + 1} / ${n}`}</Prog>
          <HandWho members={members} i={actor} sub="が演じる番" fg={fg} />
          <Note fg={fg}>{`スマホを${members[actor].name}に渡して。\nお題は${members[actor].name}だけが見る`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={`スタート（${sec}秒）`} onPress={go} />;
      break;
    case 'act':
      card = (
        <ModeCard pal={pal} center bg={word.night ? '#1c1328' : undefined} edge={word.night === 'shinya' ? C.deep : word.night ? C.night : undefined}>
          <Text style={[s.timer, { color: clock.left <= 10 ? '#ff3b3b' : word.night ? '#f1e8ff' : fg }]}>{clock.left}</Text>
          <Prog fg={word.night ? '#f1e8ff' : fg}>{`${members[actor].name}だけ見て、体で伝えろ`}</Prog>
          <Text style={[s.word, { color: word.night ? '#f1e8ff' : fg }]} adjustsFontSizeToFit numberOfLines={2}>{word.text}</Text>
          <Note fg={word.night ? '#f1e8ff' : fg}>{`正解 ${got}問${last != null && got ? `（さっきは${members[last].name}）` : ''}`}</Note>
        </ModeCard>
      );
      controls = (
        <View style={{ gap: 10 }}>
          <Text style={[s.q, { color: pal.fg }]}>当てたのは？<Text style={{ color: pal.muted, fontSize: 12 }}>　タップで1点</Text></Text>
          <NameTiles members={members} list={members.map((_, i) => i).filter((i) => i !== actor)} fg={pal.fg} count={(i) => `${score[i]}点`} onPress={hit} />
          <Outline label="パス（次のお題）" fg={pal.fg} onPress={() => { setWord(decks.gesture(level, night, members)); play('tick'); }} style={{ flex: 0 }} />
        </View>
      );
      break;
    case 'timeup':
      card = (
        <ModeCard pal={pal} center>
          <Text style={[s.timer, { color: fg }]}>0</Text>
          <Lead fg={fg}>タイムアップ！</Lead>
          <Note fg={fg}>{`${members[actor].name}は${got}問正解${got ? `（+${got}点）` : ''}`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={acted + 1 >= n ? '点数発表へ' : `次は${members[(actor + 1) % n].name}が演じる`} onPress={nextActor} />;
      break;
    case 'over':
    case 'end': {
      const low = lowest();
      const rows = members.map((m, i) => ({ m, i, v: score[i] })).sort((a, b) => b.v - a.v);
      card = (
        <ModeCard pal={pal}>
          <Text style={[s.title, { color: fg }]}>全員演じた！</Text>
          <View style={{ flex: 1, justifyContent: 'center', gap: 8 }}>
            {rows.map((r) => (
              <View key={r.i} style={[s.row, { borderLeftColor: colorOf(r.i), backgroundColor: alpha('#888888', 0.12) }]}>
                <Text style={[s.rowName, { color: low.includes(r.i) ? '#ff3b3b' : fg }]} numberOfLines={1}>{r.m.name}{low.includes(r.i) ? '　罰' : ''}</Text>
                <Text style={[s.rowV, { color: fg }]}>{r.v}点</Text>
              </View>
            ))}
          </View>
          <Text style={[s.small, { color: fg }]}>点数が一番低い人が罰</Text>
        </ModeCard>
      );
      controls = phase === 'end' ? <BigButton pal={pal} label="結果発表" onPress={finish} /> : <BigButton pal={pal} danger label={`${low.map((i) => members[i].name).join('・')}に罰ガチャ`} onPress={doLow} />;
      break;
    }
    case 'low':
      card = (
        <DeckStack pal={pal} minHeight={0}>
          <GachaCard pal={pal} members={members} items={gacha} />
        </DeckStack>
      );
      controls = <BigButton pal={pal} label={`${gacha.every((x) => x.lucky) ? 'ラッキー！' : '受け入れた'} → 結果発表へ`} onPress={accept} />;
      break;
  }

  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      <View style={[s.wrap, flipped && { transform: [{ rotate: '180deg' }] }]}>
        <ScoreBar pal={pal} members={members} pen={pen} rev={Array(n).fill(false)} doer={phase === 'intro' ? -1 : actor} onMenu={() => setMenu(true)} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
        <View style={{ flex: 1 }}>{card}</View>
        {controls}
      </View>
      <Frame color={phase === 'intro' ? C.muted : colorOf(actor)} />
      <HurryFrame on={hurry} />
      <RulesSheet visible={rulesOpen} custom={HELP.gesture.rules} onClose={() => setRulesOpen(false)} />
      <GameMenu
        visible={menu}
        meta={`早押しジェスチャー・${LEVEL_LABEL[level]}・${correct}問正解`}
        rulesSub="このモードの遊び方"
        flipped={flipped}
        onFlip={() => setFlipped((f) => !f)}
        onRules={() => setRulesOpen(true)}
        onEnd={finish}
        onSettings={onSettings}
        onQuit={() => { clock.stop(); onQuit(); }}
        onClose={() => setMenu(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  title: { fontFamily: F.display, fontSize: 22 },
  how: { fontSize: 16, fontWeight: '700', lineHeight: 24 },
  small: { fontSize: 12, fontWeight: '700', opacity: 0.7, lineHeight: 18 },
  lvBox: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, gap: 2 },
  lvText: { fontSize: 14, fontWeight: '900' },
  sec: { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  secText: { fontWeight: '900', fontSize: 15 },
  timer: { fontFamily: F.display, fontSize: 64, lineHeight: 74 },
  word: { fontFamily: F.display, fontSize: 48, lineHeight: 60, textAlign: 'center' },
  q: { fontSize: 15, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderLeftWidth: 6 },
  rowName: { fontWeight: '900', fontSize: 16, flexShrink: 1 },
  rowV: { fontFamily: F.display, fontSize: 22 },
});
