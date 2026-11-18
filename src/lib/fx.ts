import { Animated, Easing } from 'react-native';
import { GACHA_MS } from '../components/Fx';
import { play } from './sound';
import { Haptics, Vibration } from './vibe';
import { CAP_LABEL, capOf, jikkyoPick, liveNow, resetLive } from './live';
import type { GachaItem } from '../types';

/**
 * 罰・ラッキー・連続罰の演出をどこからでも出すための小さな仕組み。
 * 画面は batsuCue(items) を呼ぶだけ。App の一番上にある <FxLayer> が受け取って光らせる
 */
export type FxEvent = { kind: 'quake' } | { kind: 'gold' } | { kind: 'bigboom' } | { kind: 'streak'; name: string; n: number } | { kind: 'host'; text: string } | { kind: 'rare' };
type Listener = (e: FxEvent) => void;
const listeners = new Set<Listener>();
export function onFx(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
const emit = (e: FxEvent) => listeners.forEach((fn) => fn(e));

/** 画面全体のガタガタ（App のいちばん外側の View がこれで揺れる。爆弾パスの大爆発だけ） */
export const quakeX = new Animated.Value(0);
/** 爆弾パスの大爆発：白く光る → 火の玉 → 衝撃波 → 破片と煙 → 画面がガタガタ */
export function bigBoom() {
  play('bigboom');
  Vibration.vibrate([0, 300, 60, 120, 60, 400]);
  emit({ kind: 'bigboom' });
  quakeX.setValue(0);
  const seq = [-18, 16, -14, 12, -8, 6, -3, 0];
  Animated.sequence(seq.map((x) => Animated.timing(quakeX, { toValue: x, duration: 90, easing: Easing.linear, useNativeDriver: true }))).start();
}

// 同じ人が続けて罰になった回数（ゲームを始めるたびにリセット）
let streak: Record<number, number> = {};
export function resetStreak() {
  streak = {};
  resetLive();
  pending = null;
}
const timers: ReturnType<typeof setTimeout>[] = [];
export function cancelFx() {
  timers.splice(0).forEach(clearTimeout);
}
// 振ってガチャ：振るまで音と演出を待たせる（GachaCard が releaseCue を呼ぶ）
let pending: (() => void) | null = null;
export function releaseCue() {
  const f = pending;
  pending = null;
  f?.();
}

/**
 * 罰が決まった瞬間：ガチャのガラガラ → カプセルが割れたら
 * 罰は情けない音＋赤いフチ／ラッキーはキラキラの音＋金の紙吹雪。続けて罰の人は「2連続！」
 */
export function batsuCue(items: { i: number; lucky?: boolean }[], members: { name: string }[], gacha = true) {
  if (!items.length) return;
  const lucky = items.every((x) => x.lucky);
  const cap = gacha && (items as GachaItem[])[0]?.segments ? capOf(items as GachaItem[]) : null;
  const losers = items.filter((x) => !x.lucky).map((x) => x.i);
  const next: Record<number, number> = {};
  losers.forEach((i) => (next[i] = (streak[i] ?? 0) + 1));
  streak = next;
  const top = losers.filter((i) => next[i] >= 2).sort((a, b) => next[b] - next[a])[0];
  const say = jikkyoPick(items, members, top != null ? { i: top, n: next[top] } : null, cap);
  cancelFx();
  const fx = () => {
    if (lucky) {
      play('kira');
      emit({ kind: 'gold' });
      Vibration.vibrate(30);
    } else {
      play(Math.random() < 0.5 ? 'sad' : 'chin');
      emit({ kind: 'quake' }); // 赤いフチ（札は GachaCard が0.15秒だけ揺らす）
      Vibration.vibrate([0, 60, 40, 120]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
    if (top != null && members[top]) {
      timers.push(setTimeout(() => {
        play('streak');
        emit({ kind: 'streak', name: members[top].name, n: next[top] });
        Vibration.vibrate([0, 40, 30, 40, 30, 90]);
      }, 700));
    }
    if (say) timers.push(setTimeout(() => { play('pop'); emit({ kind: 'host', text: say }); }, top != null ? 2700 : 900));
  };
  const run = () => {
    if (gacha) play(lucky ? 'gachaLucky' : 'gacha');
    else if (lucky) play('lucky');
    if (gacha && cap && CAP_LABEL[cap.c]) timers.push(setTimeout(() => { emit({ kind: 'rare' }); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); }, 760));
    if (gacha) timers.push(setTimeout(fx, GACHA_MS + 60));
    else fx();
  };
  // 振ってガチャの時は、振るまで待つ
  if (gacha && liveNow().spinGacha) pending = run;
  else run();
}
