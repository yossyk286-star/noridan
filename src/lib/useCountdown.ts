import { useEffect, useRef, useState } from 'react';

/** 秒読みの時計。start(秒) で動かして、0になったら onEnd。stop() で止める */
export function useCountdown(onEnd: () => void) {
  const [left, setLeft] = useState(0);
  const endAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const handler = useRef(onEnd);
  handler.current = onEnd;
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };
  const start = (sec: number) => {
    stop();
    endAt.current = Date.now() + sec * 1000;
    setLeft(sec);
    timer.current = setInterval(() => {
      const ms = endAt.current - Date.now();
      if (ms <= 0) {
        stop();
        setLeft(0);
        handler.current();
      } else setLeft(Math.ceil(ms / 1000));
    }, 200);
  };
  useEffect(() => stop, []);
  return { left, start, stop };
}
