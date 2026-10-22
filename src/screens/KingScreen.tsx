import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, DeckStack, GachaCard, RoundEnd } from '../components/Stage';
import { HandWho, IntroCard, LevelBox, ModeCard, Note, Outline, Peek, Prog } from '../components/ModeParts';
import { StageShell, usePenalty } from '../components/StageShell';
import { HELP } from '../lib/help';
import { sexPrefer, pick, shuffle } from '../lib/game';
import { play } from '../lib/sound';
import type { Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, colorOf } from '../theme';
import type { Level, Member, Night } from '../types';
import kingJson from '../data/king.json';

type Props = { members: Member[]; level: Level; night: Night; onQuit: () => void; onSettings: () => void; onFinish: (pen: number[], turns: number, stats: Stats) => void; skipIntro?: boolean };
type Phase = 'intro' | 'deal' | 'call' | 'order' | 'open' | 'batsu';
type Kind = 'normal' | 'yoru' | 'shinya';
type Cmd = { tpl: string; kind: Kind; A: number; B: number | null };
const K = kingJson as unknown as Record<Kind, string[]>;

/**
 * 王様ゲーム：1人ずつ長押しで番号を見る（1人だけ王様）。王様だーれだ！→ 命令（アプリのおすすめ or 自分で）→ 番号を公開。
 * できへんかった人は罰ガチャ。夜モードなら夜・深夜の命令も（深夜の触れ合う系は下ネタNGの人を選ばへん・なるべく男女）
 */
