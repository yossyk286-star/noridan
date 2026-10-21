import { useEffect, useRef, useState } from "react";
import type React from "react";
import { HurryFrame } from '../components/Fx';
import { useHurry } from '../lib/useHurry';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Haptics } from '../lib/vibe';
import { useKeepAwake } from 'expo-keep-awake';
import { Tap } from '../components/Tap';
import { BigButton, DeckStack, Frame, GachaCard, RulesSheet, ScoreBar } from '../components/Stage';
import { RevealItem, useHold, useReveal } from '../components/Reveal';
import { HandWho, IntroCard, Lead, LevelBox, ModeCard, NameTiles, Note, Outline, Prog, WordList, Peek } from '../components/ModeParts';
import { HELP } from '../lib/help';
import { Skull, Angel } from '../components/Fx';
import GameMenu from '../components/GameMenu';
import { Decks } from '../lib/game';
import { load, save } from '../lib/storage';
import { play } from '../lib/sound';
import { newStats, type Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, alpha, colorOf } from '../theme';
import type { GachaItem, Level, Member, Night, Segment } from '../types';
import { batsuCue } from '../lib/fx';

type Props = {
  members: Member[];
  level: Level;
  night: Night;
  onQuit: () => void;
  onSettings: () => void;
  onFinish: (pen: number[], turns: number, stats: Stats, words: string[]) => void;
};
type Phase = 'setup' | 'hand' | 'look' | 'play' | 'who' | 'confirm' | 'out' | 'eyes' | 'newword' | 'over' | 'guess' | 'gres' | 'gbatsu';
const MINUTES = [3, 5, 10, 15, 0];
const NG_LV: Record<Level, string> = { yurume: 'たまにしか言わん言葉', futsu: 'そこそこ言う言葉', jigoku: '絶対言うてまう口ぐせ' };


const fmt = (ms: number) => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
const plain = (segs: Segment[]) => segs.map((x) => x.text).join('');

