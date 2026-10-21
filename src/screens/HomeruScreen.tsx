import { useRef, useState } from 'react';
import { iniFit, initialOf } from '../lib/game';
import type React from 'react';
import { HurryFrame } from '../components/Fx';
import { useHurry } from '../lib/useHurry';
import { StyleSheet, Text, View } from 'react-native';
import { Haptics } from '../lib/vibe';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, DeckStack, Frame, GachaCard, RuleBanner, RuleSheet, RulesSheet, ScoreBar } from '../components/Stage';
import { IntroCard, Lead, ModeCard, Outline, Prog, Roulette } from '../components/ModeParts';
import { HELP } from '../lib/help';
import GameMenu from '../components/GameMenu';
import { Decks, PERSONAL, othersOf, pick } from '../lib/game';
import { play } from '../lib/sound';
import { usePrefs } from '../lib/prefs';
import { speak } from '../lib/speech';
import { useCountdown } from '../lib/useCountdown';
import { newStats, type Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, alpha, colorOf } from '../theme';
import type { GachaItem, Level, Member, Night, Rule, Segment } from '../types';
import { batsuCue } from '../lib/fx';

type Props = {
  members: Member[];
  level: Level;
  night: Night;
  onQuit: () => void;
  onSettings: () => void;
  onFinish: (pen: number[], turns: number, stats: Stats) => void;
};
type Phase = 'intro' | 'roul' | 'ready' | 'go' | 'batsu';
const SEC = 30;

const plain = (segs: Segment[]) => segs.map((x) => x.text).join('');

