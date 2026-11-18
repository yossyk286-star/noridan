import { useSyncExternalStore } from 'react';
import { load, save } from './storage';
import type { Tally } from './extras';
import liveJson from '../data/live.json';
import type { GachaItem, Level, Member } from '../types';

/** ===== 第4弾：動きと演出（Web版の live.js と同じ考え方） ===== */
export const LIVE = liveJson;

// ---------- 設定（設定シートの「演出」） ----------
export type LiveSet = { jikkyo: boolean; entrance: boolean; faceDeal: boolean; spinGacha: boolean; camera: boolean; meter: boolean };
const DEF: LiveSet = { jikkyo: true, entrance: true, faceDeal: false, spinGacha: false, camera: false, meter: false };
let set: LiveSet = { ...DEF };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const sub = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};
export async function loadLive() {
  const v = await load<unknown>('nd_live', {});
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    set = Object.fromEntries(Object.keys(DEF).map((k) => [k, typeof o[k] === 'boolean' ? o[k] : DEF[k as keyof LiveSet]])) as LiveSet;
    emit();
  }
}
export function setLive(k: keyof LiveSet, on: boolean) {
  set = { ...set, [k]: on };
  save('nd_live', set);
  emit();
}
export const liveNow = () => set;
export const useLive = () => useSyncExternalStore(sub, () => set, () => set);

// 今の地獄度（ガチャの色・実況で使う。App が入れる）
let level: Level = 'futsu';
export const setLiveLevel = (l: Level) => {
  level = l;
};

// ---------- ゲームごとに数え直すもの ----------
let pen: number[] = [];
let J = { n: 0, last: -9, lead: -1, clean: new Set<number>() };
let photos: Photo[] = [];
let spunSet = new WeakSet<object>();
export function resetLive() {
  pen = [];
  J = { n: 0, last: -9, lead: -1, clean: new Set() };
  photos = [];
  spunSet = new WeakSet();
  emit();
}

// ---------- 21 罰ガチャのカプセルの色 ----------
// 白=ふつう・赤=重め（2倍・深夜・地獄）・金=ラッキーかも（たまにガセ）・虹=地獄のいちばん重い罰
export type Cap = { c: 'white' | 'red' | 'gold' | 'rainbow'; fake?: boolean };
const capCache = new WeakMap<object, Cap>();
export function capOf(items: GachaItem[]): Cap {
  if (!items.length) return { c: 'white' };
  const hit = capCache.get(items);
  if (hit) return hit;
  const lucky = items.every((x) => x.lucky), r = Math.random();
  const heavy = items.some((x) => !x.lucky && ((x.n ?? 1) > 1 || x.night === 'shinya')) || level === 'jigoku';
  const v: Cap = lucky ? { c: 'gold' }
    : level === 'jigoku' && items.some((x) => (x.n ?? 1) > 1 || x.night) && r < 0.25 ? { c: 'rainbow' }
    : r < 0.1 ? { c: 'gold', fake: true }
    : { c: heavy ? 'red' : 'white' };
  capCache.set(items, v);
  return v;
}
export const CAP_LABEL: Partial<Record<Cap['c'], string>> = { gold: '金カプセル！', rainbow: '虹カプセル！' };

