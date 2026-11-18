import { load, save } from './storage';

/** 見てる人の予想（番の前に「できる？できへん？」）のON/OFF。設定で変える */
let on = true;
load<boolean>('nd_wbet', true).then((v) => { on = v !== false; });
export const getWatchBet = () => on;
export const setWatchBet = (v: boolean) => { on = v; save('nd_wbet', v); };

/** 安全確認：同じ内容は1日1回だけ */
export type SafeKind = 'tilt' | 'shake' | 'voice';
export const SAFE_LIST: Record<SafeKind, string[]> = {
  tilt: ['グラスは机に置いた', '周りの人とぶつからへん', '落としても大丈夫な場所や'],
  shake: ['グラスは机に置いた', '周りの人とぶつからへん', 'ストラップを手首に通した'],
  voice: ['夜中の近所に響かん場所や', 'お店の人に迷惑かからへん', '喉を痛めん程度でやる'],
};
export const SAFE_HEAD: Record<SafeKind, string> = { tilt: 'スマホを持つ前に確認', shake: '振る前に確認', voice: '叫ぶ前に確認' };
const today = () => new Date().toDateString();
export const safeDone = async (k: SafeKind) => (await load<string>('nd_safe_' + k, '')) === today();
export const markSafe = (k: SafeKind) => save('nd_safe_' + k, today());