/** 褒め殺し：番の人がランダムな1人を30秒褒める。笑ったら褒められた側、耐え切ったら褒めた側が罰 */
export default function HomeruScreen({ members, level, night, onQuit, onSettings, onFinish }: Props) {
  useKeepAwake();
  const pal = STAGE[level];
  const n = members.length;
  const decks = useRef(new Decks()).current;
  decks.night = night;
  decks.level = level;
  const { voice } = usePrefs();
  const [phase, setPhase] = useState<Phase>('intro');
  const [praiser, setPraiser] = useState(0);
  const [target, setTarget] = useState(1 % n);
  const [theme, setTheme] = useState<{ theme: string; night: 'yoru' | 'shinya' | false }>({ theme: '', night: false });
  const [loser, setLoser] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [pen, setPen] = useState<number[]>(() => Array(n).fill(0));
  const [gacha, setGacha] = useState<GachaItem[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [rule, setRule] = useState<Rule | null>(null);
  const [ruleSheet, setRuleSheet] = useState<'pick' | GachaItem | null>(null);
  const stats = useRef<Stats>(newStats(n)).current;
  const [menu, setMenu] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const okNight = (a: number, b: number) => !members[a].ng && !members[b].ng;
  const setup = (p: number) => {
    const t = pick(othersOf(members, p));
    const th = decks.homeru(night, okNight(p, t));
    setPraiser(p);
    setTarget(t);
    setTheme(th);
    setLoser(null);
    setGacha([]);
    setPhase('ready');
    if (voice) speak(`${members[p].name}が${members[t].name}を褒め殺し。テーマは${th.theme}`);
  };
  const lose = (i: number) => {
    clock.stop();
    setLoser(i);
    setRound((r) => r + 1);
    const items = [{ i, n: 1, ...decks.batsu(members, i) }];
    setGacha(items);
    setPhase('batsu');
    batsuCue(items, members);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  };
  const clock = useCountdown(() => {
    play('timeup');
    lose(praiser);
  });
  const hurry = useHurry(clock.left, phase === 'go');
  /** その人の次の番（褒める番）が終わるまで何回あるか */
  const untilNext = (i: number) => (((i - praiser + n) % n) || n) + 1;
  const addRule = (r: Rule) => {
    const segments = r.segments.map((x) => (x.hl ? x : { ...x, text: x.text.replace(/次の(自分の)?番まで[、,]?/, '') }));
    setRules((rs) => [...rs.filter((x) => plain(x.segments) !== plain(segments)), { ...r, segments }].slice(-4));
  };
  const penaltyRule = (i: number, segs: Segment[]) => {
    if (PERSONAL.test(plain(segs))) addRule({ segments: [{ text: members[i].name, hl: true, who: i }, { text: 'の罰：' }, ...segs], left: untilNext(i), who: i });
  };
  const accept = () => {
    const np = pen.slice();
    gacha.forEach((x) => {
      if (x.lucky) stats.lucky[x.i]++;
      else {
        np[x.i] += x.n;
        const w = x.i === target ? 'hmlaugh' : 'hmfail';
        stats.why[x.i][w] = (stats.why[x.i][w] ?? 0) + x.n;
        penaltyRule(x.i, x.segments);
      }
    });
    setPen(np);
    setRules((rs) => rs.map((r) => ({ ...r, left: r.left - 1 })).filter((r) => r.left > 0));
    setup((praiser + 1) % n);
  };
  const rulePenalty = (i: number): GachaItem => {
    const item: GachaItem = { i, n: 1, ...decks.batsu(members, i) };
    if (item.lucky) stats.lucky[i]++;
    else {
      setPen((p) => p.map((v, j) => (j === i ? v + 1 : v)));
      stats.why[i].rule = (stats.why[i].rule ?? 0) + 1;
      penaltyRule(i, item.segments);
    }
    play(item.lucky ? 'lucky' : 'pop');
    return item;
  };
  const finish = () => {
    clock.stop();
    onFinish(pen, round, stats);
  };

  const night2 = theme.night;
  const fg = night2 && phase !== 'batsu' && phase !== 'intro' ? '#f1e8ff' : pal.cardFg;
  const bg = night2 && phase !== 'batsu' && phase !== 'intro' ? '#1c1328' : undefined;
  const edge = night2 === 'shinya' ? C.deep : night2 ? C.night : undefined;
  const person = (i: number, label: string) => (
    <View style={s.person}>
      <View style={[s.dot, { backgroundColor: colorOf(i) }]}>
        <Text style={[s.dotText, iniFit(initialOf(members, i))]}>{initialOf(members, i)}</Text>
      </View>
      <Text style={[s.pName, { color: fg }]} numberOfLines={1}>{members[i].name}</Text>
      <Text style={[s.pLabel, { color: fg }]}>{label}</Text>
    </View>
  );
  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = <IntroCard pal={pal} mode="homeru" tag={`${SEC}秒`} />;
      controls = <BigButton onBack={onQuit} pal={pal} label="ルーレットで最初の人を決める" onPress={() => { setPicked(null); setPhase('roul'); }} />;
      break;
    case 'roul':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>最初に褒める人は…</Prog>
          <Roulette members={members} fg={fg} tick={() => play('tick')} onDone={(i) => { setPicked(i); setPraiser(i); play('coin'); }} />
          <Lead fg={fg}>{picked != null ? `${members[picked].name}から褒める！` : 'ルーレット中…'}</Lead>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={picked != null ? `${members[picked].name}から始める` : 'ルーレット中…'} disabled={picked == null} onPress={() => setup(picked ?? 0)} />;
      break;
    case 'ready':
    case 'go':
      card = (
        <ModeCard pal={pal} center bg={bg} edge={edge}>
          {phase === 'go' ? <Text style={[s.timer, { color: clock.left <= 10 ? '#ff3b3b' : fg }]}>{clock.left}</Text> : <Prog fg={fg}>{`第${round + 1}戦`}</Prog>}
          <View style={s.vs}>
            {person(praiser, '褒める')}
            <Text style={[s.arrow, { color: fg }]}>→</Text>
            {person(target, '耐える')}
          </View>
          <View style={[s.theme, { borderColor: alpha('#888888', 0.5) }]}>
            <Text style={[s.themeLabel, { color: fg }]}>褒めるところ</Text>
            <Text style={[s.themeText, { color: fg }]}>{theme.theme}</Text>
          </View>
          <Text style={[s.small, { color: fg, textAlign: 'center' }]}>{phase === 'go' ? `${members[target].name}、笑ったら負けやで` : `${members[target].name}は真顔で耐えろ`}</Text>
        </ModeCard>
      );
      controls =
        phase === 'ready' ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Outline label="相手を変える" fg={pal.fg} onPress={() => { const pool = othersOf(members, praiser).filter((x) => x !== target); if (pool.length) setTarget(pick(pool)); }} />
              <Outline label="テーマを変える" fg={pal.fg} onPress={() => setTheme(decks.homeru(night, okNight(praiser, target)))} />
            </View>
            <BigButton pal={pal} label={`スタート（${SEC}秒）`} onPress={() => { setPhase('go'); clock.start(SEC); play('coin'); }} />
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><BigButton pal={pal} danger label="笑った・照れた" onPress={() => lose(target)} /></View>
              <View style={{ flex: 1 }}><BigButton pal={pal} label="褒めるの限界" onPress={() => lose(praiser)} /></View>
            </View>
            <Text style={[s.hint, { color: pal.muted }]}>{`${SEC}秒耐えたら${members[praiser].name}に罰`}</Text>
          </View>
        );
      break;
    case 'batsu':
      card = (
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={[s.result, { color: pal.fg }]}>{loser === target ? `${members[target].name}が笑ってもうた！` : `${members[target].name}が耐え切った！`}</Text>
          <DeckStack pal={pal} minHeight={0}>
            <GachaCard pal={pal} members={members} items={gacha} />
          </DeckStack>
        </View>
      );
      controls = <BigButton pal={pal} label={`${gacha.every((x) => x.lucky) ? 'ラッキー！' : '受け入れた'} → 次は${members[(praiser + 1) % n].name}が褒める`} onPress={accept} />;
      break;
  }

  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      <View style={[s.wrap, flipped && { transform: [{ rotate: '180deg' }] }]}>
        <ScoreBar onEnd={finish} pal={pal} members={members} pen={pen} rev={Array(n).fill(false)} doer={phase === 'intro' ? -1 : praiser} onMenu={() => setMenu(true)} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
        <RuleBanner pal={pal} members={members} rules={rules} onViolate={(r) => { setRule(r); setRuleSheet('pick'); }} />
        <View style={{ flex: 1 }}>{card}</View>
        {controls}
      </View>
      <Frame color={phase === 'intro' ? C.muted : phase === 'batsu' && loser != null ? colorOf(loser) : colorOf(praiser)} />
      <HurryFrame on={hurry} />
      <RuleSheet members={members} rule={rule} state={ruleSheet} onPick={(i) => setRuleSheet(rulePenalty(i))} onClose={() => setRuleSheet(null)} />
      <RulesSheet visible={rulesOpen} custom={HELP.homeru.rules} onClose={() => setRulesOpen(false)} />
      <GameMenu
        visible={menu}
        meta={`褒め殺し・${LEVEL_LABEL[level]}・${round}回`}
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
  timer: { fontFamily: F.display, fontSize: 64, lineHeight: 74 },
  vs: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  person: { flex: 1, alignItems: 'center', gap: 6 },
  dot: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  dotText: { fontFamily: F.display, fontSize: 26, color: '#141210' },
  pName: { fontFamily: F.display, fontSize: 24, maxWidth: '100%' },
  pLabel: { fontSize: 12, fontWeight: '900', opacity: 0.7 },
  arrow: { fontFamily: F.display, fontSize: 26, opacity: 0.6 },
  theme: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  themeLabel: { fontSize: 11, fontWeight: '900', opacity: 0.6, letterSpacing: 2 },
  themeText: { fontSize: 18, fontWeight: '900' },
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
  result: { fontFamily: F.display, fontSize: 22, textAlign: 'center' },
});
