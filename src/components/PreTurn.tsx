import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Tap } from './Tap';
import { C, colorOf } from '../theme';
import batsuJson from '../data/batsu.json';
import { getWatchBet, markSafe, safeDone, SAFE_HEAD, SAFE_LIST, type SafeKind } from '../lib/watchbet';
import { pick } from '../lib/game';
import type { Member } from '../types';

type Ask = { who: number; exclude?: number[]; safe?: SafeKind; q?: string; go: () => void };

/**
 * 番の前の確認：
 *  ・傾け・シェイク・声デカは、1日1回だけ「グラスを置いた？」などの安全確認
 *  ・見てる人は「できる／できへん」に1タップで賭ける。外した人は軽い罰（ゆるい罰）
 */
export function usePreTurn(members: Member[], bump: (ids: number[]) => void) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [checks, setChecks] = useState<number[]>([]);
  const [picks, setPicks] = useState<Record<number, 'y' | 'n'>>({});
  const [needSafe, setNeedSafe] = useState(false);
  const bets = useRef<Record<number, 'y' | 'n'> | null>(null);
  const [msg, setMsg] = useState('');

  const open = async (a: Ask) => {
    const ns = a.safe ? !(await safeDone(a.safe)) : false;
    const watchers = members.map((_, i) => i).filter((i) => i !== a.who && !a.exclude?.includes(i));
    const hasBet = !!a.q && getWatchBet() && watchers.length >= 2;
    if (!ns && !hasBet) { bets.current = null; a.go(); return; }
    setNeedSafe(ns);
    setChecks([]);
    setPicks({});
    setAsk({ ...a, q: hasBet ? a.q : undefined });
  };
  const start = (withBet: boolean) => {
    if (!ask) return;
    if (needSafe && ask.safe) markSafe(ask.safe);
    bets.current = withBet && ask.q && Object.keys(picks).length ? { ...picks } : null;
    const go = ask.go;
    setAsk(null);
    go();
  };
  /** 結果が出た時：予想を外した人にゆるい罰 */
  const resolve = (ok: boolean) => {
    const b = bets.current;
    bets.current = null;
    if (!b) return;
    const miss = Object.keys(b).map(Number).filter((i) => (b[i] === 'y') !== ok);
    if (!miss.length) { setMsg('予想はみんな当たり！'); return; }
    bump(miss);
    const pool = ((batsuJson as unknown as { pass: string[] }).pass ?? []).filter((t) => !/飲/.test(t));
    const X = members[pick(members.map((_, i) => i).filter((i) => !miss.includes(i)).concat(miss))].name;
    const t = pool.length ? pick(pool).replace(/\{X\}/g, X) : '';
    setMsg(`予想はずれ：${miss.map((i) => members[i].name).join('・')}に罰1回（ゆるいやつ）${t ? `　${t}` : ''}`);
  };
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(''), 4500);
    return () => clearTimeout(t);
  }, [msg]);

  const list = ask?.safe && needSafe ? SAFE_LIST[ask.safe] : [];
  const ready = checks.length === list.length;
  const watchers = ask ? members.map((_, i) => i).filter((i) => i !== ask.who && !ask.exclude?.includes(i)) : [];
  const node = (
    <>
      <Modal visible={!!ask} transparent animationType="slide" onRequestClose={() => setAsk(null)}>
        <Pressable style={s.back} onPress={() => setAsk(null)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={s.h}>{needSafe && ask?.safe ? SAFE_HEAD[ask.safe] : ask ? `${members[ask.who].name}の番の前に` : ''}</Text>
            {list.length > 0 && (
              <>
                <Text style={s.sec}>先に確認（今日1回だけ）</Text>
                {list.map((t, k) => {
                  const on = checks.includes(k);
                  return (
                    <Tap key={k} onPress={() => setChecks(on ? checks.filter((x) => x !== k) : [...checks, k])} accessibilityState={{ checked: on }} style={s.chk}>
                      <View style={[s.box, on && { backgroundColor: C.yuru, borderColor: C.yuru }]}>{on && <Text style={s.tick}>✓</Text>}</View>
                      <Text style={s.chkText}>{t}</Text>
                    </Tap>
                  );
                })}
              </>
            )}
            {ask?.q && (
              <>
                <Text style={s.sec}>みんなの予想（見てる人だけ）</Text>
                <Text style={s.note}>{`${members[ask.who].name}は、${ask.q}　外した人は軽い罰`}</Text>
                {watchers.map((i) => (
                  <View key={i} style={[s.row, { borderLeftColor: colorOf(i) }]}>
                    <Text style={s.nm} numberOfLines={1}>{members[i].name}</Text>
                    {(['y', 'n'] as const).map((v) => (
                      <Tap key={v} onPress={() => setPicks((p) => { const n = { ...p }; if (n[i] === v) delete n[i]; else n[i] = v; return n; })} accessibilityState={{ selected: picks[i] === v }} style={[s.pick, picks[i] === v && { backgroundColor: C.yuru }]}>
                        <Text style={[s.pickT, picks[i] === v && { color: C.ink }]}>{v === 'y' ? 'できる' : 'できへん'}</Text>
                      </Tap>
                    ))}
                  </View>
                ))}
              </>
            )}
            <Tap disabled={!ready} onPress={() => start(true)} style={[s.big, !ready && { opacity: 0.4 }]}>
              <Text style={s.bigT}>{ready ? 'スタート' : '全部チェックしてな'}</Text>
            </Tap>
            {!!ask?.q && (
              <Tap disabled={!ready} onPress={() => start(false)} style={[s.ghost, !ready && { opacity: 0.4 }]}>
                <Text style={s.ghostT}>予想なしで始める</Text>
              </Tap>
            )}
          </Pressable>
        </Pressable>
      </Modal>
      {!!msg && (
        <View pointerEvents="none" style={s.toast}>
          <Text style={s.toastT}>{msg}</Text>
        </View>
      )}
    </>
  );
  return { ask: open, resolve, node };
}

