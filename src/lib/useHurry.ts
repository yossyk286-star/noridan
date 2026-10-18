import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { play } from './sound';

/** 残り10秒を切ったら1秒ごとにカチッ。赤いフチを出すかどうかを返す */
export function useHurry(secLeft: number, running: boolean) {
  const last = useRef(-1);
  const on = running && secLeft > 0 && secLeft <= 10;
  useEffect(() => {
    if (!on) {
      last.current = -1;
      return;
    }
    if (secLeft !== last.current) {
      last.current = secLeft;
      play('hurry');
      Haptics.selectionAsync().catch(() => {});
    }
  }, [on, secLeft]);
  return on;
}
