import { useRef, useState } from 'react';
import type React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, DeckStack, Frame, GachaCard, RulesSheet, ScoreBar } from '../components/Stage';
import { HandWho, ModeCard, NameTiles, Note, Outline, Prog } from '../components/ModeParts';
import GameMenu from '../components/GameMenu';
import { Decks } from '../lib/game';
import { play } from '../lib/sound';
import { usePrefs } from '../lib/prefs';
import { speak } from '../lib/speech';
import { newStats, type Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, alpha, colorOf, neonPal } from '../theme';
import type { GachaItem, Level, Member, Night } from '../types';
import itoJson from '../data/ito.json';

type Props = {
  members: Member[];
  level: Level;
  night: Night;
  onQuit: () => void;
  onSettings: () => void;
  onFinish: (pen: number[], turns: number, stats: Stats) => void;
};
type Topic = { t: string; lo: string; hi: string };
type Phase = 'intro' | 'hand' | 'look' | 'talk' | 'who' | 'order' | 'reveal' | 'batsu';
const TOPICS = itoJson as unknown as Record<string, Topic[]>;

export const ITO_RULES: [string, string][] = [
  ['数字', 'スマホを回して、1人ずつ自分だけの数字（1〜100）を見る。被りはなし'],
  ['表現', 'お題（例：怖いもの）に合わせて、自分の数字っぽいものを1人ずつ言う。数字をそのまま言うのは反則'],
  ['並べる', '話し合って、数字が小さい順に名前をタップ'],
  ['答え合わせ', '隣どうしで順番が逆になってた2人が罰ガチャ。全員合ってたら全員セーフ'],
  ['忘れた時', '「数字を見直す」→自分の名前を選ぶと、もう一回見られる'],
];

