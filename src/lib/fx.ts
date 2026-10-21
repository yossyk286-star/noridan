import { Animated, Easing } from 'react-native';
import { GACHA_MS } from '../components/Fx';
import { play } from './sound';
import { Vibration } from './vibe';

/**
 * 罰・ラッキー・連続罰の演出をどこからでも出すための小さな仕組み。
 * 画面は batsuCue(items) を呼ぶだけ。App の一番上にある <FxLayer> が受け取って光らせる
 */
export type FxEvent = { kind: 'quake' } | { kind: 'gold' } | { kind: 'bigboom' } | { kind: 'streak'; name: string; n: number };
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
}
const timers: ReturnType<typeof setTimeout>[] = [];
export function cancelFx() {
  timers.splice(0).forEach(clearTimeout);
}

/**
 * 罰が決まった瞬間：ガチャのガラガラ → カプセルが割れたら
 * 罰は情けない音＋赤いフチ／ラッキーはキラキラの音＋金の紙吹雪。続けて罰の人は「2連続！」
 */
export function batsuCue(items: { i: number; lucky?: boolean }[], members: { name: string }[], gacha = true) {
  if (!items.length) return;
  const lucky = items.every((x) => x.lucky);
  if (gacha) play(lucky ? 'gachaLucky' : 'gacha');
  else if (lucky) play('lucky');
  const losers = items.filter((x) => !x.lucky).map((x) => x.i);
  const next: Record<number, number> = {};
  losers.forEach((i) => (next[i] = (streak[i] ?? 0) + 1));
  streak = next;
  const top = losers.filter((i) => next[i] >= 2).sort((a, b) => next[b] - next[a])[0];
  cancelFx();
  const fx = () => {
    if (lucky) {
      play('kira');
      emit({ kind: 'gold' });
      Vibration.vibrate(30);
    } else {
      play(Math.random() < 0.5 ? 'sad' : 'chin');
      emit({ kind: 'quake' }); // 赤いフチだけ（罰ガチャの画面は揺らさへん）
      Vibration.vibrate([0, 60, 40, 120]);
    }
    if (top != null && members[top]) {
      timers.push(setTimeout(() => {
        play('streak');
        emit({ kind: 'streak', name: members[top].name, n: next[top] });
        Vibration.vibrate([0, 40, 30, 40, 30, 90]);
      }, 700));
    }
  };
  if (gacha) timers.push(setTimeout(fx, GACHA_MS + 60));
  else fx();
}