const s = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#211e1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 30, gap: 8, width: '100%', maxWidth: 560, alignSelf: 'center' },
  h: { color: C.paper, fontSize: 20, fontWeight: '900', marginBottom: 2 },
  sec: { color: C.muted, fontSize: 13, fontWeight: '900', marginTop: 6 },
  note: { color: C.paper, fontSize: 14, fontWeight: '700' },
  chk: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, backgroundColor: 'rgba(247,243,234,0.08)', minHeight: 48 },
  box: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: C.muted, alignItems: 'center', justifyContent: 'center' },
  tick: { color: C.ink, fontWeight: '900', fontSize: 15, lineHeight: 18 },
  chkText: { color: C.paper, fontSize: 15, fontWeight: '900', flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingLeft: 14, paddingRight: 6, borderRadius: 14, backgroundColor: 'rgba(247,243,234,0.08)', borderLeftWidth: 6 },
  nm: { flex: 1, color: C.paper, fontSize: 16, fontWeight: '900' },
  pick: { minWidth: 76, minHeight: 44, borderRadius: 12, backgroundColor: 'rgba(247,243,234,0.12)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  pickT: { color: C.paper, fontSize: 14, fontWeight: '900' },
  big: { marginTop: 8, minHeight: 56, borderRadius: 16, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' },
  bigT: { color: C.ink, fontSize: 18, fontWeight: '900' },
  ghost: { minHeight: 48, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(247,243,234,0.3)', alignItems: 'center', justifyContent: 'center' },
  ghostT: { color: C.paper, fontSize: 15, fontWeight: '900' },
  toast: { position: 'absolute', left: 16, right: 16, top: 90, backgroundColor: 'rgba(20,18,16,0.94)', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: 'rgba(247,243,234,0.25)' },
  toastT: { color: C.paper, fontSize: 14, fontWeight: '800', lineHeight: 20 },
});