const shuffle = <T,>(a: T[]): T[] => {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

/** 価値観ナンバー：こっそり配られた数字をお題で表現して、全員で小さい順に並べる。順番が逆になってた2人が罰 */
export default function ItoScreen({ members, level, night, onQuit, onSettings, onFinish }: Props) {
  useKeepAwake();
  const n = members.length;
  const decks = useRef(new Decks()).current;
  decks.night = night;
  decks.level = level;
  const topicDecks = useRef<Record<string, Topic[]>>({}).current;
  const { voice } = usePrefs();
  const drawTopic = (key: string) => {
    if (!topicDecks[key]?.length) topicDecks[key] = shuffle(TOPICS[key]);
    return topicDecks[key].pop()!;
  };
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [topic, setTopic] = useState<Topic>({ t: '', lo: '', hi: '' });
  const [nightQ, setNightQ] = useState<false | 'yoru' | 'shinya'>(false);
  const [nums, setNums] = useState<number[]>([]);
  const [viewer, setViewer] = useState(0);
  const [seen, setSeen] = useState(0);
  const [dealing, setDealing] = useState(true);
  const [order, setOrder] = useState<number[]>([]);
  const [bad, setBad] = useState<number[]>([]);
  const [pen, setPen] = useState<number[]>(() => Array(n).fill(0));
  const [done, setDone] = useState(0);
  const [gacha, setGacha] = useState<GachaItem[]>([]);
  const stats = useRef<Stats>(newStats(n)).current;
  const [menu, setMenu] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const newRound = () => {
    const r = round + 1;
    setRound(r);
    let key: string = level;
    if (night && !members.some((m) => m.ng) && Math.random() < (night === 'shinya' ? 0.6 : 0.3)) key = night === 'shinya' && Math.random() < 0.6 ? 'shinya' : 'yoru';
    setNightQ(key === 'yoru' || key === 'shinya' ? key : false);
    setTopic(drawTopic(key));
    setNums(shuffle(Array.from({ length: 100 }, (_, i) => i + 1)).slice(0, n));
    setOrder([]);
    setBad([]);
    setDealing(true);
    setViewer((r - 1) % n);
    setSeen(0);
    setGacha([]);
    setPhase('hand');
  };
  const nextLook = () => {
    if (dealing && seen + 1 < n) {
      setSeen(seen + 1);
      setViewer((viewer + 1) % n);
      setPhase('hand');
    } else {
      setDealing(false);
      setPhase('talk');
      if (voice) speak(`お題は、${topic.t}`);
    }
  };
  const check = () => {
    const b = new Set<number>();
    for (let k = 1; k < order.length; k++) if (nums[order[k - 1]] > nums[order[k]]) { b.add(order[k - 1]); b.add(order[k]); }
    setBad([...b]);
    setDone(done + 1);
    setPhase('reveal');
    play(b.size ? 'warn' : 'fanfare');
    Haptics.notificationAsync(b.size ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success).catch(() => {});
  };
  const doGacha = () => {
    const items = bad.map((i) => ({ i, n: 1, ...decks.batsu(members, i) }));
    setGacha(items);
    setPhase('batsu');
    play(items.every((x) => x.lucky) ? 'lucky' : 'pop');
  };
  const accept = () => {
    const np = pen.slice();
    gacha.forEach((x) => {
      if (x.lucky) stats.lucky[x.i]++;
      else {
        np[x.i] += x.n;
        stats.why[x.i].ito = (stats.why[x.i].ito ?? 0) + x.n;
      }
    });
    setPen(np);
    newRound();
  };
  const finish = () => onFinish(pen, done, stats);

  const pal = nightQ && phase !== 'batsu' && phase !== 'intro' ? neonPal(nightQ === 'shinya' ? C.deep : C.night) : STAGE[level];
  const fg = pal.cardFg;
  const scale = (
    <View style={s.scale}>
      <View style={s.scaleEnd}>
        <Text style={[s.scaleNum, { color: fg }]}>1</Text>
        <Text style={[s.scaleText, { color: fg }]}>{topic.lo}</Text>
      </View>
      <View style={[s.scaleBar, { backgroundColor: alpha('#888888', 0.4) }]} />
      <View style={s.scaleEnd}>
        <Text style={[s.scaleNum, { color: fg }]}>100</Text>
        <Text style={[s.scaleText, { color: fg }]}>{topic.hi}</Text>
      </View>
    </View>
  );
  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <ModeCard pal={pal}>
          <Text style={[s.title, { color: fg }]}>価値観ナンバー</Text>
          <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
            <Text style={[s.how, { color: fg }]}>1. スマホを回して、1人ずつ自分だけの数字（1〜100）をこっそり見る</Text>
            <Text style={[s.how, { color: fg }]}>2. お題（例：怖いもの）に合わせて、自分の数字っぽいものを1人ずつ言う。数字が大きいほど怖いもの</Text>
            <Text style={[s.how, { color: fg }]}>3. 話し合って、数字が小さい順に並べる</Text>
            <Text style={[s.how, { color: fg }]}>4. 答え合わせで、順番が逆になってた2人が罰。全員合ってたら全員セーフ</Text>
            <Text style={[s.small, { color: fg }]}>数字をそのまま言うのは反則。忘れたら「数字を見直す」でいつでも見られる</Text>
            <View style={[s.lvBox, { backgroundColor: alpha(pal.cardEdge, 0.16) }]}>
              <Text style={[s.lvText, { color: fg }]}>地獄度「{LEVEL_LABEL[level]}」のお題</Text>
              {!!night && <Text style={[s.small, { color: fg }]}>{night === 'shinya' ? '深夜' : '夜'}モードのお題も混ざる{members.some((m) => m.ng) ? '（下ネタNGの人がおるので今回は混ぜへん）' : ''}</Text>}
            </View>
          </View>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="数字を配る" onPress={newRound} />;
      break;
    case 'hand':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{dealing ? `数字配り ${seen + 1} / ${n}` : '数字の見直し'}</Prog>
          <HandWho members={members} i={viewer} sub="だけ見て" fg={fg} />
          <Note fg={fg}>{`スマホを${members[viewer].name}に渡して。\n他の人は画面を見たらアカン`}</Note>
        </ModeCard>
      );
      controls = (
        <View style={{ gap: 8 }}>
          <BigButton pal={pal} label={`${members[viewer].name}が見る`} onPress={() => setPhase('look')} />
          {!dealing && <Outline label="やっぱやめる" fg={pal.fg} onPress={() => setPhase('talk')} style={{ flex: 0 }} />}
        </View>
      );
      break;
    case 'look':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`${members[viewer].name}の数字`}</Prog>
          <Text style={[s.num, { color: fg }]}>{nums[viewer]}</Text>
          <Text style={[s.topicSmall, { color: fg }]}>お題：{topic.t}</Text>
          {scale}
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={!dealing ? '覚えた、隠す' : seen + 1 < n ? `覚えた → ${members[(viewer + 1) % n].name}に渡す` : '覚えた → スタート'} onPress={nextLook} />;
      break;
    case 'talk':
    case 'who':
      card = (
        <ModeCard pal={pal}>
          <Text style={[s.title, { color: fg }]}>第{round}問{nightQ ? `（${nightQ === 'shinya' ? '深夜' : '夜'}のお題）` : ''}</Text>
          <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
            <Text style={[s.big, { color: fg }]}>{topic.t}</Text>
            {scale}
            <Text style={[s.small, { color: fg, textAlign: 'center' }]}>1人ずつ、自分の数字っぽい「{topic.t}」を言え。数字は言うたらアカン</Text>
          </View>
        </ModeCard>
      );
      controls =
        phase === 'talk' ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Outline label="数字を見直す" fg={pal.fg} onPress={() => setPhase('who')} />
              <Outline label="お題を変える" fg={pal.fg} onPress={() => setTopic(drawTopic(nightQ || level))} />
            </View>
            <BigButton pal={pal} label="言い終わった → 並べる" onPress={() => setPhase('order')} />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Text style={[s.small, { color: pal.muted }]}>誰が数字を見直す？</Text>
            <NameTiles members={members} list={members.map((_, i) => i)} fg={pal.fg} onPress={(i) => { setViewer(i); setPhase('hand'); }} />
            <Outline label="やめる" fg={pal.fg} onPress={() => setPhase('talk')} style={{ flex: 0 }} />
          </View>
        );
      break;
    case 'order': {
      const left = members.map((_, i) => i).filter((i) => !order.includes(i));
      card = (
        <ModeCard pal={pal}>
          <Text style={[s.title, { color: fg }]}>小さい順に並べる</Text>
          <Text style={[s.small, { color: fg }]}>お題：{topic.t}</Text>
          <ScrollView contentContainerStyle={{ gap: 6 }} style={{ flex: 1 }}>
            {order.map((i, k) => (
              <View key={i} style={[s.line, { borderLeftColor: colorOf(i), backgroundColor: alpha('#888888', 0.12) }]}>
                <Text style={[s.lineNo, { color: fg }]}>{k + 1}</Text>
                <Text style={[s.lineName, { color: fg }]} numberOfLines={1}>{members[i].name}</Text>
              </View>
            ))}
            {left.length > 0 && (
              <View style={[s.line, s.lineEmpty, { borderColor: alpha('#888888', 0.5) }]}>
                <Text style={[s.lineNo, { color: fg }]}>{order.length + 1}</Text>
                <Text style={[s.lineName, { color: fg, opacity: 0.7, fontWeight: '700' }]}>{order.length ? '次に小さい人をタップ' : '一番小さい人をタップ'}</Text>
              </View>
            )}
          </ScrollView>
          <NameTiles members={members} list={left} fg={fg} cols={2} onPress={(i) => { setOrder([...order, i]); play('tick'); }} />
        </ModeCard>
      );
      controls =
        left.length === 0 ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Outline label="1つ戻す" fg={pal.fg} onPress={() => setOrder(order.slice(0, -1))} />
              <Outline label="やり直す" fg={pal.fg} onPress={() => setOrder([])} />
            </View>
            <BigButton pal={pal} label="この順で答え合わせ" onPress={check} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Outline label="1つ戻す" fg={pal.fg} onPress={() => setOrder(order.slice(0, -1))} />
            <Outline label="お題に戻る" fg={pal.fg} onPress={() => setPhase('talk')} />
          </View>
        );
      break;
    }
    case 'reveal':
      card = (
        <ModeCard pal={pal}>
          <Text style={[s.title, { color: fg }]}>答え合わせ</Text>
          <Text style={[s.small, { color: fg }]}>お題：{topic.t}</Text>
          <ScrollView contentContainerStyle={{ gap: 6 }} style={{ flex: 1 }}>
            {order.map((i, k) => (
              <View key={i} style={[s.line, { borderLeftColor: colorOf(i), backgroundColor: bad.includes(i) ? 'rgba(255,59,59,0.14)' : alpha('#888888', 0.12) }]}>
                <Text style={[s.lineNo, { color: fg }]}>{k + 1}</Text>
                <Text style={[s.lineName, { color: fg }]} numberOfLines={1}>{members[i].name}</Text>
                <Text style={[s.lineNum, { color: bad.includes(i) ? '#ff3b3b' : fg }]}>{nums[i]}</Text>
              </View>
            ))}
          </ScrollView>
          <Text style={[s.verdict, bad.length ? s.verdictBad : s.verdictGood]}>{bad.length ? `順番が逆：${bad.map((i) => members[i].name).join('・')}に罰` : '完璧！全員セーフ'}</Text>
        </ModeCard>
      );
      controls = bad.length ? <BigButton pal={pal} danger label={`${bad.map((i) => members[i].name).join('・')}に罰ガチャ`} onPress={doGacha} /> : <BigButton pal={pal} label="次のお題へ" onPress={newRound} />;
      break;
    case 'batsu':
      card = (
        <DeckStack pal={pal} minHeight={0}>
          <GachaCard pal={pal} members={members} items={gacha} />
        </DeckStack>
      );
      controls = <BigButton pal={pal} label={`${gacha.every((x) => x.lucky) ? 'ラッキー！' : '受け入れた'} → 次のお題へ`} onPress={accept} />;
      break;
  }

  const frame = phase === 'hand' || phase === 'look' ? colorOf(viewer) : C.muted;
  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      <View style={[s.wrap, flipped && { transform: [{ rotate: '180deg' }] }]}>
        <ScoreBar pal={pal} members={members} pen={pen} rev={Array(n).fill(false)} doer={-1} onMenu={() => setMenu(true)} />
        <View style={{ flex: 1 }}>{card}</View>
        {controls}
      </View>
      <Frame color={frame} />
      <RulesSheet visible={rulesOpen} custom={ITO_RULES} onClose={() => setRulesOpen(false)} />
      <GameMenu
        visible={menu}
        meta={`価値観ナンバー・${LEVEL_LABEL[level]}・${done}問`}
        rulesSub="このモードの遊び方"
        flipped={flipped}
        onFlip={() => setFlipped((f) => !f)}
        onRules={() => setRulesOpen(true)}
        onEnd={finish}
        onSettings={onSettings}
        onQuit={onQuit}
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
  num: { fontFamily: F.display, fontSize: 120, lineHeight: 132 },
  topicSmall: { fontSize: 18, fontWeight: '900' },
  big: { fontFamily: F.display, fontSize: 36, lineHeight: 46, textAlign: 'center' },
  scale: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  scaleEnd: { alignItems: 'center', maxWidth: 110 },
  scaleNum: { fontFamily: F.display, fontSize: 22 },
  scaleText: { fontSize: 13, fontWeight: '900', textAlign: 'center' },
  scaleBar: { flex: 1, height: 6, borderRadius: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, borderLeftWidth: 6 },
  lineEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderLeftWidth: 1.5 },
  lineNo: { width: 22, fontWeight: '900', opacity: 0.55 },
  lineName: { flex: 1, fontWeight: '900', fontSize: 16 },
  lineNum: { fontFamily: F.display, fontSize: 24 },
  verdict: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, fontSize: 13, fontWeight: '900', overflow: 'hidden' },
  verdictBad: { backgroundColor: 'rgba(255,59,59,0.14)', color: '#ff3b3b' },
  verdictGood: { backgroundColor: 'rgba(60,180,110,0.18)', color: '#2fbf6f' },
});
