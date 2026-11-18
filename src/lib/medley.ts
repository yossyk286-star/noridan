import type { Mode } from '../types';

/**
 * おまかせメドレー：人数に合うゲームを自動で並べて、次々流す。
 * 長いゲーム・準備が長いゲーム（すごろく・神経衰弱・NGワード・ワードウルフ・お絵かき・テンション伝言・アホお題）は入れへん。
 * Web版（web-preview/extras.js の MED_POOL）と同じ中身にしとくこと
 */
export const MED_POOL: Mode[] = ['king', 'yama', 'nyok', 'rtap', 'bpass', 'hilo', 'ito', 'vote', 'pittari', 'quiz', 'reflex', 'voice', 'doubt', 'homeru', 'gesture', 'whack', 'deko', 'tilt', 'shake', 'stop'];
/** 種類（同じ種類が続かんように選ぶ）。HomeScreen の MODE_LIST と同じ */
export const MODE_CAT: Partial<Record<Mode, string>> = {
  king: 'basic', yama: 'basic', nyok: 'basic', tilt: 'phone', shake: 'phone', stop: 'phone', reflex: 'phone', voice: 'phone', rtap: 'phone', bpass: 'phone', deko: 'phone', whack: 'phone',
  doubt: 'talk', homeru: 'talk', gesture: 'talk', quiz: 'brain', ito: 'brain', hilo: 'brain', pittari: 'brain', vote: 'brain',
};
/** 最低人数（無いものは2人） */
export const MODE_MIN: Partial<Record<Mode, number>> = { king: 3, yama: 3, nyok: 3, doubt: 3, gesture: 3, pittari: 3, vote: 3 };