export default function KingScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const n = members.length;
  const P = usePenalty(members, level, night, 'king');
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [k, setK] = useState(0);
  const [king, setKing] = useState(0);
  const [num, setNum] = useState<number[]>(() => Array(n).fill(0));
  const [cmd, setCmd] = useState<Cmd | null>(null);
  const [refuse, setRefuse] = useState<number[]>([]);
  const [turns, setTurns] = useState(0);
  const kings = useRef<number[]>(Array(n).fill(0)).current;
  useEffect(() => {
    if (skipIntro) deal();
  }, []);

  const deal = () => {
    const order = shuffle(members.map((_, i) => i));
    const nu = Array(n).fill(0);
    order.slice(1).forEach((i, j) => (nu[i] = j + 1));
    setRound((r) => r + 1);
    setKing(order[0]);
    setNum(nu);
    setK(0);
    setCmd(null);
    setRefuse([]);
    setPhase('deal');
  };
  const whoOf = (no: number) => num.findIndex((v, i) => v === no && i !== king);
  const pickCmd = (kg = king, nu = num) => {
    const nums = members.map((_, i) => i).filter((i) => i !== kg);
    const r = Math.random();
    let kind: Kind = night === 'shinya' ? (r < 0.5 ? 'shinya' : r < 0.75 ? 'yoru' : 'normal') : night === 'yoru' ? (r < 0.35 ? 'yoru' : 'normal') : 'normal';
    let pool = nums;
    if (kind !== 'normal') {
      pool = nums.filter((i) => !members[i].ng);
      if (pool.length < 2) {
        kind = 'normal';
        pool = nums;
      }
    }
    const two = pool.length >= 2;
    const tpl = pick(K[kind].filter((t) => two || !t.includes('{B}')));
    const a = pick(pool);
    const b = two ? (kind === 'shinya' ? pick(sexPrefer(members, a, pool.filter((i) => i !== a))) : pick(pool.filter((i) => i !== a))) : -1;
    setCmd({ tpl, kind, A: nu[a], B: b >= 0 ? nu[b] : null });
  };
  const text = (c: Cmd) => c.tpl.replace(/\{A\}/g, String(c.A)).replace(/\{B\}/g, String(c.B ?? ''));
  const finish = (p: number[] = P.pen) => {
    P.stats.kingCount = kings.slice();
    onFinish(p, turns, P.stats);
  };

  const pal = STAGE[level];
  const fg = pal.cardFg;
  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="king" tag={`${n}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」${night ? `：${night === 'shinya' ? '深夜' : '夜'}の命令も出る` : ''}`} />
        </IntroCard>
      );
      controls = <BigButton onBack={onQuit} pal={pal} label="番号を配る" onPress={deal} />;
      break;
    case 'deal':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`番号を配る・${k + 1}/${n}人目`}</Prog>
          <HandWho members={members} i={k} sub="だけ見て" fg={fg} />
          <Note fg={fg}>長押しで自分の番号を見て、覚えたら次の人へ</Note>
          <Peek fg={fg}>
            {k === king ? <Text style={[s.big, { color: '#e8b52a' }]}>王様</Text> : <Text style={[s.big, { color: fg }]}>{num[k]}<Text style={s.bigSub}> 番</Text></Text>}
          </Peek>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label={k + 1 < n ? `覚えた → ${members[k + 1].name}に渡す` : '覚えた → 王様だーれだ！'} onPress={() => (k + 1 < n ? setK(k + 1) : (setPhase('call'), play('drumroll')))} />;
      break;
    case 'call':
      card = (
        <ModeCard pal={pal} center>
          <Text style={[s.call, { color: fg }]}>{'せーの\n王様だーれだ！'}</Text>
          <Note fg={fg}>みんなで言ってから、王様が名乗り出る</Note>
        </ModeCard>
      );
      controls = <BigButton pal={pal} label="王様を見る" onPress={() => { kings[king]++; pickCmd(); setPhase('order'); play('fanfare'); }} />;
      break;
    case 'order':
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{`第${round}回`}</Prog>
          <Text style={[s.king, { color: fg }]}>{`👑 ${members[king].name}が王様！`}</Text>
          {cmd ? (
            <>
              <Text style={[s.small, { color: fg }]}>おすすめの命令</Text>
              <Text style={[s.cmd, { color: fg }]}>{text(cmd)}</Text>
            </>
          ) : (
            <Text style={[s.cmd, { color: fg }]}>{'王様が自由に命令して\n「◯番が○○」「◯番と◯番が○○」'}</Text>
          )}
          <Note fg={fg}>{'王様が大きい声で命令を読み上げて。\n番号の人はまだ名乗らんといて'}</Note>
        </ModeCard>
      );
      controls = (
        <View style={{ gap: 8 }}>
          <View style={s.row}>
            <Outline label="別の命令" fg={pal.fg} onPress={() => pickCmd()} style={{ flex: 1 }} />
            <Outline label={cmd ? '自分で考える' : 'おすすめを出す'} fg={pal.fg} onPress={() => (cmd ? setCmd(null) : pickCmd())} style={{ flex: 1 }} />
          </View>
          <BigButton pal={pal} label="番号を公開" onPress={() => { setPhase('open'); setTurns((t) => t + 1); play('pop'); }} />
        </View>
      );
      break;
    case 'open': {
      const nos = cmd ? [cmd.A, cmd.B].filter((x): x is number => x != null) : num.filter((v, i) => i !== king).sort((a, b) => a - b);
      const cand = cmd ? nos.map(whoOf) : members.map((_, i) => i).filter((i) => i !== king);
      card = (
        <ModeCard pal={pal} center>
          <Prog fg={fg}>{cmd ? text(cmd) : '番号の答え'}</Prog>
          <View style={{ gap: 6, width: '100%' }}>
            {nos.map((no) => {
              const w = whoOf(no);
              return (
                <View key={no} style={[s.item, { borderLeftColor: colorOf(w) }]}>
                  <Text style={[s.no, { color: fg }]}>{no}番</Text>
                  <Text style={[s.nm, { color: fg }]}>{members[w]?.name}</Text>
                </View>
              );
            })}
          </View>
          <Note fg={fg}>命令を実行！できへんかった人は下で選んで罰ガチャ</Note>
          <View style={s.chips}>
            {cand.map((w) => {
              const on = refuse.includes(w);
              return (
                <Pressable key={w} onPress={() => setRefuse(on ? refuse.filter((x) => x !== w) : [...refuse, w])} style={[s.chip, { borderColor: colorOf(w) }, on && { backgroundColor: '#e8202a', borderColor: '#e8202a' }]}>
                  <Text style={[s.chipT, { color: on ? '#fff' : fg }]}>{members[w].name}</Text>
                </Pressable>
              );
            })}
          </View>
        </ModeCard>
      );
      controls = refuse.length ? (
        <BigButton pal={pal} danger label={`できへんかった${refuse.map((i) => members[i].name).join('・')}に罰ガチャ`} onPress={() => { P.draw(refuse); setPhase('batsu'); }} />
      ) : (
        <RoundEnd pal={pal} next="もう1回" onNext={deal} onEnd={() => finish()} />
      );
      break;
    }
    case 'batsu':
      card = (
        <DeckStack pal={pal} minHeight={0}>
          <GachaCard pal={pal} members={members} items={P.gacha} />
        </DeckStack>
      );
      controls = <RoundEnd pal={pal} next={P.lucky ? 'ラッキー！もう1回' : '受け入れてもう1回'} onNext={() => { P.apply(); deal(); }} onEnd={() => finish(P.apply())} />;
      break;
  }
  return (
    <StageShell
      pal={pal} members={members} pen={P.pen} doer={phase === 'deal' ? k : phase === 'order' ? king : -1} frame={phase === 'intro' ? C.muted : phase === 'deal' ? colorOf(k) : colorOf(king)}
      rules={HELP.king.rules} meta={`王様ゲーム・${LEVEL_LABEL[level]}・${round}回`} onEnd={() => finish()} onQuit={onQuit} onSettings={onSettings} card={card} controls={controls}
    />
  );
}

const s = StyleSheet.create({
  big: { fontFamily: F.display, fontSize: 64, lineHeight: 72, textAlign: 'center' },
  bigSub: { fontSize: 22 },
  call: { fontFamily: F.display, fontSize: 40, lineHeight: 52, textAlign: 'center' },
  king: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  small: { fontSize: 12, fontWeight: '800', opacity: 0.6 },
  cmd: { fontFamily: F.display, fontSize: 24, lineHeight: 34, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderLeftWidth: 6, backgroundColor: 'rgba(136,136,136,0.08)' },
  no: { fontFamily: F.display, fontSize: 22, minWidth: 56 },
  nm: { fontSize: 20, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5 },
  chipT: { fontSize: 14, fontWeight: '900' },
});
