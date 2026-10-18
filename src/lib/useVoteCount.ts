import { useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { play } from './sound';

/**
 * 開票の数え上げ。active になったら 0 から1票ずつランダムな順に増やしていく（ポン、ポン）。
 * shown が今の表示の票数、done が数え終わったか
 */
export function useVoteCount(counts: number[], active: boolean) {
  const [shown, setShown] = useState<number[]>(() => counts.map(() => 0));
  const [done, setDone] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const key = active ? counts.join(',') : '';
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (!active) {
      setShown(counts.map(() => 0));
      setDone(false);
      return;
    }
    const seq: number[] = [];
    counts.forEach((v, i) => {
      for (let j = 0; j < v; j++) seq.push(i);
    });
    for (let a = seq.length - 1; a > 0; a--) {
      const b = Math.floor(Math.random() * (a + 1));
      [seq[a], seq[b]] = [seq[b], seq[a]];
    }
    const step = Math.max(120, Math.min(420, 3200 / Math.max(1, seq.length)));
    const now = counts.map(() => 0);
    setShown(now.slice());
    setDone(false);
    seq.forEach((i, j) => {
      timers.current.push(
        setTimeout(() => {
          now[i]++;
          setShown(now.slice());
          play('tick');
        }, 300 + j * step),
      );
    });
    timers.current.push(
      setTimeout(() => {
        setDone(true);
        play('warn');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }, 300 + seq.length * step + 150),
    );
    return () => timers.current.forEach(clearTimeout);
  }, [key]);
  return { shown, done };
}
