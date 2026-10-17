import type { Level } from './types';

export const C = {
  ink: '#141210',
  paper: '#f7f3ea',
  yuru: '#ffd23f',
  futsu: '#ff5d8f',
  jigoku: '#0d0b0b',
  blood: '#ff2a2a',
  muted: '#8d857a',
  cream: '#fffaf0',
  night: '#b69cff',
  deep: '#ff4fa8',
  bombEdge: '#ff7a1a',
};

export const LEVEL_LABEL: Record<Level, string> = { yurume: 'ゆるめ', futsu: '普通', jigoku: '地獄' };
export const LEVEL_SUB: Record<Level, string> = { yurume: '初手はこれ', futsu: 'いつもの', jigoku: '覚悟しろ' };

/** 地獄度ごとの画面の色。背景色そのものが地獄度を表す */
export type Pal = { bg: string; fg: string; muted: string; chip: string; cardBg: string; cardFg: string; cardEdge: string; /** ネオン看板の時の管の色 */ neon?: string };
export const STAGE: Record<Level, Pal> = {
  yurume: { bg: C.yuru, fg: C.ink, muted: 'rgba(20,18,16,0.6)', chip: 'rgba(20,18,16,0.12)', cardBg: C.cream, cardFg: C.ink, cardEdge: 'transparent' },
  futsu: { bg: C.futsu, fg: C.ink, muted: 'rgba(20,18,16,0.62)', chip: 'rgba(20,18,16,0.12)', cardBg: C.cream, cardFg: C.ink, cardEdge: 'transparent' },
  jigoku: { bg: C.jigoku, fg: C.blood, muted: 'rgba(255,42,42,0.65)', chip: 'rgba(255,42,42,0.14)', cardBg: '#170b0b', cardFg: C.blood, cardEdge: 'rgba(255,42,42,0.55)' },
};

/** 夜モード：夜お題・深夜お題が出たら店の照明が落ちてネオン看板になる */
export const NEON_BG = '#0b0812';
export const neonPal = (nc: string): Pal => ({
  bg: NEON_BG, fg: '#f4ecff', muted: 'rgba(244,236,255,0.62)', chip: 'rgba(244,236,255,0.1)',
  cardBg: '#120c1d', cardFg: '#ffffff', cardEdge: nc, neon: nc,
});

/** お題札の種類ごとの見た目（普通のお題は地獄度の色のまま） */
export const CARD_LOOK = {
  yoru: { bg: '#120c1d', fg: '#ffffff', edge: C.night },
  deep: { bg: '#120c1d', fg: '#ffffff', edge: C.deep },
  event: { bg: C.ink, fg: C.yuru, edge: C.yuru },
  bomb: { bg: '#0e0e0e', fg: '#ffffff', edge: C.bombEdge },
};

/** 色に透明度をつける（#rrggbb → #rrggbbaa） */
export const alpha = (hex: string, a: number) => hex + Math.round(a * 255).toString(16).padStart(2, '0');

export const MEMBER_COLORS = [
  '#ffd23f', '#ff5d8f', '#4dd4ff', '#7cf06b', '#ff9a3c', '#b69cff',
  '#ffffff', '#ff4f4f', '#3cffc8', '#f5a3ff', '#c8ff3c', '#9ab0ff',
];
export const colorOf = (i: number) => MEMBER_COLORS[i % MEMBER_COLORS.length];

/** フォント未読込でもシステムフォントで表示される */
export const F = {
  display: 'DelaGothicOne_400Regular',
};
