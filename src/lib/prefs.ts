import { createContext, useContext } from 'react';

/** ゲーム中の画面がどこからでも読む設定（向かい合わせ表示・読み上げ・番の交代画面） */
export type Prefs = {
  dual: boolean; voice: boolean; handoff?: boolean; noTouch?: boolean; setDual: (on: boolean) => void;
  /** チーム戦：メンバーの順に 0=赤 1=青（チーム戦でない時は無し） */
  teams?: number[];
  /** メンバーの出入りで引き継いだ罰（メンバーの順）。上のバーではゲーム中の罰に足して出す */
  carry?: number[];
  /** 上のバーが今の罰を入れとく（メンバーの出入りで引き継ぐため） */
  livePen?: { current: number[] };
  /** ⋯メニューの「メンバーの出入り」 */
  onInout?: () => void;
  /** 駆け引きあり：ハイ&ローで降りられる・ロシアンタップで1回パス */
  gamble?: boolean;
  /** 価値観ナンバーを協力型（みんなで並べてライフ制）にする */
  itCoop?: boolean;
  setItCoop?: (on: boolean) => void;
  /** おまかせメドレー中：何番目か・このあとのゲーム */
  medley?: { idx: number; total: number; /** このあとのゲーム名（今の次から） */ rest: string[] };
  /** 次のゲームへ（罰は引き継ぐ） */
  onMedNext?: () => void;
};
export const PrefsContext = createContext<Prefs>({ dual: false, voice: false, setDual: () => {} });
export const usePrefs = () => useContext(PrefsContext);
