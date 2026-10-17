import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';

const COOLDOWN = 1200;
const NATIVE_G = 2.4; // 端末アプリ: 単位はG（静止で約1）
const WEB_MS2 = 24; // ブラウザ: 単位はm/s²（静止で約9.8）

/** iPhoneのブラウザはセンサーに許可が要る。タップの中で1回呼ぶ */
export function requestMotionPermission() {
  if (Platform.OS !== 'web') return;
  try {
    const DM = (globalThis as any).DeviceMotionEvent;
    if (DM && typeof DM.requestPermission === 'function') DM.requestPermission().catch(() => {});
  } catch {}
}

/**
 * スマホを振ったら onShake を呼ぶ。
 * 戻り値は「センサーが動いてるか」（ヒント表示用）
 */
export function useShake(enabled: boolean, onShake: () => void) {
  const handler = useRef(onShake);
  handler.current = onShake;
  const [alive, setAlive] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let last = 0;
    const fire = (force: number, threshold: number) => {
      const now = Date.now();
      if (force > threshold && now - last > COOLDOWN) {
        last = now;
        handler.current();
      }
    };

    if (Platform.OS === 'web') {
      const onMotion = (e: any) => {
        const a = e.accelerationIncludingGravity;
        if (!a || a.x == null) return;
        setAlive(true);
        fire(Math.hypot(a.x, a.y, a.z), WEB_MS2);
      };
      window.addEventListener('devicemotion', onMotion);
      return () => window.removeEventListener('devicemotion', onMotion);
    }

    Accelerometer.setUpdateInterval(100);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      setAlive(true);
      fire(Math.hypot(x, y, z), NATIVE_G);
    });
    return () => sub.remove();
  }, [enabled]);

  return enabled && alive;
}
