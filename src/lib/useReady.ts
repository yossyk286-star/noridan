import { useEffect, useRef, useState } from 'react';
import { play } from './sound';

/** 3・2・1のカウントダウン（タイマーでいきなり始まるモード共通）。run(go) で 3→2→1 と心臓の音でドクンと数えて、0で go。数えてない間 count は 0 */
export function useReady(ms = 800) {
  const [count, setCount] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const run = (go: () => void) => {
    clear();
    setCount(3);
    play('heart');
    [1, 2].forEach((j) => timers.current.push(setTimeout(() => { setCount(3 - j); play('heart'); }, j * ms)));
    timers.current.push(setTimeout(() => { timers.current = []; setCount(0); go(); }, 3 * ms));
  };
  useEffect(() => clear, []);
  return { count, run };
}
