import { createContext, useContext } from 'react';

/** ゲーム中の画面がどこからでも読む設定（向かい合わせ表示・読み上げ） */
export type Prefs = { dual: boolean; voice: boolean };
export const PrefsContext = createContext<Prefs>({ dual: false, voice: false });
export const usePrefs = () => useContext(PrefsContext);