// ---------- 20 実況ひとこと ----------
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const fillP = (t: string, i: number | null, ms: { name: string }[]) => t.replace(/\{P\}/g, i != null && ms[i] ? ms[i].name : '');
/** 罰ガチャが決まった時に1回だけ呼ぶ。言うことがあれば文字を返す（続けては言わへん） */
export function jikkyoPick(items: { i: number; lucky?: boolean; n?: number }[], members: { name: string }[], streak: { i: number; n: number } | null, cap: Cap | null): string | null {
  J.n++;
  const lucky = items.every((x) => x.lucky);
  items.forEach((x) => {
    if (!x.lucky && x.i >= 0) pen[x.i] = (pen[x.i] ?? 0) + (x.n ?? 1);
  });
  const v = members.map((_, i) => pen[i] ?? 0), max = Math.max(0, ...v), tops = v.map((x, i) => (x === max ? i : -1)).filter((i) => i >= 0);
  const top = max > 0 && tops.length === 1 ? tops[0] : -1;
  const prev = J.lead;
  if (top >= 0) J.lead = top;
  if (!set.jikkyo || J.n - J.last < 2) return null;
  const L = LIVE.jikkyo;
  let line: string | null = null;
  if (cap?.fake && !lucky) line = pick(L.fake);
  else if (streak && (streak.n >= 3 || Math.random() < 0.35)) line = fillP(pick(L.streak), streak.i, members);
  else if (top >= 0 && prev >= 0 && prev !== top && max >= 3) line = fillP(pick(L.lead), top, members);
  else if (lucky && level === 'jigoku' && Math.random() < 0.6) line = pick(L.angel);
  else if (v.reduce((a, b) => a + b, 0) >= 6 && members.length >= 3) {
    const c = v.map((x, i) => (x === 0 && !J.clean.has(i) ? i : -1)).filter((i) => i >= 0);
    if (c.length === 1) {
      J.clean.add(c[0]);
      line = fillP(pick(L.clean), c[0], members);
    }
  }
  if (line) J.last = J.n;
  return line;
}

// ---------- 23 選手入場の二つ名 ----------
const shuffle = <T,>(a: T[]) => {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
export function nickList(members: Member[], t: Tally | null): string[] {
  const N = LIVE.nick, used = new Set<string>();
  const pickU = (list: string[]) => {
    const l = shuffle(list).find((x) => !used.has(x)) ?? list[0];
    used.add(l);
    return l;
  };
  const topOf = (rec: Record<string, number>, min: number) => {
    const v = members.map((m) => rec[m.name] ?? 0), mx = Math.max(...v);
    return mx >= min && v.filter((x) => x === mx).length === 1 ? v.indexOf(mx) : -1;
  };
  const penTop = t && t.games >= 2 ? topOf(t.pen, 1) : -1;
  const luckTop = t && t.games >= 2 ? topOf(t.lucky, 2) : -1;
  return members.map((m, i) => {
    if (t?.last?.names.includes(m.name)) return pickU(N.last);
    if (t && i === penTop) return pickU(N.pen).replace('{N}', String(t.pen[m.name]));
    if (t && i === luckTop) return pickU(N.lucky).replace('{N}', String(t.lucky[m.name]));
    if (t && t.pen[m.name] == null) return pickU(N.first);
    return pickU(N.any);
  });
}

// ---------- 24 振ってガチャ ----------
export const isSpun = (items: object) => spunSet.has(items);
export const markSpun = (items: object) => spunSet.add(items);

// ---------- 25 罰の瞬間カメラ ----------
export type Photo = { key: object; i: number; txt: string; uri: string };
export function addPhoto(p: Photo) {
  photos = [...photos.filter((x) => x.key !== p.key), p].slice(-8);
  emit();
}
export const getPhotos = () => photos;
export const usePhotos = () => useSyncExternalStore(sub, () => photos, () => photos);

// ---------- 26 盛り上がりメーター ----------
export type MPoint = { t: number; v: number; m: string };
export const mlog: MPoint[] = [];

// ---------- 27 夜が深まると画面も変わる ----------
export type Tod = { k: 'early' | 'peak' | 'late'; sub: string; line: string; hero: string };
export function todNow(d = new Date()): Tod | null {
  const h = d.getHours();
  const k = h >= 17 && h < 21 ? 'early' : h >= 21 ? 'peak' : h < 5 ? 'late' : null;
  return k ? { k, ...LIVE.night[k] } : null;
}
export const TOD_COLOR = { early: '#ffb347', peak: '#ff5d8f', late: '#b69cff' } as const;
