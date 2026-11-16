import * as StoreReview from 'expo-store-review';
import { load, save } from './storage';

const VER = '0.1.0';
const DAY = 24 * 60 * 60 * 1000;

/** 初めて開いた日を覚えとく（アプリ起動時に1回呼ぶ） */
export async function markFirstOpen() {
  const first = await load<number>('nd_first_open', 0);
  if (!first) save('nd_first_open', Date.now());
}

/**
 * 星のお願い。結果発表で盛り上がったタイミングで、OS標準の評価ダイアログを出す
 * 条件：合計3回以上遊んだ・初回から3日以上・このバージョンでまだ聞いてない
 * （実際に出すかはOSが決める。iOSは1年に3回まで）
 */
export async function maybeAskReview() {
  try {
    const plays = await load<Record<string, number>>('nd_plays', {});
    const total = Object.values(plays && typeof plays === 'object' ? plays : {}).reduce((a, b) => a + (+b || 0), 0);
    const first = await load<number>('nd_first_open', 0);
    const asked = await load<string>('nd_review_ver', '');
    if (total < 3 || !first || Date.now() - first < 3 * DAY || asked === VER) return;
    if (!(await StoreReview.hasAction())) return;
    save('nd_review_ver', VER);
    await StoreReview.requestReview();
  } catch {}
}
