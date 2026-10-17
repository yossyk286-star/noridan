import { useEffect, useState } from 'react';
import { load, save } from './storage';

/** 初登場のひとこと説明を見たかどうか（端末に保存。1回見たら二度と出えへん） */
let seen: Record<string, 1> = {};
const listeners = new Set<() => void>();
load<Record<string, 1>>('nd_seen', {}).then((v) => {
  seen = v ?? {};
  listeners.forEach((f) => f());
});

export function useSeen() {
  const [, set] = useState(0);
  useEffect(() => {
    const f = () => set((x) => x + 1);
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);
  return {
    seen,
    /** 説明をもう一回ぜんぶ出す */
    resetSeen() {
      seen = {};
      save('nd_seen', seen);
      listeners.forEach((f) => f());
    },
    markSeen(k: string) {
      seen = { ...seen, [k]: 1 };
      save('nd_seen', seen);
      listeners.forEach((f) => f());
    },
  };
}
