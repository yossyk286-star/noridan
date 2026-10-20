import { useState } from 'react';
import type React from 'react';
import { StyleSheet, Text, View, Vibration } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { BigButton, DeckStack, GachaCard, RoundEnd } from '../components/Stage';
import { IntroCard, LevelBox, ModeCard, Prog } from '../components/ModeParts';
import { StageShell, usePenalty } from '../components/StageShell';
import { Tap } from '../components/Tap';
import { HELP } from '../lib/help';
import { play } from '../lib/sound';
import type { Stats } from '../lib/titles';
import { C, F, LEVEL_LABEL, STAGE, alpha, colorOf } from '../theme';
import type { Level, Member, Night } from '../types';

type Props = { members: Member[]; level: Level; night: Night; onQuit: () => void; onSettings: () => void; onFinish: (pen: number[], turns: number, stats: Stats) => void; skipIntro?: boolean };
type Phase = 'intro' | 'play' | 'boom' | 'batsu';
const TILES: Record<Level, number> = { yurume: 20, futsu: 12, jigoku: 8 };
const rnd = (n: number) => Math.floor(Math.random() * n);

/** ロシアンタップ：パネルを順番に1枚ずつめくる。1枚だけ爆弾で、めくった人が罰（地獄度でパネルの数が減る） */
export default function RtapScreen({ members, level, night, onQuit, onSettings, onFinish, skipIntro }: Props) {
  useKeepAwake();
  const n = members.length;
  const P = usePenalty(members, level, night, 'rtap');
  const tiles = TILES[level];
  const [phase, setPhase] = useState<Phase>(skipIntro ? 'play' : 'intro');
  const [round, setRound] = useState(1);
  const [who, setWho] = useState(0);
  const [bomb, setBomb] = useState(() => rnd(tiles));
  const [open, setOpen] = useState<number[]>([]);
  const [turns, setTurns] = useState(0);

  const newRound = (r: number) => {
    setRound(r);
    setWho((r - 1) % n);
    setBomb(rnd(tiles));
    setOpen([]);
    setPhase('play');
  };
  const tap = (t: number) => {
    if (phase !== 'play' || open.includes(t)) return;
    setOpen([...open, t]);
    setTurns((x) => x + 1);
    if (t === bomb) {
      setPhase('boom');
      play('boom');
      Vibration.vibrate([0, 120, 60, 220]);
    } else {
      play('pop');
      setWho((who + 1) % n);
    }
  };
  const finish = (p: number[] = P.pen) => onFinish(p, turns, P.stats);

  const pal = STAGE[level];
  const fg = pal.cardFg;
  const cols = tiles <= 9 ? 3 : 4;
  let card: React.ReactNode = null;
  let controls: React.ReactNode = null;
  switch (phase) {
    case 'intro':
      card = (
        <IntroCard pal={pal} mode="rtap" tag={`${n}人`}>
          <LevelBox pal={pal} text={`地獄度は「${LEVEL_LABEL[level]}」：パネル${tiles}枚の中に爆弾が1つ`} />
        </IntroCard>
      );
      controls = <BigButton pal={pal} label="スタート" onPress={() => newRound(1)} />;
      break;
    case 'play':
    case 'boom': {
      const boom = phase === 'boom';
      card = (
        <ModeCard pal={pal} center bg={boom ? '#1a0606' : undefined} edge={boom ? '#e8202a' : undefined}>
          <Prog fg={boom ? '#f7f3ea' : fg}>{`第${round}回戦・残り${tiles - open.length}枚`}</Prog>
          <Text style={[s.who, { color: boom ? '#ff3b3b' : fg }]}>{boom ? `${members[who].name}がドカン！` : `${members[who].name}の番。1枚めくって`}</Text>
          <View style={[s.grid, { maxWidth: cols * 76 }]}>
            {Array.from({ length: tiles }, (_, t) => {
              const o = open.includes(t);
              const b = t === bomb && (o || boom);
              return (
                <Tap key={t} onPress={() => tap(t)} disabled={o || boom} style={[s.tile, { width: `${100 / cols - 3}%`, backgroundColor: b ? '#ff3b3b' : o ? alpha('#888888', 0.12) : alpha(colorOf(who), 0.25), borderStyle: o ? 'dashed' : 'solid' }]}>
                  <Text style={s.tileText}>{b ? '💣' : o ? '🍺' : '?'}</Text>
                </Tap>
              );
            })}
          </View>
        </ModeCard>
      );
      controls = boom ? <BigButton pal={pal} danger label={`${members[who].name}に罰ガチャ`} onPress={() => { P.draw([who]); setPhase('batsu'); }} /> : <Text style={[s.hint, { color: pal.muted }]}>1枚だけ爆弾。めくった人が罰</Text>;
      break;
    }
    case 'batsu':
      card = (
        <DeckStack pal={pal} minHeight={0}>
          <GachaCard pal={pal} members={members} items={P.gacha} />
        </DeckStack>
      );
      controls = <RoundEnd pal={pal} next={P.lucky ? 'ラッキー！もう1回戦' : '受け入れてもう1回戦'} onNext={() => { P.apply(); newRound(round + 1); }} onEnd={() => finish(P.apply())} />;
      break;
  }
  return (
    <StageShell
      pal={pal} members={members} pen={P.pen} doer={phase === 'play' ? who : -1} frame={phase === 'intro' ? C.muted : phase === 'boom' ? '#ff2a2a' : colorOf(who)}
      rules={HELP.rtap.rules} meta={`ロシアンタップ・${LEVEL_LABEL[level]}・${round}回戦`} onEnd={() => finish()} onQuit={onQuit} onSettings={onSettings} card={card} controls={controls}
    />
  );
}

const s = StyleSheet.create({
  who: { fontSize: 18, fontWeight: '900', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', width: '100%' },
  tile: { aspectRatio: 1, borderRadius: 14, borderWidth: 3, borderColor: 'rgba(136,136,136,0.35)', alignItems: 'center', justifyContent: 'center' },
  tileText: { fontFamily: F.display, fontSize: 26, color: '#141210' },
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '700' },
});
