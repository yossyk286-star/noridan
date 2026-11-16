import { load, save } from './storage';
import type { Member, Mode } from '../types';

/** ===== 第3弾：チーム戦・通算・終電とお水（Web版の extras.js と同じ考え方） ===== */

export const TEAM = [
  { name: '赤', color: '#ff3b3b' },
  { name: '青', color: '#3d7bff' },
];

/** 赤と青に交互に振り分ける（順番はシャッフル） */
export function makeTeams(n: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const t = Array(n).fill(0);
  idx.forEach((i, k) => (t[i] = k % 2));
  return t;
}

export function teamScore(teams: number[], pen: number[]) {
  return [0, 1].map((t) => {
    const who = teams.map((x, i) => (x === t ? i : -1)).filter((i) => i >= 0);
    const sum = who.reduce((a, i) => a + (pen[i] ?? 0), 0);
    return { t, who, sum, avg: who.length ? sum / who.length : 0 };
  });
}

/** このメンバーの通算（名前の組み合わせごと。スマホの中だけ） */
export type Tally = { games: number; pen: Record<string, number>; lucky: Record<string, number>; last?: { names: string[]; mode: Mode; at: number } };
const keyOf = (ms: Member[]) => ms.map((m) => m.name).sort().join('\u0001');

async function all(): Promise<Record<string, Tally>> {
  const v = await load<unknown>('nd_tally', {});
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, Tally>) : {};
}
export async function getTally(ms: Member[]): Promise<Tally | null> {
  const t = (await all())[keyOf(ms)];
  return t && typeof t === 'object' && t.pen ? t : null;
}
export async function recordTally(ms: Member[], pen: number[], lucky: number[], mode: Mode): Promise<Tally> {
  const a = await all();
  const k = keyOf(ms);
  const t: Tally = a[k]?.pen ? a[k] : { games: 0, pen: {}, lucky: {} };
  t.games++;
  ms.forEach((m, i) => {
    t.pen[m.name] = (t.pen[m.name] ?? 0) + (pen[i] ?? 0);
    t.lucky[m.name] = (t.lucky[m.name] ?? 0) + (lucky[i] ?? 0);
  });
  const max = Math.max(0, ...pen);
  t.last = { names: max > 0 ? ms.filter((_, i) => pen[i] === max).map((m) => m.name) : [], mode, at: Date.now() };
  a[k] = t;
  // 新しい20組だけ残す
  const keys = Object.keys(a).sort((x, y) => (a[y].last?.at ?? 0) - (a[x].last?.at ?? 0)).slice(0, 20);
  save('nd_tally', Object.fromEntries(keys.map((x) => [x, a[x]])));
  return t;
}

/** 帰る時間（"23:40"）まであと何分か。夜中をまたぐ時は次の日 */
export function minsLeft(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  const now = new Date();
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  if (d.getTime() - now.getTime() < -3600e3) d.setDate(d.getDate() + 1);
  return Math.round((d.getTime() - now.getTime()) / 60000);
}
/** 10分ずつずらす */
export function shiftTime(t: string, d: number) {
  const [h, m] = t.split(':').map(Number);
  const v = (((h * 60 + m + d) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}

/** 画面の上にちょっと出すお知らせ（App で表示） */
type ToastFn = (text: string, kind?: '' | 'train' | 'water') => void;
let toastFn: ToastFn = () => {};
export const setToastHandler = (f: ToastFn) => (toastFn = f);
export const toast: ToastFn = (t, k) => toastFn(t, k);