/** NGワード：自分以外のNGワードを覚えて、相手に言わせる。自分のワードは自分だけ知らん */
export default function NgWordScreen({ members, level, night, onQuit, onSettings, onFinish }: Props) {
  useKeepAwake();
  const pal = STAGE[level];
  const fg = pal.cardFg;
  const n = members.length;
  const decks = useRef(new Decks()).current;
  decks.night = night;
  decks.level = level;
  const [phase, setPhase] = useState<Phase>('setup');
  const [minutes, setMinutes] = useState(10);
  const [words, setWords] = useState<string[]>([]);
  const [viewer, setViewer] = useState(0);
  const [dealing, setDealing] = useState(false);
  const [out, setOut] = useState(0);
  const [res, setRes] = useState<{ lucky: boolean; text: string } | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [pen, setPen] = useState<number[]>(() => Array(n).fill(0));
  // タイムアップ後の自分のワード当て：当てたら勝ち、外したら罰
  const [gk, setGk] = useState(0);
  const [ghit, setGhit] = useState<boolean[]>([]);
  const [gacha, setGacha] = useState<GachaItem[]>([]);
  const H = useHold();
  const RV = useReveal();
  const stats = useRef<Stats>(newStats(n)).current;
  const [menu, setMenu] = useState(false);
  const [rules, setRules] = useState(false);
  const [flipped, setFlipped] = useState(false);
  // 時計：プレイ中だけ進む（見直し・アウト処理の間は止める）
  const left = useRef(0);
  const endAt = useRef(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    load<number>('nd_ng_min', 10).then(setMinutes);
  }, []);
  useEffect(() => {
    if (phase !== 'play' || !endAt.current) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= endAt.current) {
        endAt.current = 0;
        left.current = 0;
        setPhase('over');
        play('timeup');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
    }, 250);
    return () => clearInterval(t);
  }, [phase]);

  const resume = () => {
    endAt.current = minutes ? Date.now() + left.current : 0;
    setNow(Date.now());
    setPhase('play');
  };
  const pause = () => {
    if (endAt.current) left.current = Math.max(0, endAt.current - Date.now());
    endAt.current = 0;
  };
  const deal = () => {
    const w: string[] = [];
    members.forEach((m) => w.push(decks.ngWord(w, m)));
    setWords(w);
    left.current = minutes * 60000;
    setDealing(true);
    setViewer(0);
    setPhase('hand');
  };
  const nextLook = () => {
    if (dealing && viewer + 1 < n) {
      setViewer(viewer + 1);
      setPhase('hand');
    } else {
      setDealing(false);
      resume();
    }
  };
  const doOut = () => {
    const b = decks.batsu(members, out);
    setRes({ lucky: b.lucky, text: plain(b.segments) });
    if (b.lucky) stats.lucky[out]++;
    else {
      setPen((p) => p.map((v, i) => (i === out ? v + 1 : v)));
      stats.why[out].ng = (stats.why[out].ng || 0) + 1;
    }
    play(b.lucky ? 'lucky' : 'boom');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    setPhase('out');
  };
  const finish = (p: number[] = pen) => onFinish(p, p.reduce((a, b) => a + b, 0), stats, words);
  const judge = (hit: boolean) => {
    const g = ghit.slice();
    g[gk] = hit;
    setGhit(g);
    play(hit ? 'coin' : 'warn');
    if (gk + 1 < n) setGk(gk + 1);
    else H.hold('結果は…', 1600, () => { setPhase('gres'); RV.start(n); });
  };
  const guessGacha = () => {
    const lose = members.map((_, i) => i).filter((i) => !ghit[i]);
    const items = lose.map((i) => ({ i, n: 1, ...decks.batsu(members, i) }));
    setGacha(items);
    setPhase('gbatsu');
    batsuCue(items, members);
  };
  const guessEnd = () => {
    const np = pen.slice();
    gacha.forEach((x) => {
      if (x.lucky) stats.lucky[x.i]++;
      else {
        np[x.i] += 1;
        stats.why[x.i].ng = (stats.why[x.i].ng || 0) + 1;
      }
    });
    setPen(np);
    finish(np);
  };

  const remaining = endAt.current ? endAt.current - now : left.current;
  const hurry = useHurry(Math.ceil(remaining / 1000), phase === 'play' && !!endAt.current);
  const frame = ['hand', 'look'].includes(phase) ? colorOf(viewer) : ['confirm', 'out', 'eyes', 'newword'].includes(phase) ? colorOf(out) : C.muted;

  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'setup':
      card = (
        <IntroCard pal={pal} mode="ngword" tag={`${n}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」：${NG_LV[level]}`} note={night ? `${night === 'shinya' ? '深夜' : '夜'}モードのワードも出る` : undefined} />
          <Text style={[s.small, { color: fg, fontWeight: '900' }]}>制限時間</Text>
          <View style={s.mins}>
            {MINUTES.map((m) => {
              const on = minutes === m;
              return (
                <Tap key={m} onPress={() => { setMinutes(m); save('nd_ng_min', m); }} style={[s.min, { borderColor: alpha('#141210', 0.25) }, on && { backgroundColor: fg, borderColor: fg }]}>
                  <Text style={[s.minText, { color: on ? pal.cardBg : fg }]}>{m ? `${m}分` : 'なし'}</Text>
                </Tap>
              );
            })}
          </View>
        </IntroCard>
      );
      controls = <BigButton onBack={onQuit} pal={pal} label="ワードを配る" onPress={deal} />;
      break;
    case 'hand':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{dealing ? `ワード配り ${viewer + 1} / ${n}` : 'ワードの見直し'}</Prog>
          <HandWho members={members} i={viewer} sub="だけ見て" fg={fg} />
          <Note fg={fg}>{`スマホを${members[viewer].name}に渡して。\n他の人は画面を見たらアカン`}</Note>
        </ModeCard>
      );
      controls = (
        <View style={{ gap: 8 }}>
          <BigButton pal={pal} label={`${members[viewer].name}が見る`} onPress={() => setPhase('look')} />
          {!dealing && <Outline label="やっぱやめる" fg={pal.fg} onPress={resume} style={{ flex: 0 }} />}
        </View>
      );
      break;
    case 'look':
      card = (
        <ModeCard pal={pal}>
          <Text style={[s.lookHead, { color: fg }]}>{members[viewer].name}<Text style={s.lookSub}> 以外のNGワード</Text></Text>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: 14, paddingBottom: 4 }}>
            <Peek fg={fg}>
              <WordList members={members} words={words} skip={viewer} fg={fg} big={n <= 5} compact={n > 5} />
            </Peek>
            <Text style={[s.small, { color: fg }]}>自分のワードはここに出えへん。覚えたら指を離してな</Text>
          </ScrollView>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={!dealing ? '覚えた、隠す' : viewer + 1 < n ? `覚えた → ${members[viewer + 1].name}に渡す` : '覚えた → スタート'} onPress={nextLook} />;
      break;
    case 'play':
    case 'who':
      card = (
        <ModeCard pal={pal} center>
          <Text style={[s.timer, { color: minutes && remaining < 30000 ? '#ff3b3b' : fg }, !minutes && { opacity: 0.5 }]}>{minutes ? fmt(remaining) : '∞'}</Text>
          <Lead fg={fg}>{'相手にNGワードを\n言わせろ！'}</Lead>
          {!!topic && (
            <View style={[s.topic, { borderColor: alpha('#141210', 0.3) }]}>
              <Text style={[s.topicLabel, { color: fg }]}>話題</Text>
              <Text style={[s.topicText, { color: fg }]}>{topic}</Text>
            </View>
          )}
        </ModeCard>
      );
      controls =
        phase === 'play' ? (
          <View style={{ gap: 10 }}>
            <Text style={[s.q, { color: pal.fg }]}>言うてもうたのは？<Text style={{ color: pal.muted, fontSize: 12 }}>　タップでアウト</Text></Text>
            <NameTiles members={members} list={members.map((_, i) => i)} fg={pal.fg} count={(i) => `アウト${pen[i]}`} onPress={(i) => { pause(); setOut(i); setPhase('confirm'); play('warn'); }} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Outline label="ワードを見直す" fg={pal.fg} onPress={() => { pause(); setPhase('who'); }} />
              <Outline label="話題を出す" fg={pal.fg} onPress={() => setTopic(decks.ngTopic())} />
            </View>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Text style={[s.q, { color: pal.muted, fontSize: 12 }]}>誰がワードを見直す？</Text>
            <NameTiles members={members} list={members.map((_, i) => i)} fg={pal.fg} onPress={(i) => { setViewer(i); setPhase('hand'); }} />
            <Outline label="やめる" fg={pal.fg} onPress={resume} style={{ flex: 0 }} />
          </View>
        );
      break;
    case 'confirm':
      card = (
        <ModeCard pal={pal} center>
          <HandWho members={members} i={out} fg={fg} />
          <Lead fg={fg}>NGワード、言うた？</Lead>
          <Note fg={fg}>{`アウトにしたら、${members[out].name}のワードを発表する`}</Note>
        </ModeCard>
      );
      controls = (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><BigButton pal={pal} label="言うてない" onPress={resume} /></View>
          <View style={{ flex: 1 }}><BigButton pal={pal} label="アウト！" danger onPress={doOut} /></View>
        </View>
      );
      break;
    case 'out':
      card = (
        <ModeCard pal={pal} center bg={res?.lucky ? '#eef6ff' : '#1a0606'} edge={res?.lucky ? C.yuru : '#e8202a'}>
          <Prog fg={res?.lucky ? '#1c2a4a' : '#fff'}>{`${members[out].name} アウト！`}</Prog>
          <Text style={[s.small, { color: res?.lucky ? '#1c2a4a' : '#fff', textAlign: 'center' }]}>NGワードは</Text>
          <Text style={[s.reveal, { color: res?.lucky ? '#1c2a4a' : '#fff', textAlign: 'center' }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.5}>「{words[out]}」</Text>
          {res?.lucky ? <Angel /> : <Skull />}
          <Text style={[s.pen, { color: res?.lucky ? '#1c2a4a' : '#fff' }]}>{res?.text}</Text>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={`${res?.lucky ? 'ラッキー！' : '受け入れた'} → 新しいワードを配る`} onPress={() => setPhase('eyes')} />;
      break;
    case 'eyes':
      card = (
        <ModeCard pal={pal} center>
          <HandWho members={members} i={out} sub="は目をつぶれ！" fg={fg} />
          <Note fg={fg}>{`${members[out].name}の新しいNGワードを、\n${members[out].name}以外の全員で見る`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={`${members[out].name}以外で見る`} onPress={() => { setWords((w) => w.map((x, i) => (i === out ? decks.ngWord(w, members[out]) : x))); setPhase('newword'); }} />;
      break;
    case 'newword':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`${members[out].name}の新しいNGワード`}</Prog>
          <Text style={[s.reveal, { color: fg, textAlign: 'center' }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.5}>「{words[out]}」</Text>
          <Note fg={fg}>{`${members[out].name}には見せたらアカン`}</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="見た、隠す → 再開" onPress={resume} />;
      break;
    case 'over':
      card = (
        <ModeCard pal={pal} center>
          <Text style={[s.timer, { color: fg }]}>0:00</Text>
          <Lead fg={fg}>タイムアップ！</Lead>
          <Note fg={fg}>{'最後に自分のNGワード当てタイム。\n自分のワードを当てたら勝ち、外したら罰'}</Note>
        </ModeCard>
      );
      controls = (
        <View style={{ gap: 8 }}>
          <BigButton pal={pal} label="自分のワード当てタイム" onPress={() => { setGk(0); setGhit(Array(n).fill(false)); setPhase('guess'); }} />
          <Outline label="当てずに結果発表" fg={pal.fg} onPress={() => finish()} />
        </View>
      );
      break;
    case 'guess':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`自分のワード当て ${gk + 1} / ${n}`}</Prog>
          <HandWho members={members} i={gk} sub="の番" fg={fg} />
          <Lead fg={fg}>{'自分のNGワードは\n何やと思う？'}</Lead>
          <Note fg={fg}>声に出して答えて。合ってるかは他のみんなが判定</Note>
        </ModeCard>
      );
      controls = (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><BigButton pal={pal} danger label="ハズレ（罰）" onPress={() => judge(false)} /></View>
          <View style={{ flex: 1 }}><BigButton pal={pal} label="当たり！（勝ち）" onPress={() => judge(true)} /></View>
        </View>
      );
      break;
    case 'gres': {
      const all = ghit.every(Boolean);
      card = (
        <Tap style={{ flex: 1 }} onPress={RV.skip} haptic={false} scaleTo={1}>
          <ModeCard pal={pal} center>
            <Prog fg={fg}>ワード当ての結果</Prog>
            <ScrollView style={{ alignSelf: 'stretch', flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ gap: 6 }}>
              {members.map((m, i) => (
                <RevealItem key={i} k={i} rv={RV} lose={!ghit[i]}>
                  <View style={[s.gRow, { borderLeftColor: colorOf(i), backgroundColor: ghit[i] ? 'rgba(31,157,85,0.12)' : 'rgba(255,59,59,0.12)' }]}>
                    <Text style={[s.gName, { color: ghit[i] ? fg : '#e8202a' }]} numberOfLines={1}>{m.name}</Text>
                    <Text style={[s.gWord, { color: fg }]}>{`「${words[i]}」`}</Text>
                    <Text style={[s.gRes, { color: ghit[i] ? '#1f9d55' : '#e8202a' }]}>{ghit[i] ? '当てた！' : '外した'}</Text>
                  </View>
                </RevealItem>
              ))}
            </ScrollView>
            {RV.ready && <Note fg={fg}>{all ? '全員当てた！罰なし' : `外した${members.filter((_, i) => !ghit[i]).map((x) => x.name).join('・')}に罰`}</Note>}
          </ModeCard>
        </Tap>
      );
      controls = !RV.ready ? <Text style={[s.hint, { color: pal.muted }]}>タップで飛ばす</Text> : all ? <BigButton pal={pal} label="結果発表" onPress={() => finish()} /> : <BigButton pal={pal} danger label="外した人に罰ガチャ" onPress={guessGacha} />;
      break;
    }
    case 'gbatsu':
      card = (
        <DeckStack pal={pal} minHeight={0}>
          <GachaCard pal={pal} members={members} items={gacha} />
        </DeckStack>
      );
      controls = <BigButton pal={pal} label={`${gacha.every((x) => x.lucky) ? 'ラッキー！' : '受け入れた'} → 結果発表`} onPress={guessEnd} />;
      break;
  }

  // ため（ドラムロール）の間は結果を出さへん
  const hv = H.view(pal);
  if (hv) { card = hv.card; controls = hv.controls; }
  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      <View style={[s.wrap, flipped && { transform: [{ rotate: '180deg' }] }]}>
        <ScoreBar onEnd={() => finish()} pal={pal} members={members} pen={pen} rev={Array(n).fill(false)} doer={-1} onMenu={() => setMenu(true)} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
        <View style={{ flex: 1 }}>{card}</View>
        {controls}
      </View>
      <Frame color={frame} />
      <HurryFrame on={hurry} />
      <RulesSheet visible={rules} custom={HELP.ngword.rules} onClose={() => setRules(false)} />
      <GameMenu
        visible={menu}
        meta={`NGワード・${LEVEL_LABEL[level]}・アウト${pen.reduce((a, b) => a + b, 0)}回`}
        rulesSub="このモードの遊び方"
        flipped={flipped}
        onFlip={() => setFlipped((f) => !f)}
        onRules={() => setRules(true)}
        onEnd={() => finish()}
        onSettings={onSettings}
        onQuit={onQuit}
        onClose={() => setMenu(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  gRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderLeftWidth: 4 },
  gName: { width: 70, fontSize: 15, fontWeight: '800' },
  gWord: { flex: 1, fontSize: 16, fontWeight: '700' },
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
  gRes: { fontSize: 13, fontWeight: '900' },
  title: { fontFamily: F.display, fontSize: 24 },
  how: { fontSize: 17, fontWeight: '700', lineHeight: 26 },
  small: { fontSize: 12, fontWeight: '700', opacity: 0.65, lineHeight: 18 },
  mins: { flexDirection: 'row', gap: 6 },
  min: { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  lvBox: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, gap: 2 },
  lvText: { fontSize: 14, fontWeight: '900' },
  minText: { fontWeight: '900', fontSize: 15 },
  lookHead: { fontFamily: F.display, fontSize: 22 },
  lookSub: { fontFamily: undefined, fontSize: 13, fontWeight: '900' },
  timer: { fontFamily: F.display, fontSize: 80, lineHeight: 92, fontVariant: ['tabular-nums'] },
  topic: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  topicLabel: { fontSize: 11, fontWeight: '900', opacity: 0.6, letterSpacing: 2 },
  topicText: { fontSize: 17, fontWeight: '900' },
  q: { fontSize: 15, fontWeight: '900' },
  reveal: { fontFamily: F.display, fontSize: 40, textAlign: 'center' },
  pen: { fontFamily: F.display, fontSize: 19, lineHeight: 28, textAlign: 'center' },
});
