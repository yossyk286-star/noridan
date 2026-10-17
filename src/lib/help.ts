import helpJson from '../data/help.json';
import type { Mode } from '../types';

/** 説明の中身（Web版と同じ help.json から）。<b>…</b> は太字 */
type ModeHelp = { desc: string; how: [string, string][]; rules: [string, string][] };
export const HELP = helpJson as unknown as Record<Mode, ModeHelp>;

/** 「<b>太字</b>」を部品に分ける */
export function boldParts(t: string): { t: string; b: boolean }[] {
  return t.split(/(<b>.*?<\/b>)/).filter(Boolean).map((x) => (x.startsWith('<b>') ? { t: x.slice(3, -4), b: true } : { t: x, b: false }));
}
export const plainText = (t: string) => t.replace(/<\/?b>/g, '');
