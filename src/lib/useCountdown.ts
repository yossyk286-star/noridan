import { useEffect, useRef, useState } from 'react';

/**
 * 時計の一時停止（ゲームの「⋯」メニュー・設定・ルールを開いてる間は全部止める）
 * 閉じたら止めた分だけ後ろにずらして、続きから動かす
 */
let paused = false;
let pausedAt = 0;
let running = 0;
const subs = new Set<(p: boolean, at: number) => void>();
let holds = 0;
/** 止める理由の数で数える（メニューと設定が重なっても、全部閉じるまで止めたまま） */
export function setClockPaused(on: boolean) {
  holds = Math.max(0, holds + (on ? 1 : -1));
  applyPause(holds > 0);
}
/** 開いてる間だけ時計を止める（visible をそのまま渡す） */
export function useClockHold(on: boolean) {
  useEffect(() => {
    if (!on) return;
    setClockPaused(true);
    return () => setClockPaused(false);
  }, [on]);
}
function applyPause(on: boolean) {
  if (on === paused) return;
  paused = on;
  pausedAt = on ? Date.now() : 0;
  subs.forEach((f) => f(on, Date.now()));
}
export const isClockPaused = () => paused;
/** 今どこかで秒読みが動いてるか（メニューに「時計は止めてる」を出す用） */
export const isClockRunning = () => running > 0;
/** 一時停止の出入りを聞く。on=止まった/続き、at=止まった時刻 */
export function subscribeClock(f: (paused: boolean, at: number) => void) {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}
/** 止めてる間は「止めた時刻」を今として扱う（残り時間が減らんように） */
export const clockNow = () => (paused ? pausedAt : Date.now());
/** 動いてる時計を数える（NGワードやボムの時計もこれで登録する） */
export function clockRunning(on: boolean) {
  running = Math.max(0, running + (on ? 1 : -1));
}

/** 秒読みの時計。start(秒) で動かして、0になったら onEnd。stop() で止める */
export function useCountdown(onEnd: () => void) {
  const [left, setLeft] = useState(0);
  const endAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const handler = useRef(onEnd);
  handler.current = onEnd;
  const stop = () => {
    if (timer.current) {
      clearInterval(timer.current);
      clockRunning(false);
    }
    timer.current = null;
  };
  const start = (sec: number) => {
    stop();
    endAt.current = Date.now() + sec * 1000;
    setLeft(sec);
    clockRunning(true);
    timer.current = setInterval(() => {
      if (isClockPaused()) return; // メニューを開いてる間は止める
      const ms = endAt.current - Date.now();
      if (ms <= 0) {
        stop();
        setLeft(0);
        handler.current();
      } else setLeft(Math.ceil(ms / 1000));
    }, 200);
  };
  // 閉じたら止めてた分だけ終わりを後ろにずらす
  useEffect(() => {
    const off = subscribeClock((p, at) => {
      if (!p && timer.current) endAt.current += at - lastPause.current;
      if (p) lastPause.current = at;
    });
    return off;
  }, []);
  const lastPause = useRef(0);
  useEffect(() => stop, []);
  return { left, start, stop };
}
